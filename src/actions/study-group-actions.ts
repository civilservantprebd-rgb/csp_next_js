"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher, getSessionUserFromCookies } from "@/lib/teacher-auth";
import { parseBengaliDigits } from "@/lib/utils";
import {
  StudyGroup,
  StudyGroupMember,
  GroupExamAttendance,
  GroupDailyRanking,
  GroupPeriodRankingResponse,
  AmbassadorApplication,
  GroupPeriodMemberActivity
} from "@/types/study-group";

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
    return await fetchGroupDetailsCore(groupId);
  } catch (err) {
    console.error("getGroupDetails error:", err);
    return { group: null, members: [] };
  }
}

async function fetchGroupDetailsCore(groupId: string): Promise<{
  group: StudyGroup | null;
  members: StudyGroupMember[];
}> {
  try {
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
    return await fetchGroupExamAttendanceCore(groupId, examKey);
  } catch (err) {
    console.error("getGroupExamAttendance error:", err);
    return null;
  }
}

async function fetchGroupExamAttendanceCore(
  groupId: string,
  examKey: string
): Promise<GroupExamAttendance | null> {
  try {
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
    console.error("fetchGroupExamAttendanceCore error:", err);
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
    return await fetchExamsForGroupCourseCore(courseName);
  } catch (err) {
    console.error("getExamsForGroupCourse error:", err);
    return [];
  }
}

async function fetchExamsForGroupCourseCore(
  courseName: string
): Promise<{ id: string; title: string; course: string }[]> {
  try {
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
    console.error("fetchExamsForGroupCourseCore error:", err);
    return [];
  }
}

/**
 * শিক্ষক: নির্দিষ্ট সময়সীমায় (Time Period / Date Range) লাইভ পরীক্ষায় অংশগ্রহণের হারের ভিত্তিতে গ্রুপ র‍্যাংকিং
 */
export async function getGroupPeriodLeaderboard(
  startDateStr?: string,
  endDateStr?: string,
  courseFilter?: string,
  specificExamKey?: string
): Promise<GroupPeriodRankingResponse> {
  try {
    await requireTeacher();
    return await fetchGroupPeriodLeaderboardCore(startDateStr, endDateStr, courseFilter, specificExamKey);
  } catch (err) {
    console.error("getGroupPeriodLeaderboard error:", err);
    return {
      startDate: startDateStr || "",
      endDate: endDateStr || "",
      rankings: [],
      availableLiveExams: []
    };
  }
}

