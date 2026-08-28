"use server";

import { supabase } from "@/lib/supabase";
import { AllowedStudent } from "@/types/student";
import { Submission } from "@/types/submission";
import { parseBengaliDigits } from "@/lib/utils";
import { getExamSolutions } from "@/actions/exam-actions";
import { getTrueDate } from "@/lib/bangladesh-time";

export async function verifyStudentAccess(
  rawStudentId: string,
  examCourse: string
): Promise<{ allowed: boolean; studentName?: string; normalizedId?: string; message?: string }> {
  const cleanId = String(rawStudentId).trim();
  const normalizedId = parseBengaliDigits(cleanId).trim();

  if (!cleanId) {
    return { allowed: false, message: "দয়া করে স্টুডেন্ট আইডি প্রদান করুন।" };
  }

  try {
    let matchedStudent: AllowedStudent | null = null;

    // 1. Direct match by raw ID or normalized ID
    const { data: student } = await supabase
      .from("allowed_students")
      .select("*")
      .or(`id.eq.${cleanId},id.eq.${normalizedId}`)
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

        if (
          docSid === cleanId ||
          docNormSid === normalizedId ||
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
    const normalizedCourses = Array.isArray(studentCourses) ? studentCourses : [studentCourses];
    const targetCourse = (examCourse || "").trim();

    const hasCourseAccess =
      !targetCourse ||
      targetCourse === "ALL" ||
      targetCourse === "সাধারণ কোর্স" ||
      normalizedCourses.some((c) => {
        if (!c) return false;
        const sc = String(c).trim().toLowerCase();
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
      courses: row.courses || []
    }));
  } catch (err) {
    console.error("Fetch all allowed students error:", err);
    return [];
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
