"use server";

import { supabase } from "@/lib/supabase";
import { Exam, QuestionSolution } from "@/types/exam";
import { Submission, LeaderboardItem } from "@/types/submission";
import { parseBangladeshDateTime, getTrueDate } from "@/lib/bangladesh-time";
import { parseTimeSpentToSeconds, parseBengaliDigits } from "@/lib/utils";

export async function getExamSolutions(examKey: string): Promise<QuestionSolution[] | null> {
  try {
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

    const { isExamCurrentlyLive, isAnswerTimeReached } = await import("@/lib/bangladesh-time");
    const isLiveSubmission = exam ? isExamCurrentlyLive(exam) : false;

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

    const isLive = isLiveSubmission && exam ? !isAnswerTimeReached(exam) : false;

    const timeSpentSecs = payload.examTimerMinutes * 60 - payload.timeRemaining;
    const mins = Math.floor(timeSpentSecs / 60);
    const secs = timeSpentSecs % 60;
    const timeFormatted = `${mins} মি. ${secs} সে.`;

    let correct = 0;
    let incorrect = 0;
    let score = 0;

    if (!isLive) {
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

    const { data: subData, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("exam_key", examKey)
      .eq("is_live_submission", true);

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
