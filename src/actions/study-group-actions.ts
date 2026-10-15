"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher, getSessionUserFromCookies } from "@/lib/teacher-auth";
import { parseBengaliDigits } from "@/lib/utils";
import { StudyGroup, StudyGroupMember, GroupExamAttendance } from "@/types/study-group";

/**
 * শিক্ষক: সকল স্টাডি গ্রুপের তালিকা আনা (কোর্স অনুযায়ী ফিল্টারসহ)
 */
export async function getStudyGroups(courseFilter?: string): Promise<StudyGroup[]> {
  try {
    await requireTeacher();

    let query = supabase.from("study_groups").select("*").order("created_at", { ascending: false });
    if (courseFilter && courseFilter !== "all") {
      query = query.eq("course", courseFilter);
    }

    const { data: groups, error } = await query;
    if (error) {
      if (/study_groups/.test(String(error.message || ""))) {
        console.warn("study_groups table does not exist yet.");
        return [];
      }
      throw error;
    }

    if (!groups || groups.length === 0) return [];

    // প্রতি গ্রুপের মেম্বার সংখ্যা গণনা
    const groupIds = groups.map((g) => g.id);
    const { data: memberCounts, error: countErr } = await supabase
      .from("study_group_members")
      .select("group_id");

    const countMap: Record<string, number> = {};
    if (!countErr && memberCounts) {
      memberCounts.forEach((m) => {
        countMap[m.group_id] = (countMap[m.group_id] || 0) + 1;
      });
    }

    return groups.map((g) => ({
      id: g.id,
      course: g.course,
      name: g.name,
      inviteCode: g.invite_code,
      description: g.description || "",
      createdAt: g.created_at,
      memberCount: countMap[g.id] || 0
    }));
  } catch (err) {
    console.error("getStudyGroups error:", err);
    return [];
  }
}

/**
 * শিক্ষক: নতুন স্টাডি গ্রুপ তৈরি করা
 */
export async function createStudyGroup(
  course: string,
  name: string,
  description?: string
): Promise<{ success: boolean; message: string; group?: StudyGroup }> {
  try {
    await requireTeacher();

    const cleanCourse = String(course || "").trim();
    const cleanName = String(name || "").trim();
    if (!cleanCourse || !cleanName) {
      return { success: false, message: "কোর্স ও গ্রুপের নাম দেওয়া আবশ্যক।" };
    }

    // ইউনিক ইনভাইট কোড তৈরি (সংক্ষিপ্ত ও সহজে শেয়ারযোগ্য)
    const randomHex = Math.random().toString(36).substring(2, 7);
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 8);
    const inviteCode = slug ? `${slug}-${randomHex}` : `grp-${randomHex}`;

    const { data, error } = await supabase
      .from("study_groups")
      .insert({
        course: cleanCourse,
        name: cleanName,
        invite_code: inviteCode,
        description: description?.trim() || ""
      })
      .select()
      .single();

    if (error) {
      if (/study_groups/.test(String(error.message || ""))) {
        return {
          success: false,
          message: "study_groups টেবিল তৈরি করা হয়নি। Supabase SQL Editor-এ মাইগ্রেশন রান করুন।"
        };
      }
      throw error;
    }

    return {
      success: true,
      message: `"${cleanName}" গ্রুপ সফলভাবে তৈরি হয়েছে ✓`,
      group: {
        id: data.id,
        course: data.course,
        name: data.name,
        inviteCode: data.invite_code,
        description: data.description,
        createdAt: data.created_at,
        memberCount: 0
      }
    };
  } catch (err: any) {
    console.error("createStudyGroup error:", err);
    return { success: false, message: err?.message || "গ্রুপ তৈরিতে সমস্যা হয়েছে।" };
  }
}

/**
 * শিক্ষক: স্টাডি গ্রুপ মুছে ফেলা
 */