async function fetchGroupPeriodLeaderboardCore(
  startDateStr?: string,
  endDateStr?: string,
  courseFilter?: string,
  specificExamKey?: string
): Promise<GroupPeriodRankingResponse> {
  try {
    // বর্তমান বাংলাদেশ তারিখ বের করা
    const now = new Date();
    const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const todayStr = bdTime.toISOString().slice(0, 10);

    let sDate = startDateStr?.trim() || todayStr;
    let eDate = endDateStr?.trim() || sDate;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(sDate)) sDate = todayStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eDate)) eDate = sDate;

    // শুরু ও শেষের ক্রম ঠিক করা (যদি sDate > eDate হয়)
    if (sDate > eDate) {
      const temp = sDate;
      sDate = eDate;
      eDate = temp;
    }

    // বাংলাদেশ সময়ের শুরু ও শেষ টাইমস্ট্যাম্প (ISO)
    const startIso = new Date(`${sDate}T00:00:00+06:00`).toISOString();
    const endIso = new Date(`${eDate}T23:59:59.999+06:00`).toISOString();

    // ১. গ্রুপসমূহ আনা
    let groupQuery = supabase.from("study_groups").select("id, name, course").order("name", { ascending: true });
    if (courseFilter && courseFilter !== "all") {
      groupQuery = groupQuery.eq("course", courseFilter);
    }
    const { data: groups, error: gErr } = await groupQuery;
    if (gErr || !groups || groups.length === 0) {
      return { startDate: sDate, endDate: eDate, rankings: [], availableLiveExams: [] };
    }

    const groupIds = groups.map((g) => g.id);

    // ২. গ্রুপের সকল মেম্বার আনা
    const { data: allMembers, error: mErr } = await supabase
      .from("study_group_members")
      .select("group_id, student_id, student_name, student_email")
      .in("group_id", groupIds);

    if (mErr || !allMembers || allMembers.length === 0) {
      return {
        startDate: sDate,
        endDate: eDate,
        rankings: groups.map((g, idx) => ({
          groupId: g.id,
          groupName: g.name,
          course: g.course,
          totalMembers: 0,
          activeCount: 0,
          participationRate: 0,
          submissionsCount: 0,
          liveExamsCount: 0,
          averageScore: 0,
          rank: idx + 1
        })),
        availableLiveExams: []
      };
    }

    // মেম্বারদের বিকল্প আইডি (ফোন / ইমেইল / ইউআইডি) মেলানো
    const memberIds = allMembers.map((m) => m.student_id);
    const emails = allMembers.map((m) => m.student_email).filter(Boolean);

    let allowedFilter = `id.in.(${memberIds.join(",")})`;
    if (emails.length > 0) {
      allowedFilter += `,email.in.(${emails.join(",")})`;
    }

    const { data: allowedList } = await supabase
      .from("allowed_students")
      .select("id, email")
      .or(allowedFilter);

    const memberToPossibleIds = new Map<string, string[]>();
    const allQueryIds = new Set<string>();

    allMembers.forEach((m) => {
      const ids = new Set<string>([m.student_id]);
      (allowedList || []).forEach((st) => {
        if (st.id === m.student_id || (m.student_email && st.email?.toLowerCase() === m.student_email.toLowerCase())) {
          ids.add(st.id);
        }
      });
      memberToPossibleIds.set(m.student_id, Array.from(ids));
      ids.forEach((id) => allQueryIds.add(id));
    });

    // ৩. এই সময়সীমায় অনুষ্ঠিত বা সংশ্লিষ্ট লাইভ পরীক্ষাসমূহ খুঁজে বের করা
    // exams টেবিল থেকে শিডিউলড উইন্ডো চেক
    const { data: scheduledExams } = await supabase
      .from("exams")
      .select("id, title, course, start_time, end_time")
      .or(`and(start_time.gte.${startIso},start_time.lte.${endIso}),and(end_time.gte.${startIso},end_time.lte.${endIso})`);

    const liveExamMap = new Map<string, { id: string; title: string; course: string }>();

    (scheduledExams || []).forEach((ex) => {
      if (ex.id) {
        liveExamMap.set(String(ex.id), {
          id: String(ex.id),
          title: String(ex.title || ex.id),
          course: String(ex.course || "সাধারণ")
        });
      }
    });

    // ৪. এই সময়সীমায় মেম্বারদের লাইভ সাবমিশন (is_live_submission = true) আনা
    let subQuery = supabase
      .from("submissions")
      .select("id, student_id, exam_key, exam_title, score, submitted_at, is_live_submission")
      .eq("is_live_submission", true)
      .gte("submitted_at", startIso)
      .lte("submitted_at", endIso)
      .in("student_id", Array.from(allQueryIds));

    if (specificExamKey && specificExamKey !== "all") {
      subQuery = subQuery.eq("exam_key", specificExamKey);
    }

    const { data: submissions, error: subErr } = await subQuery;
    if (subErr) throw subErr;

    // সাবমিশন থেকেও কোনো মিসিং লাইভ পরীক্ষা liveExamMap-এ যোগ করা
    const missingExamKeys: string[] = [];
    (submissions || []).forEach((s) => {
      const key = String(s.exam_key || "");
      if (key && !liveExamMap.has(key)) {
        liveExamMap.set(key, {
          id: key,
          title: String(s.exam_title || key),
          course: "সাধারণ"
        });
        missingExamKeys.push(key);
      }
    });

    if (missingExamKeys.length > 0) {
      const { data: metaExams } = await supabase
        .from("exams")
        .select("id, title, course")
        .in("id", missingExamKeys);

      (metaExams || []).forEach((ex) => {
        if (liveExamMap.has(String(ex.id))) {
          liveExamMap.set(String(ex.id), {
            id: String(ex.id),
            title: String(ex.title || ex.id),
            course: String(ex.course || "সাধারণ")
          });
        }
      });
    }

    const availableLiveExams = Array.from(liveExamMap.values());

    // ৫. গ্রুপ অনুযায়ী মেম্বার ও সাবমিশন ক্যালকুলেশন
    const groupMemberMap = new Map<string, typeof allMembers>();
    allMembers.forEach((m) => {
      const list = groupMemberMap.get(m.group_id) || [];
      list.push(m);
      groupMemberMap.set(m.group_id, list);
    });

    const isSpecific = specificExamKey && specificExamKey !== "all";

    const rankings: GroupDailyRanking[] = groups.map((g) => {
      const members = groupMemberMap.get(g.id) || [];
      const totalMembers = members.length;

      // এই গ্রুপের জন্য প্রযোজ্য লাইভ পরীক্ষাগুলো নির্ধারণ করা
      let applicableLiveExamIds: string[] = [];
      if (isSpecific) {
        applicableLiveExamIds = [specificExamKey!];
      } else {
        applicableLiveExamIds = availableLiveExams
          .filter((ex) => !ex.course || ex.course === "সাধারণ" || ex.course === g.course)
          .map((ex) => ex.id);
      }

      // গ্রুপের সম্ভাব্য সকল আইডি সেট
      const groupPossibleIds = new Set<string>();
      members.forEach((m) => {
        (memberToPossibleIds.get(m.student_id) || [m.student_id]).forEach((id) => groupPossibleIds.add(id));
      });

      const groupSubs = (submissions || []).filter((s) => groupPossibleIds.has(String(s.student_id)));

      if (!isSpecific && applicableLiveExamIds.length === 0) {
        const examsTaken = Array.from(new Set(groupSubs.map((s) => s.exam_key).filter(Boolean)));
        applicableLiveExamIds = examsTaken;
      }

      const liveExamsCount = applicableLiveExamIds.length;

      let activeCount = 0; // কতজন মেম্বার অন্তত ১টি লাইভ পরীক্ষা দিয়েছে
      let uniqueAttendancesCount = 0; // মোট কতটি অনন্য (মেম্বার + পরীক্ষা) লাইভ সাবমিশন সম্পন্ন হয়েছে
      let totalScore = 0;
      let totalSubmissionsCount = groupSubs.length;

      members.forEach((m) => {
        const possibleIds = memberToPossibleIds.get(m.student_id) || [m.student_id];
        const mSubs = groupSubs.filter((s) => possibleIds.includes(String(s.student_id)));

        if (mSubs.length > 0) {
          activeCount++;
        }

        const attendedExamKeys = new Set(
          mSubs
            .map((s) => s.exam_key)
            .filter((k) => applicableLiveExamIds.length === 0 || applicableLiveExamIds.includes(k))
        );
        uniqueAttendancesCount += attendedExamKeys.size;
      });

      groupSubs.forEach((s) => {
        totalScore += typeof s.score === "number" ? s.score : Number(s.score) || 0;
      });

      // পারসেন্টেজ হিসাব:
      // লাইভ পরীক্ষায় অংশগ্রহণের সার্বিক হার (%)
      let participationRate = 0;
      if (totalMembers > 0) {
        if (liveExamsCount > 0) {
          const totalPossibleEntries = totalMembers * liveExamsCount;
          participationRate = Math.min(100, Math.round((uniqueAttendancesCount / totalPossibleEntries) * 100));
        } else {
          participationRate = Math.min(100, Math.round((activeCount / totalMembers) * 100));
        }
      }

      const averageScore = totalSubmissionsCount > 0 ? Number((totalScore / totalSubmissionsCount).toFixed(1)) : 0;

      return {
        groupId: g.id,
        groupName: g.name,
        course: g.course,
        totalMembers,
        activeCount,
        participationRate,
        submissionsCount: totalSubmissionsCount,
        liveExamsCount,
        averageScore,
        rank: 0
      };
    });

    // সর্টিং: ১. লাইভ পরীক্ষার অংশগ্রহণের হার (%) ২. সক্রিয় সদস্য সংখ্যা ৩. মোট সাবমিশন ৪. গড় স্কোর
    rankings.sort((a, b) => {
      if (b.participationRate !== a.participationRate) return b.participationRate - a.participationRate;
      if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
      if (b.submissionsCount !== a.submissionsCount) return b.submissionsCount - a.submissionsCount;
      return b.averageScore - a.averageScore;
    });

    // র‍্যাংক বসানো
    rankings.forEach((r, idx) => {
      r.rank = idx + 1;
    });

    return {
      startDate: sDate,
      endDate: eDate,
      rankings,
      availableLiveExams
    };
  } catch (err) {
    console.error("getGroupPeriodLeaderboard error:", err);
    return {
      startDate: startDateStr || "",
      endDate: endDateStr || "",
      rankings: [],
      availableLiveExams: []
    };
  }
}

