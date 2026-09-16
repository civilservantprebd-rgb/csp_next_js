import { apiOk, requireStudent, withApi } from "@/lib/api-auth";
import {
  assertExamAccess,
  examToDto,
  fetchExamQuestions,
  loadExam,
  questionsToDto,
} from "@/lib/exam-api";
import { isAnswerTimeReached } from "@/lib/bangladesh-time";
import { getExamSolutions, getMySubmissionResult } from "@/actions/exam-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/exams/{id}/result — API কন্ট্রাক্ট v1 #13 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * নিজের ফলাফল — **শুধু নিজের**। স্কোর DB থেকে (সার্ভার-গণনা করা), ক্লায়েন্টের
 * পুনর্গণনা নয়।
 *
 * ── উত্তর-কী গেট (fail-closed) ──
 * `isAnswerTimeReached(exam)` false হলে `solutions: null` — অর্থাৎ প্রশ্নের
 * সঠিক উত্তর ও ব্যাখ্যা **কখনো** যায় না। প্রকাশের সময় = `endTime + পুরো
 * পরীক্ষার দৈর্ঘ্য` (README-তে "১০ সেকেন্ড" লেখা, কিন্তু `LIVE_GRACE_MS` শুধু
 * সাবমিশন শ্রেণীবিন্যাসের সীমা — উত্তর-রিলিজ অনেক পরে, যা বেশি কঠোর ও নিরাপদ)।
 * শিক্ষক ম্যানুয়ালি publish করলে (`is_result_published`) সঙ্গে সঙ্গে।
 *
 * ফলাফল এখনো প্রকাশ না পেলে 403 নয় — বরং `isAnswersReleased: false` সহ 200,
 * কিন্তু `solutions: null` ও স্কোর `null`-ও হতে পারে (pending evaluation)।
 * অ্যাপ তখন "ফলাফল প্রকাশিত হয়নি" স্ক্রিন দেখাবে।
 */
export const GET = withApi<RouteParams>("student", async (ctx, _req, routeCtx) => {
  const identity = requireStudent(ctx);
  const examId = routeCtx.params?.id;

  const exam = await loadExam(examId);
  const access = await assertExamAccess(exam, identity);

  const released = isAnswerTimeReached(exam);

  // স্কোর ও নিজের উত্তর — সার্ভার-সংরক্ষিত সারি থেকে।
  // `access.studentId` পাঠানো হচ্ছে (uid নয়): পেইড পরীক্ষার সাবমিশন রোস্টার-আইডিতে
  // (ফোন-আইডি) সংরক্ষিত হয়, আর getMySubmissionResult ওই id-তেই খোঁজে।
  const mine = await getMySubmissionResult(examId, access.studentId);

  if (!mine) {
    return apiOk({
      exam: examToDto(exam, Date.now()),
      submitted: false,
      result: null,
      solutions: null,
      review: null,
    });
  }

  // উত্তর-কী কেবল প্রকাশের পরে। প্রশ্নগুলো এখানে **রিভিউয়ের জন্য** আসে,
  // তাই প্রশ্ন + (রিলিজ হলে) উত্তর পাশাপাশি বসানো হয়।
  const solutions = released ? await getExamSolutions(examId) : null;
  const questions = solutions ? await fetchExamQuestions(examId) : [];

  const review =
    solutions && questions.length > 0
      ? questionsToDto(questions).map((q) => ({
          order: q.order,
          id: q.id,
          q: q.q,
          opts: q.opts,
          topic: q.topic,
          /** শিক্ষার্থীর দেওয়া উত্তর (null = ছেড়ে দেওয়া) */
          chosen: mine.answers[q.order] ?? null,
          /** সঠিক অপশন-সূচক — শুধু প্রকাশের পরে */
          correct: solutions[q.order]?.correct ?? null,
          explanation: solutions[q.order]?.exp || "",
        }))
      : null;

  return apiOk({
    exam: examToDto(exam, Date.now()),
    submitted: true,
    isAnswersReleased: released,
    result: {
      score: mine.score,
      correct: mine.correct,
      incorrect: mine.incorrect,
      totalQuestions: questions.length || mine.answers.length,
      answers: mine.answers,
      isPendingEvaluation: mine.isPendingEvaluation,
      isLiveSubmission: mine.isLiveSubmission,
      submittedAtISO: mine.submittedAtISO,
      passMark: exam.passMark ?? 0,
      isPassed: mine.score >= (exam.passMark ?? 1),
    },
    // reliz না হলে null — উপরের নিয়ম
    solutions: solutions
      ? solutions.map((s, idx) => ({ order: idx, correct: s.correct, explanation: s.exp || "" }))
      : null,
    review,
  });
});
