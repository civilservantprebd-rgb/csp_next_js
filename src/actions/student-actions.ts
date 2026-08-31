"use server";

import { supabase } from "@/lib/supabase";
import { AllowedStudent } from "@/types/student";
import { Submission } from "@/types/submission";
import { Exam } from "@/types/exam";
import { parseBengaliDigits } from "@/lib/utils";
import { getExamSolutions } from "@/actions/exam-actions";
import { getTrueDate } from "@/lib/bangladesh-time";
import { requireTeacher, sessionOwnsStudent } from "@/lib/teacher-auth";

export async function verifyStudentAccess(
  rawStudentId: string,
  examCourse: string,
  email?: string
): Promise<{ allowed: boolean; studentName?: string; normalizedId?: string; courses?: string[]; message?: string }> {
  const cleanId = String(rawStudentId).trim();
  const normalizedId = parseBengaliDigits(cleanId).trim();
  const cleanEmail = String(email || "").trim().toLowerCase();

  // Strip PostgREST filter metacharacters — never interpolate raw caller input
  // into a filter expression.
  const sanitize = (s: string) => String(s || "").replace(/[(),;*]/g, "");
  const safeId = sanitize(cleanId);
  const safeNormId = sanitize(normalizedId);
  const safeEmail = sanitize(cleanEmail);

  if (!cleanId) {
    return { allowed: false, message: "দয়া করে স্টুডেন্ট আইডি প্রদান করুন।" };
  }

  try {
    let matchedStudent: AllowedStudent | null = null;

    // 1. Direct match by raw ID, normalized ID or email (Google users are keyed by email too)
    const emailFilter = safeEmail ? `,email.eq.${safeEmail}` : "";
    const { data: student } = await supabase
      .from("allowed_students")
      .select("*")
      .or(`id.eq.${safeId},id.eq.${safeNormId}${emailFilter}`)
      .maybeSingle();

    if (student) {
      matchedStudent = {
        id: student.id,
        name: student.name,
        courses: student.courses
      };
    }

    // 2. Collection search fallback for endsWith matching — deterministic:
    //    exact matches win; a suffix match is only accepted when unique.
    if (!matchedStudent) {
      const { data: allStudents } = await supabase
        .from("allowed_students")
        .select("*");

      const suffixMatches: AllowedStudent[] = [];
      (allStudents || []).forEach((d) => {
        const docSid = String(d.id).trim();
        const docNormSid = parseBengaliDigits(docSid).trim();
        const docEmail = String(d.email || "").trim().toLowerCase();
        const emailMatches = safeEmail ? docEmail === safeEmail : false;

        if (
          docSid === safeId ||
          docNormSid === safeNormId ||
          emailMatches
        ) {
          // Exact match — take it and stop scanning
          matchedStudent = {
            id: d.id,
            name: d.name,
            courses: d.courses
          };
          return;
        }

        if (
          (safeNormId.length >= 10 && docNormSid.endsWith(safeNormId.slice(-10))) ||
          (docNormSid.length >= 10 && safeNormId.endsWith(docNormSid.slice(-10)))
        ) {
          suffixMatches.push({
            id: d.id,
            name: d.name,
            courses: d.courses
          });
        }
      });

      if (!matchedStudent && suffixMatches.length === 1) {
        matchedStudent = suffixMatches[0];
      }
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
        normalizedId: matchedStudent.id || normalizedId || cleanId,
        courses: matchedStudent.courses || []
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
      normalizedId: matchedStudent.id || normalizedId || cleanId,
        courses: matchedStudent.courses || []
    };
  } catch (err) {
    console.error("Student verification error:", err);
    return { allowed: false, message: "আইডি যাচাই করতে সমস্যা হয়েছে।" };
  }
}