/**
 * পূর্ববর্তী কোডের সাথে সামঞ্জস্য রাখার জন্য একক দিনের র‍্যাংকিং ফাংশন
 */
export async function getGroupDailyLeaderboard(
  targetDateStr?: string,
  courseFilter?: string
): Promise<{ date: string; rankings: GroupDailyRanking[] }> {
  const res = await getGroupPeriodLeaderboard(targetDateStr, targetDateStr, courseFilter);
  return { date: res.startDate, rankings: res.rankings };
}

// ============================================================================
// AMBASSADOR SYSTEM (অ্যাম্বাসেডর আবেদন, অনুমোদন ও মনিটরিং ড্যাশবোর্ড)
// ============================================================================

const AMBASSADOR_STORAGE_KEY = "__AMBASSADORS_DATA__";

async function readAmbassadorsFromDb(): Promise<AmbassadorApplication[]> {
  try {
    const { data, error } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", AMBASSADOR_STORAGE_KEY)
      .maybeSingle();

    if (error || !data?.details) return [];
    const parsed = typeof data.details === "string" ? JSON.parse(data.details) : data.details;
    if (parsed && Array.isArray(parsed.applications)) {
      return parsed.applications;
    }
    return [];
  } catch (err) {
    console.error("readAmbassadorsFromDb error:", err);
    return [];
  }
}

