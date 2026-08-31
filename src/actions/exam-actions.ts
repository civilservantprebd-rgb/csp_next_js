"use server";

import { supabase } from "@/lib/supabase";
import { Exam, QuestionSolution } from "@/types/exam";
import { Submission, LeaderboardItem } from "@/types/submission";
import { parseBangladeshDateTime, getTrueDate } from "@/lib/bangladesh-time";
import { parseTimeSpentToSeconds, parseBengaliDigits } from "@/lib/utils";

export async function getExamSolutions(examKey: string): Promise<QuestionSolution[] | null> {
  try {
    // SECURITY: never leak the answer key while a live exam is running (unless caller is a verified teacher)
    const { isTeacherSession } = await import("@/lib/teacher-auth");
    if (!(await isTeacherSession())) {
      const { data: examData } = await supabase
        .from("exams")
        .select("start_time, end_time, leaderboard_end_time, is_result_published")
        .eq("id", examKey)
        .maybeSingle();
      if (examData) {
        const { isExamCurrentlyLive } = await import("@/lib/bangladesh-time");
        const exam = {
          startTime: examData.start_time,
          endTime: examData.end_time,
          leaderboardEndTime: examData.leaderboard_end_time,
          isResultPublished: examData.is_result_published === true
        } as Exam;
        if (isExamCurrentlyLive(exam)) return null;
      }
    }

    // 1. Fetch from question_bank via exam_questions_link
    const { data: links, error: linkError } = await supabase
      .from("exam_questions_link")
      .select("order_index, question_bank(correct, exp)")
      .eq("exam_id", examKey)
      .order("order_index", { ascending: true });

    if (!linkError && links && links.length > 0) {
      return links.map((l: any) => ({
        correct: Number(l.question_bank?.correct ?? 0),
        exp: l.question_bank?.exp || ""
      }));
    }

    // 2. Fallback to exam_questions view if any
    const { data, error } = await supabase
      .from("exam_questions")
      .select("correct, exp")
      .eq("exam_id", examKey)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data || []).map((r) => ({
      correct: Number(r.correct),
      exp: r.exp || ""
    }));
  } catch (err) {
    console.error("Error fetching solutions:", err);
  }
  return null;
}

export async function checkStudentAlreadySubmitted(
  examKey: string,
  rawStudentId: string
): Promise<boolean> {
  try {
    const cleanId = String(rawStudentId || "").trim();
    const normId = parseBengaliDigits(cleanId).trim();
    if (!cleanId) return false;

    const ids = Array.from(new Set([cleanId, normId])).filter(Boolean);

    const { data, error } = await supabase
      .from("submissions")
      .select("student_id")
      .eq("exam_key", examKey)
      .in("student_id", ids);

    if (error) throw error;

    return (data || []).length > 0;
  } catch (err) {
    console.error("Check student submission error:", err);
    return false;
  }
}

