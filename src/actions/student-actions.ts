"use server";

import { supabase } from "@/lib/supabase";
import { AllowedStudent } from "@/types/student";
import { Submission } from "@/types/submission";
import { parseBengaliDigits } from "@/lib/utils";
import { getExamSolutions } from "@/actions/exam-actions";
import { getTrueDate } from "@/lib/bangladesh-time";

export async function verifyStudentAccess(
  rawStudentId: string,
  examCourse: string,
  email?: string
): Promise<{ allowed: boolean; studentName?: string; normalizedId?: string; message?: string }> {
  const cleanId = String(rawStudentId).trim();
  const normalizedId = parseBengaliDigits(cleanId).trim();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanId) {
    return { allowed: false, message: "দয়া করে স্টুডেন্ট আইডি প্রদান করুন।" };
  }

  try {
    let matchedStudent: AllowedStudent | null = null;

    // 1. Direct match by raw ID, normalized ID or email (Google users are keyed by email too)
    const emailFilter = cleanEmail ? `,email.eq.${cleanEmail}` : "";
    const { data: student } = await supabase
      .from("allowed_students")
      .select("*")
      .or(`id.eq.${cleanId},id.eq.${normalizedId}${emailFilter}`)
      .maybeSingle();

    if (student) {
      matchedStudent = {
        id: student.id,
        name: student.name,
        courses: student.courses
      };
    }

    // 2. Collection search fallback for endsWith matching
    if (!matchedStudent) {
      const { data: allStudents } = await supabase
        .from("allowed_students")
        .select("*");

      (allStudents || []).forEach((d) => {
        const docSid = String(d.id).trim();
        const docNormSid = parseBengaliDigits(docSid).trim();
        const docEmail = String(d.email || "").trim().toLowerCase();
        const emailMatches = cleanEmail ? docEmail === cleanEmail : false;

        if (
          docSid === cleanId ||
          docNormSid === normalizedId ||
          emailMatches ||
          (normalizedId.length >= 10 && docNormSid.endsWith(normalizedId.slice(-10))) ||
          (docNormSid.length >= 10 && normalizedId.endsWith(docNormSid.slice(-10)))
        ) {
          matchedStudent = {
            id: d.id,
            name: d.name,
            courses: d.courses
          };
        }
      });
    }

    if (!matchedStudent) {
      return {
        allowed: false,
        message: "আপনার স্টুডেন্ট আইডিটি অনুমোদিত নয়। কোর্সে এনরোল করার পর শিক্ষকের অনুমোদন পেলে পরীক্ষা দিতে পারবেন।"
      };
    }

    const studentCourses = matchedStudent.courses || [];
    const normalizedCourses = (Array.isArray(studentCourses) ? studentCourses : [studentCourses])
      .map((c) => String(c || "").trim())
      .filter(Boolean);

    // If student has NO courses enrolled in database, they are strictly NOT allowed to access paid study hub or exams
    if (normalizedCourses.length === 0) {
      return {
        allowed: false,
        message: "আপনি কোনো কোর্সে এনরোল করেননি। অনুগ্রহ করে একটি কোর্সে এনরোল করে শিক্ষকের অনুমোদন নিন।"
      };
    }

    const targetCourse = (examCourse || "").trim();

    // If verifying general enrollment access ("ALL")
    if (!targetCourse || targetCourse === "ALL") {
      return {
        allowed: true,
        studentName: matchedStudent.name || "শিক্ষার্থী",
        normalizedId: matchedStudent.id || normalizedId || cleanId
      };
    }

    const hasCourseAccess =
      targetCourse === "সাধারণ কোর্স" ||
      normalizedCourses.some((c) => {
        const sc = c.toLowerCase();
        return sc === "all" || sc === "সকল কোর্স" || sc === targetCourse.toLowerCase();
      });

    if (!hasCourseAccess) {
      return {
        allowed: false,
        message: `দুঃখিত! আপনার আইডিটি "${examCourse}" কোর্সের জন্য অনুমোদিত নয়।`
      };
    }

    return {
      allowed: true,
      studentName: matchedStudent.name || "শিক্ষার্থী",
      normalizedId: matchedStudent.id || normalizedId || cleanId
    };
  } catch (err) {
    console.error("Student verification error:", err);
    return { allowed: false, message: "আইডি যাচাই করতে সমস্যা হয়েছে।" };
  }
}