async function writeAmbassadorsToDb(applications: AmbassadorApplication[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: AMBASSADOR_STORAGE_KEY,
          details: JSON.stringify({
            type: "ambassador_system",
            applications
          })
        },
        { onConflict: "course" }
      );
    if (error) {
      console.error("writeAmbassadorsToDb error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("writeAmbassadorsToDb unexpected error:", err);
    return false;
  }
}

async function isApprovedAmbassadorForGroup(
  groupId: string,
  studentId?: string,
  studentEmail?: string
): Promise<boolean> {
  const cleanId = String(studentId || "").trim();
  const cleanEmail = String(studentEmail || "").trim().toLowerCase();
  if (!cleanId && !cleanEmail) return false;

  const list = await readAmbassadorsFromDb();
  return list.some(
    (app) =>
      app.groupId === groupId &&
      app.status === "approved" &&
      ((cleanId && app.studentId === cleanId) ||
        (cleanEmail && app.studentEmail?.toLowerCase() === cleanEmail))
  );
}

/**
 * পাবলিক / স্টুডেন্ট: অ্যাম্বাসেডর ফর্মের ড্রপডাউনের জন্য সকল স্টাডি গ্রুপের তালিকা
 */
export async function getPublicStudyGroupsForAmbassador(): Promise<StudyGroup[]> {
  try {
    const { data: groups, error } = await supabase
      .from("study_groups")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !groups) return [];

    return groups.map((g) => ({
      id: g.id,
      course: g.course,
      name: g.name,
      inviteCode: g.invite_code,
      description: g.description || "",
      createdAt: g.created_at,
      memberCount: 0
    }));
  } catch (err) {
    console.error("getPublicStudyGroupsForAmbassador error:", err);
    return [];
  }
}