export async function deleteStudyGroup(groupId: string): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();

    const { error } = await supabase.from("study_groups").delete().eq("id", groupId);
    if (error) throw error;

    return { success: true, message: "গ্রুপটি মুছে ফেলা হয়েছে।" };
  } catch (err) {
    console.error("deleteStudyGroup error:", err);
    return { success: false, message: "গ্রুপ মুছতে সমস্যা হয়েছে।" };
  }
}

/**
 * শিক্ষক: একটি গ্রুপের বিস্তারিত তথ্য ও সকল সদস্য আনা
 */
export async function getGroupDetails(groupId: string): Promise<{
  group: StudyGroup | null;
  members: StudyGroupMember[];
}> {
  try {
    await requireTeacher();

    const { data: groupData, error: gErr } = await supabase
      .from("study_groups")
      .select("*")
      .eq("id", groupId)
      .maybeSingle();

    if (gErr || !groupData) return { group: null, members: [] };

    // গ্রুপের মেম্বার তালিকা আনা
    const { data: memberRows, error: mErr } = await supabase
      .from("study_group_members")
      .select("*")
      .eq("group_id", groupId)
      .order("joined_at", { ascending: false });

    if (mErr || !memberRows) {
      return {
        group: {
          id: groupData.id,
          course: groupData.course,
          name: groupData.name,
          inviteCode: groupData.invite_code,
          description: groupData.description,
          createdAt: groupData.created_at,
          memberCount: 0
        },
        members: []
      };
    }

    // মেম্বারদের allowed_students থেকে অতিরিক্ত তথ্য (যেমন Enrolled Courses) মেলানো
    const studentIds = memberRows.map((m) => m.student_id);
    const emails = memberRows.map((m) => m.student_email).filter(Boolean);

    let allowedFilter = `id.in.(${studentIds.join(",")})`;
    if (emails.length > 0) {
      allowedFilter += `,email.in.(${emails.join(",")})`;
    }

    const { data: allowedList } = await supabase
      .from("allowed_students")
      .select("id, name, email, courses")
      .or(allowedFilter);

    // Map each member to all their possible student_ids
    const memberToPossibleIds = new Map<string, string[]>();
    const allQueryIds = new Set<string>();

    memberRows.forEach((m) => {
      const ids = new Set<string>([m.student_id]);
      (allowedList || []).forEach((st) => {
        if (st.id === m.student_id || (m.student_email && st.email?.toLowerCase() === m.student_email.toLowerCase())) {
          ids.add(st.id);
        }
      });
      memberToPossibleIds.set(m.student_id, Array.from(ids));
      ids.forEach((id) => allQueryIds.add(id));
    });

    const allowedMap = new Map<string, any>();
    (allowedList || []).forEach((st) => {
      allowedMap.set(st.id, st);
      if (st.email) allowedMap.set(st.email.toLowerCase(), st);
    });

    // প্রতিটি মেম্বারের মোট পরীক্ষা দেওয়ার সংখ্যা (submissions থেকে)
    const { data: submissions } = await supabase
      .from("submissions")
      .select("student_id")
      .in("student_id", Array.from(allQueryIds));

    const submissionCountMap: Record<string, number> = {};
    (submissions || []).forEach((s) => {
      const sid = String(s.student_id || "");
      submissionCountMap[sid] = (submissionCountMap[sid] || 0) + 1;
    });

    const members: StudyGroupMember[] = memberRows.map((m) => {
      const allowed = allowedMap.get(m.student_id) || (m.student_email ? allowedMap.get(m.student_email.toLowerCase()) : null);
      const possibleIds = memberToPossibleIds.get(m.student_id) || [m.student_id];
      let memberSubCount = 0;
      possibleIds.forEach((pid) => {
        memberSubCount += submissionCountMap[pid] || 0;
      });

      return {
        id: m.id,
        groupId: m.group_id,
        studentId: m.student_id,
        studentName: m.student_name || allowed?.name || "নামহীন শিক্ষার্থী",
        studentEmail: m.student_email || allowed?.email || "",
        joinedAt: m.joined_at,
        courses: allowed?.courses || [],
        totalExamsCount: memberSubCount
      };
    });

    return {
      group: {
        id: groupData.id,
        course: groupData.course,
        name: groupData.name,
        inviteCode: groupData.invite_code,
        description: groupData.description,
        createdAt: groupData.created_at,
        memberCount: members.length
      },
      members
    };
  } catch (err) {
    console.error("getGroupDetails error:", err);
    return { group: null, members: [] };
  }
}