export async function getStudentSubmissions(studentId: string): Promise<Submission[]> {
  const normId = parseBengaliDigits(studentId).trim();
  const cleanId = String(studentId).trim();

  try {
    const ids = Array.from(new Set([cleanId, normId])).filter(Boolean);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .in("student_id", ids)
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    const subs: Submission[] = (data || []).map((row) => ({
      id: row.id,
      studentName: row.student_name,
      studentId: row.student_id,
      examKey: row.exam_key,
      examTitle: row.exam_title,
      score: Number(row.score ?? 0),
      correct: Number(row.correct ?? 0),
      incorrect: Number(row.incorrect ?? 0),
      totalQuestions: Number(row.total_questions ?? 0),
      timeSpent: row.time_spent,
      answers: Array.isArray(row.answers)
        ? row.answers.map((v: any) => (v === -1 || v === null ? null : Number(v)))
        : [],
      isPendingEvaluation: row.is_pending_evaluation,
      isLiveSubmission: row.is_live_submission,
      submittedAtISO: row.submitted_at
    }));

    const { isAnswerTimeReached } = await import("@/lib/bangladesh-time");

    // Fetch exams info for evaluating only released/completed exams
    const { data: examDataList } = await supabase.from("exams").select("*");
    const examsMap: Record<string, any> = {};
    (examDataList || []).forEach((ex) => {
      examsMap[ex.id] = {
        id: ex.id,
        course: ex.course,
        subject: ex.subject,
        title: ex.title,
        timerMinutes: ex.timer_minutes,
        isFree: ex.is_free,
        passMark: Number(ex.pass_mark),
        startTime: ex.start_time,
        endTime: ex.end_time,
        isResultPublished: ex.is_result_published,
        leaderboardStartTime: ex.leaderboard_start_time,
        leaderboardEndTime: ex.leaderboard_end_time
      };
    });

    for (const s of subs) {
      const examObj = examsMap[s.examKey];
      const isReleased = examObj ? isAnswerTimeReached(examObj) : true;

      if (isReleased && (s.isPendingEvaluation || s.score === undefined)) {
        const solutions = await getExamSolutions(s.examKey);
        if (solutions && s.answers) {
          let cor = 0;
          let incor = 0;
          s.answers.forEach((ans, idx) => {
            const sol = solutions[idx];
            if (ans !== null && sol) {
              if (ans === sol.correct) cor++;
              else incor++;
            }
          });
          s.correct = cor;
          s.incorrect = incor;
          s.score = Math.max(0, cor - incor * 0.5);
          s.isPendingEvaluation = false;

          // Update evaluated score in Supabase
          await supabase
            .from("submissions")
            .update({
              score: s.score,
              correct: cor,
              incorrect: incor,
              is_pending_evaluation: false
            })
            .eq("id", s.id);
        }
      }
    }

    return subs;
  } catch (err) {
    console.error("Fetch student submissions error:", err);
    return [];
  }
}