/**
 * স্টুডেন্ট: নিজের অ্যাম্বাসেডর আবেদনের বর্তমান অবস্থা জানা (pending / approved / null)
 */
export async function getMyAmbassadorStatus(
  studentId: string,
  studentEmail?: string
): Promise<{ application: AmbassadorApplication | null }> {
  try {
    const cleanId = String(studentId || "").trim();
    const cleanEmail = String(studentEmail || "").trim().toLowerCase();
    if (!cleanId && !cleanEmail) return { application: null };

    const list = await readAmbassadorsFromDb();
    const found = list.find(
      (app) =>
        (cleanId && app.studentId === cleanId) ||
        (cleanEmail && app.studentEmail?.toLowerCase() === cleanEmail)
    );

    if (!found) return { application: null };

    // গ্রুপটি এখনো বিদ্যমান কিনা যাচাই ও সর্বশেষ নাম আপডেট
    const { data: groupData } = await supabase
      .from("study_groups")
      .select("id, name, course")
      .eq("id", found.groupId)
      .maybeSingle();

    if (groupData) {
      found.groupName = groupData.name;
      found.course = groupData.course;
    }

    return { application: found };
  } catch (err) {
    console.error("getMyAmbassadorStatus error:", err);
    return { application: null };
  }
}

/**
 * স্টুডেন্ট: যেকোনো একটি স্টাডি গ্রুপের অ্যাম্বাসেডর হওয়ার জন্য আবেদন জমা দেওয়া
 */