/**
 * শিক্ষক: গ্রুপ থেকে মেম্বার রিমুভ করা
 */
export async function removeMemberFromGroup(
  groupId: string,
  studentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();

    const { error } = await supabase
      .from("study_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("student_id", studentId);

    if (error) throw error;
    return { success: true, message: "মেম্বারকে গ্রুপ থেকে রিমুভ করা হয়েছে।" };
  } catch (err) {
    console.error("removeMemberFromGroup error:", err);
    return { success: false, message: "মেম্বার রিমুভ করতে সমস্যা হয়েছে।" };
  }
}

/**
 * শিক্ষক: একাধিক ছাত্রকে আইডি/ফোন নম্বর দিয়ে বাল্ক গ্রুপে যোগ করা
 */
export async function addMembersBulk(
  groupId: string,
  rawInput: string
): Promise<{ success: boolean; message: string; addedCount: number }> {
  try {
    await requireTeacher();

    const tokens = rawInput
      .split(/[\n,;]+/)
      .map((s) => parseBengaliDigits(s).trim())
      .filter((s) => s.length > 0);

    const uniqueTokens = Array.from(new Set(tokens));
    if (uniqueTokens.length === 0) {
      return { success: false, message: "কোনো আইডি বা নম্বর পাওয়া যায়নি।", addedCount: 0 };
    }

    // allowed_students থেকে নাম/ইমেইল খুঁজে নেওয়ার চেষ্টা
    const { data: matchedStudents } = await supabase
      .from("allowed_students")
      .select("id, name, email")
      .in("id", uniqueTokens);

    const studentMap = new Map<string, any>();
    (matchedStudents || []).forEach((st) => studentMap.set(st.id, st));

    const rowsToInsert = uniqueTokens.map((sid) => {
      const match = studentMap.get(sid);
      return {
        group_id: groupId,
        student_id: sid,
        student_name: match?.name || sid,
        student_email: match?.email || ""
      };
    });

    const { error } = await supabase
      .from("study_group_members")
      .upsert(rowsToInsert, { onConflict: "group_id,student_id" });

    if (error) throw error;

    return {
      success: true,
      message: `${uniqueTokens.length} জন শিক্ষার্থীকে গ্রুপে যুক্ত করা হয়েছে।`,
      addedCount: uniqueTokens.length
    };
  } catch (err) {
    console.error("addMembersBulk error:", err);
    return { success: false, message: "মেম্বার যোগ করতে সমস্যা হয়েছে।", addedCount: 0 };
  }
}

/**
 * পাবলিক: ইনভাইট কোড দিয়ে গ্রুপের প্রাথমিক তথ্য আনা (জয়েন পেজের জন্য)
 */
export async function getGroupByInviteCode(inviteCode: string): Promise<{
  success: boolean;
  group?: StudyGroup;
  message?: string;
}> {
  try {
    const code = String(inviteCode || "").trim();
    if (!code) return { success: false, message: "ইনভাইট কোড দেওয়া হয়নি।" };

    const { data, error } = await supabase
      .from("study_groups")
      .select("*")
      .eq("invite_code", code)
      .maybeSingle();

    if (error || !data) {
      return { success: false, message: "গ্রুপটি পাওয়া যায়নি বা লিংকটি ভুল।" };
    }

    const { count } = await supabase
      .from("study_group_members")
      .select("*", { count: "exact", head: true })
      .eq("group_id", data.id);

    return {
      success: true,
      group: {
        id: data.id,
        course: data.course,
        name: data.name,
        inviteCode: data.invite_code,
        description: data.description,
        createdAt: data.created_at,
        memberCount: count ?? 0
      }
    };
  } catch (err) {
    console.error("getGroupByInviteCode error:", err);
    return { success: false, message: "তথ্য লোড করতে সমস্যা হয়েছে।" };
  }
}

