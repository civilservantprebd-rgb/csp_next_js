import { Submission } from "@/types/submission";
import { Exam } from "@/types/exam";
import { getExamSolutions } from "@/actions/exam-actions";

export interface SubjectPerformance {
  subject: string;
  totalQuestions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number; // percentage 0-100
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
 */
export async function calculateStudentAnalytics(
  submissions: Submission[],
  exams: Record<string, Exam>
): Promise<StudentAnalyticsResult> {
  const subjectMap = new Map<
    string,
    { total: number; correct: number; incorrect: number; unanswered: number }
  >();

  let totalQuestionsCount = 0;
  let totalCorrectCount = 0;
  let totalIncorrectCount = 0;
  let totalScoreSum = 0;

  const { isAnswerTimeReached } = await import("@/lib/bangladesh-time");

  for (const sub of submissions) {
    const ex = exams[sub.examKey];
    // If exam is still pending release and result is not published/ended, skip from analytics
    if (ex && !isAnswerTimeReached(ex) && sub.isPendingEvaluation) {
      continue;
    }

    const subjectName = (ex?.subject || "সাধারণ বিষয়").trim();

    totalScoreSum += typeof sub.score === "number" ? sub.score : 0;
    totalCorrectCount += sub.correct || 0;
    totalIncorrectCount += sub.incorrect || 0;
    const subTotal = sub.totalQuestions || (ex?.questions?.length ?? (sub.correct + sub.incorrect));
    totalQuestionsCount += subTotal;

    if (!subjectMap.has(subjectName)) {
      subjectMap.set(subjectName, { total: 0, correct: 0, incorrect: 0, unanswered: 0 });
    }

    const currentSubStats = subjectMap.get(subjectName)!;
    currentSubStats.total += subTotal;
    currentSubStats.correct += sub.correct || 0;
    currentSubStats.incorrect += sub.incorrect || 0;
    currentSubStats.unanswered += Math.max(0, subTotal - (sub.correct + sub.incorrect));
  }

  const subjectBreakdown: SubjectPerformance[] = [];

  subjectMap.forEach((stats, subject) => {
    const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    let status: "strong" | "moderate" | "weak" = "moderate";
    if (accuracy >= 70) status = "strong";
    else if (accuracy < 50) status = "weak";

    subjectBreakdown.push({
      subject,
      totalQuestions: stats.total,
      correct: stats.correct,
      incorrect: stats.incorrect,
      unanswered: stats.unanswered,
      accuracy,
      status
    });
  });

  // Sort by accuracy descending
  subjectBreakdown.sort((a, b) => b.accuracy - a.accuracy);

  const strongestSubject = subjectBreakdown.length > 0 ? subjectBreakdown[0].subject : null;
  const weakestSubject =
    subjectBreakdown.length > 0 ? subjectBreakdown[subjectBreakdown.length - 1].subject : null;

  const overallAccuracy =
    totalQuestionsCount > 0 ? Math.round((totalCorrectCount / totalQuestionsCount) * 100) : 0;

  let recommendation = "নিয়মিত পূর্ণাঙ্গ মডেল টেস্ট ও বিষয়ভিত্তিক কুইজ অনুশীলনের মাধ্যমে প্রস্তুতি বজায় রাখুন।";
  if (weakestSubject && subjectBreakdown.length > 1) {
    const weakestStats = subjectBreakdown[subjectBreakdown.length - 1];
    if (weakestStats.accuracy < 60) {
      recommendation = `আপনার '${weakestSubject}' বিষয়ে ভুলের হার তুলনামূলক বেশি (অ্যাকুরেসি ${weakestStats.accuracy}%)। এই বিষয়ের টপিকগুলোতে বাড়তি অনুশীলন করুন।`;
    }
  }

  return {
    overallScore: submissions.length > 0 ? Number((totalScoreSum / submissions.length).toFixed(1)) : 0,
    totalExams: submissions.length,
    totalAttemptedQuestions: totalQuestionsCount,
    totalCorrect: totalCorrectCount,
    totalIncorrect: totalIncorrectCount,
    overallAccuracy,
    subjectBreakdown,
    strongestSubject,
    weakestSubject,
    recommendation
  };
}