export async function applyForAmbassador(payload: {
  studentId: string;
  studentName: string;
  studentEmail: string;
  photoURL?: string;
  university: string;
  session: string;
  reason: string;
  groupId: string;
}): Promise<{ success: boolean; message: string; application?: AmbassadorApplication }> {
  try {
    const cleanId = String(payload.studentId || "").trim();
    const cleanName = String(payload.studentName || "").trim();
    const cleanEmail = String(payload.studentEmail || "").trim();
    const cleanUni = String(payload.university || "").trim();
    const cleanSession = String(payload.session || "").trim();
    const cleanReason = String(payload.reason || "").trim();
    const cleanGroupId = String(payload.groupId || "").trim();

    if (!cleanId) {
      return { success: false, message: "আবেদন করতে প্রথমে Google দিয়ে সাইন ইন করুন।" };
    }
    if (!cleanName) {
      return { success: false, message: "আপনার নাম লিখুন।" };
    }
    if (!cleanUni) {
      return { success: false, message: "আপনার বিশ্ববিদ্যালয় বা প্রতিষ্ঠানের নাম লিখুন।" };
    }
    if (!cleanSession) {
      return { success: false, message: "আপনার সেশন বা বর্ষ উল্লেখ করুন।" };
    }
    if (!cleanGroupId) {
      return { success: false, message: "ড্রপডাউন থেকে একটি স্টাডি গ্রুপ নির্বাচন করুন।" };
    }
    if (!cleanReason) {
      return { success: false, message: "কেন আপনি অ্যাম্বাসেডর হিসেবে জয়েন করতে চান তা সংক্ষেপে লিখুন।" };
    }

    const list = await readAmbassadorsFromDb();

    // ইতিমধ্যে কোনো গ্রুপে আবেদন করেছে বা অ্যাম্বাসেডর আছে কিনা যাচাই
    const existing = list.find(
      (app) =>
        app.studentId === cleanId ||
        (cleanEmail && app.studentEmail?.toLowerCase() === cleanEmail.toLowerCase())
    );

    if (existing) {
      return {
        success: false,
        message: `আপনি ইতিমধ্যে "${existing.groupName}" গ্রুপের অ্যাম্বাসেডর হিসেবে ${
          existing.status === "approved" ? "নিযুক্ত আছেন" : "আবেদন করেছেন"
        }। অন্য কোনো গ্রুপে আবেদন করা যাবে না।`
      };
    }

    // গ্রুপের তথ্য যাচাই
    const { data: groupData, error: gErr } = await supabase
      .from("study_groups")
      .select("id, name, course")
      .eq("id", cleanGroupId)
      .maybeSingle();

    if (gErr || !groupData) {
      return { success: false, message: "নির্বাচিত স্টাডি গ্রুপটি পাওয়া যায়নি।" };
    }

    const newApp: AmbassadorApplication = {
      id: `amb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentId: cleanId,
      studentName: cleanName,
      studentEmail: cleanEmail,
      photoURL: payload.photoURL || "",
      university: cleanUni,
      session: cleanSession,
      reason: cleanReason,
      groupId: groupData.id,
      groupName: groupData.name,
      course: groupData.course,
      status: "pending",
      appliedAt: new Date().toISOString()
    };

    const saved = await writeAmbassadorsToDb([newApp, ...list]);
    if (!saved) {
      return { success: false, message: "আবেদন সংরক্ষণ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।" };
    }

    return {
      success: true,
      message: `অভিনন্দন! "${groupData.name}" গ্রুপের অ্যাম্বাসেডর হিসেবে আপনার আবেদন সফলভাবে জমা হয়েছে ✓`,
      application: newApp
    };
  } catch (err: any) {
    console.error("applyForAmbassador error:", err);
    return { success: false, message: err?.message || "আবেদন জমা দিতে সমস্যা হয়েছে।" };
  }
}

/**
 * শিক্ষক: সকল অ্যাম্বাসেডর আবেদন ও অনুমোদিত অ্যাম্বাসেডরদের তালিকা আনা
 */
export async function getAllAmbassadorApplications(): Promise<AmbassadorApplication[]> {
  try {
    await requireTeacher();
    const list = await readAmbassadorsFromDb();
    if (list.length === 0) return [];

    const { data: groups } = await supabase.from("study_groups").select("id, name, course");
    const groupMap = new Map<string, { name: string; course: string }>();
    (groups || []).forEach((g) => groupMap.set(g.id, { name: g.name, course: g.course }));

    return list.map((app) => {
      const g = groupMap.get(app.groupId);
      return {
        ...app,
        groupName: g?.name || app.groupName,
        course: g?.course || app.course
      };
    });
  } catch (err) {
    console.error("getAllAmbassadorApplications error:", err);
    return [];
  }
}

/**
 * শিক্ষক: অ্যাম্বাসেডর আবেদন অনুমোদন (Approve) করা
 */
export async function approveAmbassadorApplication(
  applicationId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const list = await readAmbassadorsFromDb();
    const idx = list.findIndex((a) => a.id === applicationId);
    if (idx === -1) {
      return { success: false, message: "আবেদনটি পাওয়া যায়নি।" };
    }

    const app = list[idx];
    app.status = "approved";
    app.approvedAt = new Date().toISOString();

    const saved = await writeAmbassadorsToDb(list);
    if (!saved) {
      return { success: false, message: "অনুমোদন সংরক্ষণ করতে সমস্যা হয়েছে।" };
    }

    // স্বয়ংক্রিয়ভাবে ঐ গ্রুপের সদস্য হিসেবেও যুক্ত রাখা (যদি আগে থেকে না থাকে)
    try {
      const { data: existingMember } = await supabase
        .from("study_group_members")
        .select("id")
        .eq("group_id", app.groupId)
        .eq("student_id", app.studentId)
        .maybeSingle();

      if (!existingMember) {
        await supabase.from("study_group_members").insert({
          group_id: app.groupId,
          student_id: app.studentId,
          student_name: app.studentName,
          student_email: app.studentEmail || ""
        });
      }
    } catch {
      /* ignore member insert warning */
    }

    return {
      success: true,
      message: `${app.studentName}-কে "${app.groupName}" গ্রুপের অ্যাম্বাসেডর হিসেবে অনুমোদন দেওয়া হয়েছে ✓`
    };
  } catch (err) {
    console.error("approveAmbassadorApplication error:", err);
    return { success: false, message: "অনুমোদন করতে সমস্যা হয়েছে।" };
  }
}

/**
 * শিক্ষক: অ্যাম্বাসেডর রিমুভ বা আবেদন বাতিল করা
 */
export async function removeAmbassador(
  applicationId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const list = await readAmbassadorsFromDb();
    const target = list.find((a) => a.id === applicationId);
    if (!target) {
      return { success: false, message: "অ্যাম্বাসেডর পাওয়া যায়নি।" };
    }

    const updated = list.filter((a) => a.id !== applicationId);
    const saved = await writeAmbassadorsToDb(updated);
    if (!saved) {
      return { success: false, message: "রিমুভ করতে সমস্যা হয়েছে।" };
    }

    return {
      success: true,
      message: `${target.studentName}-কে অ্যাম্বাসেডর তালিকা থেকে সরানো হয়েছে।`
    };
  } catch (err) {
    console.error("removeAmbassador error:", err);
    return { success: false, message: "রিমুভ করতে সমস্যা হয়েছে।" };
  }
}

/**
 * অ্যাম্বাসেডর প্যানেল: অনুমোদিত অ্যাম্বাসেডরের জন্য নিজের গ্রুপের সম্পূর্ণ তথ্য, সদস্য, সহ-অ্যাম্বাসেডর ও পরীক্ষার তালিকা
 */
export async function getAmbassadorDashboardData(
  groupId: string,
  studentId: string,
  studentEmail?: string
): Promise<{
  allowed: boolean;
  group: StudyGroup | null;
  members: StudyGroupMember[];
  ambassadors: AmbassadorApplication[];
  exams: { id: string; title: string; course: string }[];
}> {
  try {
    const isAllowed = await isApprovedAmbassadorForGroup(groupId, studentId, studentEmail);
    if (!isAllowed) {
      return { allowed: false, group: null, members: [], ambassadors: [], exams: [] };
    }

    const { group, members } = await fetchGroupDetailsCore(groupId);
    if (!group) {
      return { allowed: false, group: null, members: [], ambassadors: [], exams: [] };
    }

    const exams = await fetchExamsForGroupCourseCore(group.course);
    const allApps = await readAmbassadorsFromDb();
    const ambassadors = allApps.filter((a) => a.groupId === groupId && a.status === "approved");

    return {
      allowed: true,
      group,
      members,
      ambassadors,
      exams
    };
  } catch (err) {
    console.error("getAmbassadorDashboardData error:", err);
    return { allowed: false, group: null, members: [], ambassadors: [], exams: [] };
  }
}

/**
 * অ্যাম্বাসেডর প্যানেল: নির্দিষ্ট পরীক্ষার উপস্থিতি ও ফলাফল দেখা
 */
export async function getAmbassadorExamAttendance(
  groupId: string,
  examKey: string,
  studentId: string,
  studentEmail?: string
): Promise<GroupExamAttendance | null> {
  try {
    const isAllowed = await isApprovedAmbassadorForGroup(groupId, studentId, studentEmail);
    if (!isAllowed) return null;
    return await fetchGroupExamAttendanceCore(groupId, examKey);
  } catch (err) {
    console.error("getAmbassadorExamAttendance error:", err);
    return null;
  }
}

/**
 * অ্যাম্বাসেডর প্যানেল: নির্দিষ্ট সময়ে (Date Range) গ্রুপের কে কে পরীক্ষা দিয়েছে এবং কে দেয়নি তার বিস্তারিত রিপোর্ট
 */
export async function getAmbassadorPeriodActivity(
  groupId: string,
  startDateStr: string,
  endDateStr: string,
  studentId: string,
  studentEmail?: string
): Promise<{
  startDate: string;
  endDate: string;
  activeMembers: GroupPeriodMemberActivity[];
  inactiveMembers: { studentId: string; studentName: string }[];
}> {
  try {
    const isAllowed = await isApprovedAmbassadorForGroup(groupId, studentId, studentEmail);
    if (!isAllowed) {
      return { startDate: startDateStr, endDate: endDateStr, activeMembers: [], inactiveMembers: [] };
    }

    const now = new Date();
    const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const todayStr = bdTime.toISOString().slice(0, 10);

    let sDate = startDateStr?.trim() || todayStr;
    let eDate = endDateStr?.trim() || sDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sDate)) sDate = todayStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eDate)) eDate = sDate;
    if (sDate > eDate) {
      const tmp = sDate;
      sDate = eDate;
      eDate = tmp;
    }

    const startIso = new Date(`${sDate}T00:00:00+06:00`).toISOString();
    const endIso = new Date(`${eDate}T23:59:59.999+06:00`).toISOString();

    const { data: members } = await supabase
      .from("study_group_members")
      .select("student_id, student_name, student_email")
      .eq("group_id", groupId);

    if (!members || members.length === 0) {
      return { startDate: sDate, endDate: eDate, activeMembers: [], inactiveMembers: [] };
    }

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

    const { data: submissions } = await supabase
      .from("submissions")
      .select("student_id, exam_key, exam_title, score, submitted_at, is_live_submission")
      .gte("submitted_at", startIso)
      .lte("submitted_at", endIso)
      .in("student_id", Array.from(allQueryIds))
      .order("submitted_at", { ascending: false });

    const activeMembers: GroupPeriodMemberActivity[] = [];
    const inactiveMembers: { studentId: string; studentName: string }[] = [];

    members.forEach((m) => {
      const possibleIds = memberToPossibleIds.get(m.student_id) || [m.student_id];
      const mSubs = (submissions || []).filter((s) => possibleIds.includes(String(s.student_id)));

      if (mSubs.length > 0) {
        let totalScore = 0;
        let liveCount = 0;
        const formattedSubs = mSubs.map((s) => {
          const sc = typeof s.score === "number" ? s.score : Number(s.score) || 0;
          totalScore += sc;
          if (s.is_live_submission) liveCount++;
          return {
            examKey: String(s.exam_key || ""),
            examTitle: String(s.exam_title || s.exam_key || "পরীক্ষা"),
            score: sc,
            submittedAt: String(s.submitted_at || ""),
            isLive: Boolean(s.is_live_submission)
          };
        });

        activeMembers.push({
          studentId: m.student_id,
          studentName: m.student_name || m.student_id,
          examsTakenCount: mSubs.length,
          liveExamsTakenCount: liveCount,
          averageScore: Number((totalScore / mSubs.length).toFixed(1)),
          lastSubmittedAt: formattedSubs[0]?.submittedAt,
          submissions: formattedSubs
        });
      } else {
        inactiveMembers.push({
          studentId: m.student_id,
          studentName: m.student_name || m.student_id
        });
      }
    });

    activeMembers.sort((a, b) => {
      if (b.examsTakenCount !== a.examsTakenCount) return b.examsTakenCount - a.examsTakenCount;
      return b.averageScore - a.averageScore;
    });

    return {
      startDate: sDate,
      endDate: eDate,
      activeMembers,
      inactiveMembers
    };
  } catch (err) {
    console.error("getAmbassadorPeriodActivity error:", err);
    return { startDate: startDateStr, endDate: endDateStr, activeMembers: [], inactiveMembers: [] };
  }
}

/**
 * অ্যাম্বাসেডর প্যানেল: অন্য সকল গ্রুপের সাথে র‍্যাংকিং তুলনা (Time Period Leaderboard)
 */
export async function getAmbassadorGroupLeaderboard(
  groupId: string,
  studentId: string,
  studentEmail?: string,
  startDateStr?: string,
  endDateStr?: string,
  courseFilter?: string,
  specificExamKey?: string
): Promise<GroupPeriodRankingResponse> {
  try {
    const isAllowed = await isApprovedAmbassadorForGroup(groupId, studentId, studentEmail);
    if (!isAllowed) {
      return {
        startDate: startDateStr || "",
        endDate: endDateStr || "",
        rankings: [],
        availableLiveExams: []
      };
    }

    return await fetchGroupPeriodLeaderboardCore(startDateStr, endDateStr, courseFilter, specificExamKey);
  } catch (err) {
    console.error("getAmbassadorGroupLeaderboard error:", err);
    return {
      startDate: startDateStr || "",
      endDate: endDateStr || "",
      rankings: [],
      availableLiveExams: []
    };
  }
}