/**
 * স্টুডেন্ট: ইনভাইট লিংকের মাধ্যমে গ্রুপে জয়েন করা
 */
export async function joinStudyGroupByCode(
  inviteCode: string,
  clientStudent?: { id?: string; name?: string; email?: string }
): Promise<{ success: boolean; message: string; alreadyJoined?: boolean }> {
  try {
    const code = String(inviteCode || "").trim();
    if (!code) return { success: false, message: "ইনভাইট কোড সঠিক নয়।" };

    // ১. গ্রুপটি বিদ্যমান কি না দেখা
    const { data: group, error: gErr } = await supabase
      .from("study_groups")
      .select("id, name, course")
      .eq("invite_code", code)
      .maybeSingle();

    if (gErr || !group) {
      return { success: false, message: "গ্রুপটি পাওয়া যায়নি।" };
    }

    // ২. স্টুডেন্টের পরিচয় নির্ধারণ (Google সেশন বা লোকাল স্টুডেন্ট আইডি)
    let studentId = "";
    let studentName = "";
    let studentEmail = "";

    const sessionUser = await getSessionUserFromCookies();
    if (sessionUser?.id) {
      studentId = sessionUser.id;
      studentEmail = sessionUser.email || "";
      studentName = sessionUser.name || clientStudent?.name || "শিক্ষার্থী";
    } else if (clientStudent?.id) {
      studentId = parseBengaliDigits(clientStudent.id).trim();
      studentName = clientStudent.name?.trim() || "শিক্ষার্থী";
      studentEmail = clientStudent.email?.trim() || "";
    }

    if (!studentId) {
      return { success: false, message: "গ্রুপে যুক্ত হতে দয়া করে প্রথমে লগইন করুন।" };
    }

    // ৩. ইতিমধ্যে এই গ্রুপে যুক্ত আছে কিনা যাচাই
    const { data: existing } = await supabase
      .from("study_group_members")
      .select("id")
      .eq("group_id", group.id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (existing) {
      return {
        success: true,
        alreadyJoined: true,
        message: `আপনি ইতিমধ্যে "${group.name}" গ্রুপে যুক্ত আছেন!`
      };
    }

    // ৪. গ্রুপে ইনসার্ট করা
    const { error: insErr } = await supabase.from("study_group_members").insert({
      group_id: group.id,
      student_id: studentId,
      student_name: studentName,
      student_email: studentEmail
    });

    if (insErr) throw insErr;

    return {
      success: true,
      alreadyJoined: false,
      message: `অভিনন্দন! আপনি "${group.name}" গ্রুপে যুক্ত হয়েছেন ✓`
    };
  } catch (err: any) {
    console.error("joinStudyGroupByCode error:", err);
    return { success: false, message: err?.message || "গ্রুপে যুক্ত হতে সমস্যা হয়েছে।" };
  }
}

/**
 * শিক্ষক: কোনো নির্দিষ্ট পরীক্ষায় এই গ্রুপের উপস্থিতি ও পারফরম্যান্স দেখা
 */
export async function getGroupExamAttendance(
  groupId: string,
  examKey: string
): Promise<GroupExamAttendance | null> {
  try {
    await requireTeacher();

    // গ্রুপের তথ্য ও সদস্য আনা
    const { data: group } = await supabase
      .from("study_groups")
      .select("name, course")
      .eq("id", groupId)
      .maybeSingle();

    const { data: members } = await supabase
      .from("study_group_members")
      .select("student_id, student_name, student_email")
      .eq("group_id", groupId);

    if (!members || members.length === 0) {
      return {
        examKey,
        examTitle: "",
        totalMembers: 0,
        attendedCount: 0,
        missedCount: 0,
        attendanceRate: 0,
        averageScore: 0,
        attendedMembers: [],
        missedMembers: []
      };
    }

    // পরীক্ষার তথ্য
    const { data: examData } = await supabase
      .from("exams")
      .select("id, title")
      .eq("id", examKey)
      .maybeSingle();

    const examTitle = examData?.title || examKey;
    const memberIds = members.map((m) => m.student_id);
    const emails = members.map((m) => m.student_email).filter(Boolean);

    let allowedFilter = `id.in.(${memberIds.join(",")})`;
    if (emails.length > 0) {
      allowedFilter += `,email.in.(${emails.join(",")})`;
    }

    const { data: allowedList } = await supabase
      .from("allowed_students")
      .select("id, email")
      .or(allowedFilter);

    // Map each member to all their possible student_ids
    const memberToPossibleIds = new Map<string, string[]>();
    const allQueryIds = new Set<string>();

    members.forEach((m) => {
      const ids = new Set<string>([m.student_id]);
      (allowedList || []).forEach((st) => {
        if (st.id === m.student_id || (m.student_email && st.email?.toLowerCase() === m.student_email.toLowerCase())) {
          ids.add(st.id);
        }
      });
      memberToPossibleIds.set(m.student_id, Array.from(ids));
      ids.forEach((id) => allQueryIds.add(id));
    });

    // এই সদস্যদের সাবমিশন আনা (সঠিক কলাম: submitted_at)
    const { data: submissions } = await supabase
      .from("submissions")
      .select("student_id, student_name, score, submitted_at")
      .eq("exam_key", examKey)
      .in("student_id", Array.from(allQueryIds));

    const attendedMembers: GroupExamAttendance["attendedMembers"] = [];
    const missedMembers: GroupExamAttendance["missedMembers"] = [];
    let totalScore = 0;

    members.forEach((m) => {
      const possibleIds = memberToPossibleIds.get(m.student_id) || [m.student_id];
      const sub = (submissions || []).find((s) => possibleIds.includes(String(s.student_id)));
      if (sub) {
        const score = typeof sub.score === "number" ? sub.score : Number(sub.score) || 0;
        totalScore += score;
        attendedMembers.push({
          studentId: m.student_id,
          studentName: m.student_name || sub.student_name || m.student_id,
          score,
          submittedAt: sub.submitted_at
        });
      } else {
        missedMembers.push({
          studentId: m.student_id,
          studentName: m.student_name || m.student_id,
          email: m.student_email
        });
      }
    });

    // স্কোর অনুযায়ী সাজানো (বেশি নম্বর আগে)
    attendedMembers.sort((a, b) => b.score - a.score);

    const totalMembers = members.length;
    const attendedCount = attendedMembers.length;
    const missedCount = missedMembers.length;
    const attendanceRate = totalMembers > 0 ? Math.round((attendedCount / totalMembers) * 100) : 0;
    const averageScore = attendedCount > 0 ? Number((totalScore / attendedCount).toFixed(1)) : 0;

    return {
      examKey,
      examTitle,
      totalMembers,
      attendedCount,
      missedCount,
      attendanceRate,
      averageScore,
      attendedMembers,
      missedMembers
    };
  } catch (err) {
    console.error("getGroupExamAttendance error:", err);
    return null;
  }
}

/**
 * শিক্ষক: একটি কোর্সের সকল পরীক্ষার তালিকা আনা (অ্যাটেনডেন্স ড্রপডাউনের জন্য)
 */
export async function getExamsForGroupCourse(
  courseName: string
): Promise<{ id: string; title: string; course: string }[]> {
  try {
    await requireTeacher();

    const cleanCourse = String(courseName || "").trim();
    let query = supabase.from("exams").select("id, title, course").order("id", { ascending: false });

    if (cleanCourse && cleanCourse !== "all") {
      query = query.or(`course.eq."${cleanCourse}",course.eq.সাধারণ`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((e) => ({
      id: String(e.id),
      title: String(e.title || e.id),
      course: String(e.course || "")
    }));
  } catch (err) {
    console.error("getExamsForGroupCourse error:", err);
    return [];
  }
}