export async function updateStudentName(uid: string, newName: string): Promise<boolean> {
  try {
    const cleanId = uid.trim();
    const { error } = await supabase
      .from("allowed_students")
      .update({ name: newName })
      .eq("id", cleanId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Update student name error:", err);
    return false;
  }
}

export async function syncStudentLogin(payload: {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}): Promise<{ success: boolean }> {
  try {
    const cleanId = payload.uid.trim();
    if (!cleanId) return { success: false };

    const { data: existing } = await supabase
      .from("allowed_students")
      .select("id, name, email, courses")
      .or(`id.eq.${cleanId},email.eq.${payload.email.trim()}`)
      .maybeSingle();

    const now = getTrueDate().toISOString();
    const existingCourses = existing?.courses || [];

    const { error } = await supabase.from("allowed_students").upsert({
      id: existing?.id || cleanId,
      name: payload.name.trim() || existing?.name || "শিক্ষার্থী",
      email: payload.email.trim() || existing?.email || "",
      courses: existingCourses,
      last_login_at: now,
      photo_url: payload.photoURL || ""
    });

    if (error) {
      // Fallback if photo_url or last_login_at columns are missing in older Supabase schema
      const { error: fallbackErr } = await supabase.from("allowed_students").upsert({
        id: existing?.id || cleanId,
        name: payload.name.trim() || existing?.name || "শিক্ষার্থী",
        email: payload.email.trim() || existing?.email || "",
        courses: existingCourses
      });
      if (fallbackErr) throw fallbackErr;
    }

    return { success: true };
  } catch (err) {
    console.error("Sync student login error:", err);
    return { success: false };
  }
}

export async function getAllAllowedStudents(): Promise<AllowedStudent[]> {
  try {
    const { data, error } = await supabase
      .from("allowed_students")
      .select("*")
      .order("id", { ascending: true });

    if (error) throw error;

    return (data || []).map((row) => ({
      docId: row.id,
      id: row.id,
      name: row.name,
      email: row.email || "",
      courses: row.courses || [],
      lastLoginAt: row.last_login_at || row.approved_at || "",
      photoURL: row.photo_url || ""
    }));
  } catch (err) {
    console.error("Fetch all allowed students error:", err);
    return [];
  }
}

export async function batchEnrollStudents(
  studentIds: string[],
  courses: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    if (!studentIds.length) {
      return { success: false, message: "কোনো শিক্ষার্থী নির্বাচন করা হয়নি।" };
    }

    const updatedCourses = courses.includes("ALL") ? ["ALL"] : Array.from(new Set(courses));

    for (const sid of studentIds) {
      await supabase
        .from("allowed_students")
        .update({ courses: updatedCourses })
        .eq("id", sid);
    }

    return { success: true, message: `${studentIds.length} জন শিক্ষার্থীর কোর্স সফলভাবে আপডেট করা হয়েছে।` };
  } catch (err) {
    console.error("Batch enroll error:", err);
    return { success: false, message: "কোর্স আপডেট করতে সমস্যা হয়েছে।" };
  }
}

export async function addAllowedStudentManual(
  id: string,
  name: string,
  course: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = parseBengaliDigits(id).trim();
    if (!cleanId || !name.trim()) {
      return { success: false, message: "আইডি এবং নাম প্রদান করা আবশ্যক।" };
    }

    const { data: existing } = await supabase
      .from("allowed_students")
      .select("courses")
      .eq("id", cleanId)
      .maybeSingle();

    const courses = existing ? Array.from(new Set([...(existing.courses || []), course])) : [course];

    const { error } = await supabase.from("allowed_students").upsert({
      id: cleanId,
      name: name.trim(),
      courses,
      approved_at: getTrueDate().toISOString()
    });

    if (error) throw error;
    return { success: true, message: "শিক্ষার্থী তালিকাভুক্ত হয়েছে।" };
  } catch (err) {
    console.error("Add student manual error:", err);
    return { success: false, message: "শিক্ষার্থী তালিকাভুক্ত করতে সমস্যা হয়েছে।" };
  }
}

export async function updateAllowedStudent(
  id: string,
  name: string,
  courses: string[]
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = id.trim();
    const { error } = await supabase
      .from("allowed_students")
      .update({
        name: name.trim(),
        courses: courses
      })
      .eq("id", cleanId);

    if (error) throw error;
    return { success: true, message: "শিক্ষার্থীর কোর্স ও তথ্য সফলভাবে আপডেট করা হয়েছে।" };
  } catch (err) {
    console.error("Update allowed student error:", err);
    return { success: false, message: "শিক্ষার্থীর তথ্য আপডেট করতে সমস্যা হয়েছে।" };
  }
}

