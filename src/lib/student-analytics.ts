import { Submission } from "@/types/submission";
import { Exam } from "@/types/exam";

export interface SubjectPerformance {
  subject: string;
  totalQuestions: number;
  totalAttempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number; // percentage 0-100 based on attempted/marked questions
  status: "strong" | "moderate" | "weak";
}

export interface StudentAnalyticsResult {
  overallScore: number;
  totalExams: number;
  totalAttemptedQuestions: number;
  totalCorrect: number;
  totalIncorrect: number;
  overallAccuracy: number;
  subjectBreakdown: SubjectPerformance[];
  strongestSubject: string | null;
  weakestSubject: string | null;
  recommendation: string;
}

/**
 * Calculate comprehensive subject performance and weakness analysis for a student
 * strictly based on questions attempted/marked during LIVE exams.
 */
export async function calculateStudentAnalytics(
  submissions: Submission[],
  exams: Record<string, Exam>
): Promise<StudentAnalyticsResult> {
  const { isAnswerTimeReached } = await import("@/lib/bangladesh-time");

  // ১. কেবল লাইভ পরীক্ষায় অংশগ্রহণকৃত সাবমিশনগুলো ফিল্টার করি
  const liveSubmissions = (submissions || []).filter((sub) => {
    const ex = exams[sub.examKey];
    // রেজাল্ট প্রকাশের আগে পেন্ডিং থাকা সাবমিশন বাদ
    if (ex && !isAnswerTimeReached(ex) && sub.isPendingEvaluation) {
      return false;
    }
    // লাইভ সাবমিশন নিশ্চিতকরণ (isLiveSubmission === true অথবা শিডিউলড লাইভ পরীক্ষা যেখানে প্র্যাকটিস ফ্ল্যাগ ফলস নয়)
    return sub.isLiveSubmission === true || (sub.isLiveSubmission !== false && !!(ex?.startTime && ex?.endTime));
  });

  if (liveSubmissions.length === 0) {
    return {
      overallScore: 0,
      totalExams: 0,
      totalAttemptedQuestions: 0,
      totalCorrect: 0,
      totalIncorrect: 0,
      overallAccuracy: 0,
      subjectBreakdown: [],
      strongestSubject: null,
      weakestSubject: null,
      recommendation: "আপনি এখনো কোনো লাইভ পরীক্ষায় অংশ নেননি। লাইভ পরীক্ষায় অংশ নিয়ে প্রশ্ন দাগালে এখানে বিষয়ভিত্তিক লাইভ এনালাইসিস দেখতে পাবেন।"
    };
  }

  const subjectMap = new Map<
    string,
    { totalAttempted: number; totalQuestions: number; correct: number; incorrect: number; unanswered: number }
  >();

  let totalAttemptedQuestionsCount = 0;
  let totalCorrectCount = 0;
  let totalIncorrectCount = 0;
  let totalScoreSum = 0;

  for (const sub of liveSubmissions) {
    const ex = exams[sub.examKey];
    const subjectName = (ex?.subject || "সাধারণ বিষয়").trim();

    // দাগানো প্রশ্ন (Attempted Questions) = সঠিক + ভুল
    const attempted = (sub.correct || 0) + (sub.incorrect || 0);
    const subTotal = sub.totalQuestions || (ex?.questions?.length ?? attempted);

    totalScoreSum += typeof sub.score === "number" ? sub.score : 0;
    totalCorrectCount += sub.correct || 0;
    totalIncorrectCount += sub.incorrect || 0;
    totalAttemptedQuestionsCount += attempted;

    if (!subjectMap.has(subjectName)) {
      subjectMap.set(subjectName, {
        totalAttempted: 0,
        totalQuestions: 0,
        correct: 0,
        incorrect: 0,
        unanswered: 0
      });
    }

    const currentSubStats = subjectMap.get(subjectName)!;
    currentSubStats.totalAttempted += attempted;
    currentSubStats.totalQuestions += subTotal;
    currentSubStats.correct += sub.correct || 0;
    currentSubStats.incorrect += sub.incorrect || 0;
    currentSubStats.unanswered += Math.max(0, subTotal - attempted);
  }

  const subjectBreakdown: SubjectPerformance[] = [];

  subjectMap.forEach((stats, subject) => {
    // শুধুমাত্র দাগানো প্রশ্নের ভিত্তিতে অ্যাকুরেসি নির্ণয়
    const accuracy = stats.totalAttempted > 0 ? Math.round((stats.correct / stats.totalAttempted) * 100) : 0;
    let status: "strong" | "moderate" | "weak" = "moderate";
    if (stats.totalAttempted === 0) {
      status = "moderate";
    } else if (accuracy >= 70) {
      status = "strong";
    } else if (accuracy < 50) {
      status = "weak";
    }

    subjectBreakdown.push({
      subject,
      totalQuestions: stats.totalQuestions,
      totalAttempted: stats.totalAttempted,
      correct: stats.correct,
      incorrect: stats.incorrect,
      unanswered: stats.unanswered,
      accuracy,
      status
    });
  });

  // যেসব বিষয়ে প্রশ্ন দাগানো হয়েছে সেগুলোকে প্রাধান্য দিয়ে অ্যাকুরেসি অনুসারে সাজানো
  subjectBreakdown.sort((a, b) => {
    if (a.totalAttempted > 0 && b.totalAttempted === 0) return -1;
    if (a.totalAttempted === 0 && b.totalAttempted > 0) return 1;
    return b.accuracy - a.accuracy;
  });

  // শুধুমাত্র দাগানো হয়েছে এমন বিষয়গুলোর মধ্য থেকে শক্তিশালী ও দুর্বল বিষয় নির্বাচন
  const attemptedSubjects = subjectBreakdown.filter((s) => s.totalAttempted > 0);
  const strongestSubject = attemptedSubjects.length > 0 ? attemptedSubjects[0].subject : null;
  const weakestSubject =
    attemptedSubjects.length > 0 ? attemptedSubjects[attemptedSubjects.length - 1].subject : null;

  // সার্বিক অ্যাকুরেসি = (মোট সঠিক উত্তর / মোট দাগানো প্রশ্ন) * ১০০
  const overallAccuracy =
    totalAttemptedQuestionsCount > 0
      ? Math.round((totalCorrectCount / totalAttemptedQuestionsCount) * 100)
      : 0;

  let recommendation = "নিয়মিত লাইভ মডেল টেস্ট অনুশীলনের মাধ্যমে প্রস্তুতি বজায় রাখুন।";
  if (weakestSubject && attemptedSubjects.length > 1) {
    const weakestStats = attemptedSubjects[attemptedSubjects.length - 1];
    if (weakestStats.accuracy < 60) {
      recommendation = `লাইভ পরীক্ষায় আপনার '${weakestSubject}' বিষয়ে দাগানো প্রশ্নের ভুলের হার তুলনামূলক বেশি (অ্যাকুরেসি ${weakestStats.accuracy}%)। এই বিষয়ের টপিকগুলোতে বাড়তি অনুশীলন করুন।`;
    } else {
      recommendation = "চমৎকার প্রস্তুতি! লাইভ পরীক্ষায় দাগানো প্রশ্নসমূহে আপনার অ্যাকুরেসি সন্তোষজনক। নিয়মিত অনুশীলন বজায় রাখুন।";
    }
  }

  return {
    overallScore: liveSubmissions.length > 0 ? Number((totalScoreSum / liveSubmissions.length).toFixed(1)) : 0,
    totalExams: liveSubmissions.length,
    totalAttemptedQuestions: totalAttemptedQuestionsCount,
    totalCorrect: totalCorrectCount,
    totalIncorrect: totalIncorrectCount,
    overallAccuracy,
    subjectBreakdown,
    strongestSubject,
    weakestSubject,
    recommendation
  };
}
