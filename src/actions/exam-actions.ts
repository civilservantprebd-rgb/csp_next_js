"use server";

import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where
} from "firebase/firestore";
import { Exam, QuestionSolution } from "@/types/exam";
import { Submission, LeaderboardItem } from "@/types/submission";
import { parseBangladeshDateTime, getTrueDate, isAnswerTimeReached, isExamCurrentlyLive } from "@/lib/bangladesh-time";
import { parseTimeSpentToSeconds, parseBengaliDigits } from "@/lib/utils";

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


export async function checkStudentAlreadySubmitted(
  examKey: string,
  rawStudentId: string
): Promise<boolean> {
  try {
    const cleanId = String(rawStudentId || "").trim();
    const normId = parseBengaliDigits(cleanId).trim();
    if (!cleanId) return false;

    const q = query(collection(db, "submissions"), where("examKey", "==", examKey));
    const snap = await getDocs(q);
    let found = false;

    snap.forEach((d) => {
      const data = d.data() as Submission;
      const subSid = String(data.studentId || "").trim();
      const subNorm = parseBengaliDigits(subSid).trim();
      if (
        subSid === cleanId ||
        (normId && subNorm === normId) ||
        (normId.length >= 10 && subNorm.endsWith(normId.slice(-10))) ||
        (subNorm.length >= 10 && normId.endsWith(subNorm.slice(-10)))
      ) {
        found = true;
      }
    });

    return found;
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
    const configSnap = await getDoc(doc(db, "app_config", "bcs_data"));
    const configData = configSnap.data();
    const exam: Exam | undefined = configData?.exams?.[payload.examKey];

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
      isLiveSubmission: isLiveSubmission,
      timestamp: serverTimestamp(),
      submittedAtISO: getTrueDate().toISOString()
    });

    return {
      success: true,
      isLive,
      isLiveSubmission,
      score: isLive ? undefined : score,
      correct: isLive ? undefined : correct,
      incorrect: isLive ? undefined : incorrect,
      submissionId: docRef.id
    };
  } catch (err) {
    console.error("Submit exam error:", err);
    return { success: false, isLive: false, message: "উত্তরপত্র জমা দিতে ত্রুটি হয়েছে।" };
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

    const q = query(collection(db, "submissions"), where("examKey", "==", examKey));
    const snap = await getDocs(q);
    const subs: Submission[] = [];
    let hasPending = false;

    snap.forEach((d) => {
      const data = d.data() as Submission;
      if (data.isLiveSubmission !== false) {
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

export async function getExamCandidateRank(
  examKey: string,
  userScore: number,
  userTimeSpent: string
): Promise<{ practiceRank: number; totalCandidates: number; officialCandidates: number }> {
  try {
    const q = query(collection(db, "submissions"), where("examKey", "==", examKey));
    const snap = await getDocs(q);
    const allSubs: { score: number; timeSecs: number; isLive: boolean }[] = [];
    let officialCount = 0;

    snap.forEach((d) => {
      const data = d.data() as Submission;
      let sc = typeof data.score === "number" ? data.score : parseFloat(data.score as any) || 0;
      if (data.isLiveSubmission !== false) officialCount++;
      allSubs.push({
        score: sc,
        timeSecs: parseTimeSpentToSeconds(data.timeSpent),
        isLive: data.isLiveSubmission !== false
      });
    });

    const userTimeSecs = parseTimeSpentToSeconds(userTimeSpent);

    // Calculate how many candidates have higher score or better time
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