export async function deleteAllowedStudent(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("allowed_students").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Delete allowed student error:", err);
    return false;
  }
}

/**
 * Secure Server Action: Fetch questions for a specific topic/chapter directly from DB.
 * Verifies student enrollment on the server before returning question content and solutions.
 */
export async function fetchTopicQuestionsForStudent(
  studentId: string,
  targetPath: string,
  email?: string
): Promise<{ success: boolean; questions: any[]; message?: string }> {
  const cleanId = String(studentId || "").trim();

  // 1. Verify enrollment on server (any course is enough)
  const access = await verifyStudentAccess(cleanId, "ALL", email);
  if (!access.allowed) {
    return {
      success: false,
      questions: [],
      message: "🔒 দুঃখিত! এই প্রশ্নগুলো পড়ার অনুমতি শুধুমাত্র অনুমোদিত ও এনরোল করা শিক্ষার্থীদের জন্য।"
    };
  }

  try {
    const cleanTarget = (targetPath || "").trim().toLowerCase();

    const { getTopicSegments } = await import("@/lib/topic-hierarchy");

    const isMatch = (rawTopic?: string, fallbackSubject?: string) => {
      if (!cleanTarget || cleanTarget === "all") return true;
      const segs = getTopicSegments(rawTopic, fallbackSubject);
      const full = segs.join(" > ").toLowerCase();
      return full === cleanTarget || full.startsWith(cleanTarget + " > ") || segs.some((s: string) => s.toLowerCase() === cleanTarget);
    };

    const pool: any[] = [];

    // Query 1: Fetch from topic_questions table in database
    const { data: dbTopicQs } = await supabase
      .from("topic_questions")
      .select("*")
      .order("created_at", { ascending: false });

    (dbTopicQs || []).forEach((tq, idx) => {
      if (isMatch(tq.topic, tq.original_subject) && tq.q && Array.isArray(tq.opts) && tq.opts.length >= 2) {
        pool.push({
          id: tq.id || `tq_${idx}`,
          q: tq.q,
          opts: tq.opts,
          correct: Number(tq.correct ?? 0),
          exp: tq.exp || "",
          subject: tq.original_subject || "পড়াশোনা",
          topic: tq.topic
        });
      }
    });

    // Query 2: Fetch from exams & question_bank links
    const { data: dbExams } = await supabase.from("exams").select("*");
    const { data: dbLinks } = await supabase.from("exam_questions_link").select("exam_id, question_bank(*)");

    const examSolutionsMap: Record<string, any[]> = {};

    for (const link of (dbLinks || [])) {
      const rawQ = link.question_bank;
      const qData: any = Array.isArray(rawQ) ? rawQ[0] : rawQ;
      if (!qData || !qData.q) continue;

      const examId = link.exam_id;
      const ex = (dbExams || []).find((e) => e.id === examId);
      const examSubject = ex?.subject || "পড়াশোনা";

      if (isMatch(qData.topic, examSubject)) {
        if (!examSolutionsMap[examId]) {
          examSolutionsMap[examId] = (await getExamSolutions(examId)) || [];
        }
        
        pool.push({
          id: qData.id,
          q: qData.q,
          opts: qData.opts,
          correct: Number(qData.correct ?? 0),
          exp: qData.exp || "",
          subject: examSubject,
          topic: qData.topic
        });
      }
    }

    // Deduplicate by question text
    const uniqueMap = new Map<string, any>();
    pool.forEach((item) => {
      const key = item.q.trim().toLowerCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    return {
      success: true,
      questions: Array.from(uniqueMap.values())
    };
  } catch (err: any) {
    console.error("fetchTopicQuestionsForStudent error:", err);
    return {
      success: false,
      questions: [],
      message: "ডাটাবেস থেকে প্রশ্ন লোড করতে সমস্যা হয়েছে।"
    };
  }
}