export async function submitExamAnswers(payload: {
  studentName: string;
  studentId: string;
  examKey: string;
  examTitle: string;
  examTimerMinutes: number;
  timeRemaining: number;
  answers: (number | null)[];
  totalQuestions: number;
}): Promise<{
  success: boolean;
  isLive: boolean;
  isLiveSubmission?: boolean;
  score?: number;
  correct?: number;
  incorrect?: number;
  submissionId?: string;
  message?: string;
}> {
  try {
    // Fetch exam info
    const { data: examData, error: examError } = await supabase
      .from("exams")
      .select("*")
      .eq("id", payload.examKey)
      .maybeSingle();

    if (examError) throw examError;

    const exam: Exam | undefined = examData
      ? {
        id: examData.id,
        course: examData.course,
        subject: examData.subject,
        title: examData.title,
        timerMinutes: examData.timer_minutes,
        isFree: examData.is_free,
        passMark: Number(examData.pass_mark),
        startTime: examData.start_time,
        endTime: examData.end_time,
        isResultPublished: examData.is_result_published,
        leaderboardStartTime: examData.leaderboard_start_time,
        leaderboardEndTime: examData.leaderboard_end_time
      }
      : undefined;

    const { parseBangladeshDateTime, getTrueDate } = await import("@/lib/bangladesh-time");
    const now = getTrueDate();

    // Check if exam is configured as a scheduled live exam (has startTime and endTime)
    const startTime = exam?.startTime ? parseBangladeshDateTime(exam.startTime) : null;
    const endTime = exam?.endTime ? parseBangladeshDateTime(exam.endTime) : (exam?.leaderboardEndTime ? parseBangladeshDateTime(exam.leaderboardEndTime) : null);

    // Is submitted within live scheduled window
    const isLiveSubmission = (startTime && endTime) 
      ? (now >= startTime && now <= endTime)
      : false;

    if (isLiveSubmission) {
      const alreadySubmitted = await checkStudentAlreadySubmitted(payload.examKey, payload.studentId);
      if (alreadySubmitted) {
        return {
          success: false,
          isLive: true,
          message: "আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক আইডি দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।"
        };
      }
    }

    const { isAnswerTimeReached } = await import("@/lib/bangladesh-time");
    // isLive: if currently in live window and results are not published yet
    const isLive = isLiveSubmission && exam ? !isAnswerTimeReached(exam) : false;

    const timeSpentSecs = payload.examTimerMinutes * 60 - payload.timeRemaining;
    const mins = Math.floor(timeSpentSecs / 60);
    const secs = timeSpentSecs % 60;
    const timeFormatted = `${mins} মি. ${secs} সে.`;

    let correct = 0;
    let incorrect = 0;
    let score = 0;

    // Always fetch solutions and compute score (stored in DB or returned when published)
    const solutions = await getExamSolutions(payload.examKey);
    if (solutions) {
      payload.answers.forEach((ans, idx) => {
        const sol = solutions[idx];
        if (ans !== null && sol) {
          if (ans === sol.correct) correct++;
          else incorrect++;
        }
      });
      score = Math.max(0, correct - incorrect * 0.5);
    }

    const { data: newSub, error: insertError } = await supabase
      .from("submissions")
      .insert({
        student_name: payload.studentName,
        student_id: payload.studentId,
        exam_key: payload.examKey,
        exam_title: payload.examTitle,
        score: isLive ? 0 : score,
        correct: isLive ? 0 : correct,
        incorrect: isLive ? 0 : incorrect,
        total_questions: payload.totalQuestions,
        time_spent: timeFormatted,
        answers: payload.answers.map((v) => (v === null ? -1 : v)),
        is_pending_evaluation: isLive,
        is_live_submission: isLiveSubmission,
        submitted_at: getTrueDate().toISOString()
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return {
      success: true,
      isLive,
      isLiveSubmission,
      score: isLive ? undefined : score,
      correct: isLive ? undefined : correct,
      incorrect: isLive ? undefined : incorrect,
      submissionId: newSub.id
    };
  } catch (err) {
    console.error("Submit exam error:", err);
    return { success: false, isLive: false, message: "উত্তরপত্র জমা দিতে ত্রুটি হয়েছে।" };
  }
}

export async function fetchLeaderboard(examKey: string): Promise<LeaderboardItem[]> {
  try {
    const { data: examData, error: examError } = await supabase
      .from("exams")
      .select("*")
      .eq("id", examKey)
      .maybeSingle();

    if (examError) throw examError;

    const { isAnswerTimeReached } = await import("@/lib/bangladesh-time");
    const exam: Exam | undefined = examData
      ? {
        id: examData.id,
        course: examData.course,
        subject: examData.subject,
        title: examData.title,
        timerMinutes: examData.timer_minutes,
        isFree: examData.is_free,
        passMark: Number(examData.pass_mark),
        startTime: examData.start_time,
        endTime: examData.end_time,
        isResultPublished: examData.is_result_published,
        leaderboardStartTime: examData.leaderboard_start_time,
        leaderboardEndTime: examData.leaderboard_end_time
      }
      : undefined;

    if (!exam || !isAnswerTimeReached(exam)) {
      return [];
    }

    const hasScheduledTime = !!(exam.startTime && (exam.endTime || exam.leaderboardEndTime));

    let query = supabase
      .from("submissions")
      .select("*")
      .eq("exam_key", examKey);

    if (hasScheduledTime) {
      query = query.eq("is_live_submission", true);
    }

    const { data: subData, error: subError } = await query;

    if (subError) throw subError;

    const subs: Submission[] = (subData || []).map((row) => ({
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

    let hasPending = subs.some((s) => s.isPendingEvaluation || s.score === undefined);

    if (hasPending) {
      const solutions = await getExamSolutions(examKey);
      if (solutions) {
        for (const s of subs) {
          if ((s.isPendingEvaluation || s.score === undefined) && s.answers) {
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

            // Save evaluated score back to Supabase
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
    }

    subs.sort((a, b) => {
      const scoreA = typeof a.score === "number" ? a.score : parseFloat(a.score) || 0;
      const scoreB = typeof b.score === "number" ? b.score : parseFloat(b.score) || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;

      const timeA = parseTimeSpentToSeconds(a.timeSpent);
      const timeB = parseTimeSpentToSeconds(b.timeSpent);
      if (timeA !== timeB) return timeA - timeB;

      return String(a.studentName || "").localeCompare(String(b.studentName || ""), "bn");
    });

    const passMark = exam.passMark ?? 1;

    return subs.map((s, idx) => ({
      rank: idx + 1,
      studentName: s.studentName || "নামবিহীন শিক্ষার্থী",
      studentId: s.studentId,
      timeSpent: s.timeSpent || "—",
      score: s.score ?? 0,
      isPassed: (s.score ?? 0) >= passMark
    }));
  } catch (err) {
    console.error("Fetch leaderboard error:", err);
    return [];
  }
}

export async function getExamCandidateRank(
  examKey: string,
  userScore: number,
  userTimeSpent: string
): Promise<{ practiceRank: number; totalCandidates: number; officialCandidates: number }> {
  try {
    const { data: subData, error } = await supabase
      .from("submissions")
      .select("score, time_spent, is_live_submission")
      .eq("exam_key", examKey);

    if (error) throw error;

    const allSubs: { score: number; timeSecs: number; isLive: boolean }[] = [];
    let officialCount = 0;

    (subData || []).forEach((row) => {
      let sc = typeof row.score === "number" ? row.score : parseFloat(row.score as any) || 0;
      const isLive = row.is_live_submission !== false;
      if (isLive) officialCount++;
      allSubs.push({
        score: sc,
        timeSecs: parseTimeSpentToSeconds(row.time_spent),
        isLive
      });
    });

    const userTimeSecs = parseTimeSpentToSeconds(userTimeSpent);

    let higherCount = 0;
    allSubs.forEach((sub) => {
      if (sub.score > userScore) {
        higherCount++;
      } else if (sub.score === userScore && sub.timeSecs < userTimeSecs) {
        higherCount++;
      }
    });

    const practiceRank = higherCount + 1;
    return {
      practiceRank,
      totalCandidates: Math.max(1, allSubs.length),
      officialCandidates: officialCount
    };
  } catch (err) {
    console.error("Error calculating candidate rank:", err);
    return { practiceRank: 1, totalCandidates: 1, officialCandidates: 0 };
  }
}

/**
 * Returns the student's own stored submission result from the database.
 * Used by the result page so the displayed score is the server-computed one,
 * not a client-side re-computation of editable sessionStorage data.
 */
export async function getMySubmissionResult(
  examKey: string,
  studentId: string
): Promise<{
  score: number;
  correct: number;
  incorrect: number;
  answers: (number | null)[];
  isPendingEvaluation: boolean;
  isLiveSubmission: boolean;
  submittedAtISO: string;
} | null> {
  try {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return null;
    const normId = parseBengaliDigits(cleanId).trim();
    const ids = Array.from(new Set([cleanId, normId])).filter(Boolean);

    const { data, error } = await supabase
      .from("submissions")
      .select("*")
      .eq("exam_key", examKey)
      .in("student_id", ids)
      .order("submitted_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    const row = data?.[0];
    if (!row) return null;

    return {
      score: Number(row.score ?? 0),
      correct: Number(row.correct ?? 0),
      incorrect: Number(row.incorrect ?? 0),
      answers: Array.isArray(row.answers)
        ? row.answers.map((v: any) => (v === -1 || v === null ? null : Number(v)))
        : [],
      isPendingEvaluation: !!row.is_pending_evaluation,
      isLiveSubmission: !!row.is_live_submission,
      submittedAtISO: row.submitted_at || ""
    };
  } catch (err) {
    console.error("Get my submission result error:", err);
    return null;
  }
}

/**
 * Per-question live-exam statistics: how many students answered this question
 * correctly / wrongly / skipped during LIVE exams. Used by the topic reading
 * "এনালাইসিস" section (pie chart).
 */
export async function getQuestionLiveStats(
  qText: string
): Promise<{ correct: number; wrong: number; skipped: number; total: number }> {
  const zero = { correct: 0, wrong: 0, skipped: 0, total: 0 };
  try {
    const cleanQ = String(qText || "").trim();
    if (!cleanQ) return zero;

    // Find this question in the bank (exact text match)
    const { data: qRows } = await supabase
      .from("question_bank")
      .select("id, correct")
      .eq("q", cleanQ)
      .limit(20);
    if (!qRows || qRows.length === 0) return zero;

    const correctMap = new Map<string, number>();
    qRows.forEach((r) => correctMap.set(r.id, Number(r.correct)));

    // Exams that contain these questions
    const { data: links } = await supabase
      .from("exam_questions_link")
      .select("exam_id, question_id, order_index")
      .in("question_id", qRows.map((r) => r.id));
    if (!links || links.length === 0) return zero;

    const examIds = Array.from(new Set(links.map((l) => l.exam_id)));
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    for (const examId of examIds) {
      const { data: subs } = await supabase
        .from("submissions")
        .select("answers")
        .eq("exam_key", examId)
        .eq("is_live_submission", true);

      const examLinks = links.filter((l) => l.exam_id === examId);
      for (const s of subs || []) {
        for (const link of examLinks) {
          const ans = Array.isArray(s.answers) ? s.answers[link.order_index] : null;
          if (ans === null || ans === undefined || ans === -1) {
            skipped++;
          } else if (Number(ans) === correctMap.get(link.question_id)) {
            correct++;
          } else {
            wrong++;
          }
        }
      }
    }

    return { correct, wrong, skipped, total: correct + wrong + skipped };
  } catch (err) {
    console.error("Get question live stats error:", err);
    return zero;
  }
}
