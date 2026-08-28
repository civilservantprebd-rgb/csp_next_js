import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { Exam, QuestionSolution } from "@/types/exam";
import { Submission, LeaderboardItem } from "@/types/submission";
import { parseBangladeshDateTime, getTrueDate } from "@/lib/bangladesh-time";
import { parseTimeSpentToSeconds } from "@/lib/utils";

export async function getExamSolutions(examKey: string): Promise<QuestionSolution[] | null> {
  try {
    const docSnap = await getDoc(doc(db, "exam_solutions", examKey));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.solutions)) {
        return data.solutions;
      }
    }
  } catch (err) {
    console.error("Error fetching solutions:", err);
  }
  return null;
}

export function isAnswerTimeReached(exam: Exam): boolean {
  if (!exam.answerReleaseTime) return true;
  const releaseTime = parseBangladeshDateTime(exam.answerReleaseTime);
  if (!releaseTime) return true;
  return getTrueDate() >= releaseTime;
}

export function isExamCurrentlyLive(exam: Exam): boolean {
  if (!exam.startTime) return false;
  const now = getTrueDate();
  const startTime = parseBangladeshDateTime(exam.startTime);
  if (!startTime || now < startTime) return false;

  if (exam.answerReleaseTime) {
    const releaseTime = parseBangladeshDateTime(exam.answerReleaseTime);
    if (releaseTime && now >= releaseTime) return false;
  } else if (exam.leaderboardEndTime) {
    const endTime = parseBangladeshDateTime(exam.leaderboardEndTime);
    if (endTime && now >= endTime) return false;
  }
  return true;
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
  score?: number;
  correct?: number;
  incorrect?: number;
  submissionId?: string;
}> {
  try {
    const configSnap = await getDoc(doc(db, "app_config", "bcs_data"));
    const configData = configSnap.data();
    const exam: Exam | undefined = configData?.exams?.[payload.examKey];

    const isLive = exam ? isExamCurrentlyLive(exam) || !isAnswerTimeReached(exam) : false;

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

    const docRef = await addDoc(collection(db, "submissions"), {
      studentName: payload.studentName,
      studentId: payload.studentId,
      examKey: payload.examKey,
      examTitle: payload.examTitle,
      score: isLive ? 0 : score,
      correct: isLive ? 0 : correct,
      incorrect: isLive ? 0 : incorrect,
      totalQuestions: payload.totalQuestions,
      timeSpent: timeFormatted,
      answers: payload.answers,
      isPendingEvaluation: isLive,
      timestamp: serverTimestamp(),
      submittedAtISO: getTrueDate().toISOString()
    });

    return {
      success: true,
      isLive,
      score: isLive ? undefined : score,
      correct: isLive ? undefined : correct,
      incorrect: isLive ? undefined : incorrect,
      submissionId: docRef.id
    };
  } catch (err) {
    console.error("Submit exam error:", err);
    return { success: false, isLive: false };
  }
}

export async function fetchLeaderboard(examKey: string): Promise<LeaderboardItem[]> {
  try {
    const configSnap = await getDoc(doc(db, "app_config", "bcs_data"));
    const configData = configSnap.data();
    const exam: Exam | undefined = configData?.exams?.[examKey];

    if (!exam || !isAnswerTimeReached(exam)) {
      return [];
    }

    const snap = await getDocs(collection(db, "submissions"));
    const subs: Submission[] = [];
    let hasPending = false;

    snap.forEach((d) => {
      const data = d.data() as Submission;
      if (data.examKey === examKey) {
        subs.push(data);
        if (data.isPendingEvaluation || data.score === undefined) {
          hasPending = true;
        }
      }
    });

    if (hasPending) {
      const solutions = await getExamSolutions(examKey);
      if (solutions) {
        subs.forEach((s) => {
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
          }
        });
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