export async function getStudentSubmissions(studentId: string): Promise<Submission[]> {
  const normId = parseBengaliDigits(studentId).trim();
  const cleanId = String(studentId).trim();

  // SECURITY: only the student themselves (verified via the Supabase session)
  // may read their submissions — closes the portal IDOR where any phone number
  // could be typed to view another student's records.
  if (!(await sessionOwnsStudent(cleanId)) && !(await sessionOwnsStudent(normId))) {
    return [];
  }

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

    // SECURITY: only the logged-in student may rename their own record
    if (!(await sessionOwnsStudent(cleanId))) return false;

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

    // SECURITY: only the logged-in session user may sync their own profile
    if (!(await sessionOwnsStudent(cleanId))) return { success: false };

    const { data: existing } = await supabase
      .from("allowed_students")
      .select("id, name, email, courses")
      .or(`id.eq.${cleanId},email.eq.${payload.email.trim()}`)
      .maybeSingle();

    // Only sync students who are already enrolled/approved. Do NOT auto-create new
    // rows with empty courses: that registers every Google user as a "student" with
    // no enrollment, which locks them out of Self-Practice and the Topic/Chapter
    // question bank (verifyStudentAccess requires at least one course).
    if (!existing) return { success: true };

    const now = getTrueDate().toISOString();
    const existingCourses = existing?.courses || [];

    const { error } = await supabase.from("allowed_students").upsert({
      id: existing.id,
      name: payload.name.trim() || existing?.name || "শিক্ষার্থী",
      email: payload.email.trim() || existing?.email || "",
      courses: existingCourses,
      last_login_at: now,
      photo_url: payload.photoURL || ""
    });

    if (error) {
      // Fallback if photo_url or last_login_at columns are missing in older Supabase schema
      const { error: fallbackErr } = await supabase.from("allowed_students").upsert({
        id: existing.id,
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
    // SECURITY: the full student roster (phone ids, names, emails) is teacher-only
    await requireTeacher();

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
    // SECURITY: granting courses is a teacher-only operation
    await requireTeacher();

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
    // SECURITY: adding approved students is a teacher-only operation
    await requireTeacher();

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
    // SECURITY: modifying student records is a teacher-only operation
    await requireTeacher();

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
    // SECURITY: deleting students is a teacher-only operation
    await requireTeacher();

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

    const studentCourses = (access.courses || [])
      .map((c) => String(c || "").trim().toLowerCase())
      .filter(Boolean);

    // SECURITY: only expose correct/exp for questions the student is allowed to
    // see — never for answer-locked scheduled exams (before release), and never
    // for exams of courses the student is not enrolled in.
    const { isAnswerTimeReached } = await import("@/lib/bangladesh-time");
    const { data: allExams } = await supabase
      .from("exams")
      .select("id, course, subject, start_time, end_time, leaderboard_end_time, is_result_published");

    const lockedExamIds = new Set<string>();
    const accessibleExamIds = new Set<string>();
    (allExams || []).forEach((ex: any) => {
      const examObj = {
        id: ex.id,
        startTime: ex.start_time,
        endTime: ex.end_time,
        leaderboardEndTime: ex.leaderboard_end_time,
        isResultPublished: ex.is_result_published === true
      } as Exam;
      const isScheduled = !!(ex.start_time && (ex.end_time || ex.leaderboard_end_time));
      if (isScheduled && !isAnswerTimeReached(examObj)) lockedExamIds.add(ex.id);
      const exCourse = String(ex.course || "").trim().toLowerCase();
      const hasCourseAccess =
        studentCourses.includes("all") ||
        studentCourses.includes("সকল কোর্স") ||
        exCourse === "সাধারণ কোর্স" ||
        studentCourses.includes(exCourse);
      if (hasCourseAccess) accessibleExamIds.add(ex.id);
    });

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
      if (tq.exam_key) {
        if (lockedExamIds.has(tq.exam_key)) return;
        if (!accessibleExamIds.has(tq.exam_key)) return;
      }
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

    // Query 2: Fetch from exams & question_bank links — released, accessible exams only
    const { data: dbLinks } = await supabase.from("exam_questions_link").select("exam_id, question_bank(*)");

    for (const link of (dbLinks || [])) {
      const rawQ = link.question_bank;
      const qData: any = Array.isArray(rawQ) ? rawQ[0] : rawQ;
      if (!qData || !qData.q) continue;

      const examId = link.exam_id;
      if (lockedExamIds.has(examId)) continue;
      if (!accessibleExamIds.has(examId)) continue;

      const ex = (allExams || []).find((e: any) => e.id === examId);
      const examSubject = ex?.subject || "পড়াশোনা";

      if (isMatch(qData.topic, examSubject)) {
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

/**
 * Exam keys the student has already submitted — used to mark exams as
 * "সম্পন্ন" (completed) in the student-facing exam lists.
 */
export async function getCompletedExamKeys(
  rawStudentId: string,
  email?: string
): Promise<string[]> {
  try {
    const cleanId = String(rawStudentId || '').trim();
    if (!cleanId) return [];

    // SECURITY: only the student themselves may query their completion list
    if (!(await sessionOwnsStudent(cleanId))) return [];

    const ids = new Set<string>([cleanId, parseBengaliDigits(cleanId).trim()]);

    // Normalize via enrollment lookup so Google users (uid) match their
    // allowed_students id (phone) under which submissions are stored
    const access = await verifyStudentAccess(cleanId, 'ALL', email);
    if (access.normalizedId) ids.add(access.normalizedId);

    const { data } = await supabase
      .from('submissions')
      .select('exam_key')
      .in('student_id', Array.from(ids).filter(Boolean));

    return Array.from(new Set((data || []).map((r) => r.exam_key).filter(Boolean)));
  } catch (err) {
    console.error('Get completed exam keys error:', err);
    return [];
  }
}
