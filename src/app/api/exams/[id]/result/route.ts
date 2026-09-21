import { apiOk, requireStudent, withApi } from "@/lib/api-auth";
import {
  assertExamAccess,
  examToDto,
  fetchExamQuestions,
  loadExam,
  questionsToDto,
} from "@/lib/exam-api";
import { isAnswerTimeReached } from "@/lib/bangladesh-time";
import { getExamSolutions, getMySubmissions, getExamCandidateRanks } from "@/actions/exam-actions";

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
  // (ফোন-আইডি) সংরক্ষিত হয়, আর getMySubmissions ওই id-তেই খোঁজে।
  //
  // ⚠️ **একই পরীক্ষার সব সাবমিশন** আনা হচ্ছে, কেবল সর্বশেষটা নয় (২০২৬-০৯-২১)।
  // কারণ: লাইভ পরীক্ষার পরে শিক্ষার্থী যতবার খুশি প্র্যাকটিস দিতে পারে, আর
  // তখন সর্বশেষ সারিটা প্র্যাকটিসের — ফলে আগে **লাইভ ফলটা পর্দা থেকে হারিয়ে
  // যেত**। ওয়েবের ড্যাশবোর্ড দুইটাই দেখায় (`StudentDashboardModal.tsx` →
  // `লাইভ: …` · `প্র্যাকটিস: …`), তাই অ্যাপেও দুইটাই পাঠানো হয়।
  const submissions = await getMySubmissions(examId, access.studentId);

  if (submissions.length === 0) {
    return apiOk({
      exam: examToDto(exam, Date.now()),
      submitted: false,
      result: null,
      liveResult: null,
      practiceResult: null,
      solutions: null,
      review: null,
    });
  }

  // `result` = সর্বশেষ সাবমিশন — **পুরোনো আচরণ অপরিবর্তিত** (রিভিউ এর answers
  // ধরে আঁকা হয়, আর পুরোনো ক্লায়েন্টও ঠিক এটাই পড়ে)।
  const mine = submissions[0];

  // লাইভ ও প্র্যাকটিস — প্রতিটির **একটাই** ফল দেখানো হয়: লাইভ একবারই দেওয়া যায়
  // (সার্ভার দ্বিতীয়বার `ALREADY_SUBMITTED` ফেরায়), আর প্র্যাকটিসের সর্বশেষটাই
  // ("শেষের ফলাফলই গন্য")। কিছুই মোছা হয় না — পুরোনো অ্যাটেম্পট সার্ভারে থাকে,
  // ওয়েবও মোছে না; কেবল এখানে দেখানো হয় সর্বশেষটা।
  const liveRow = submissions.find((s) => s.isLiveSubmission) ?? null;
  const practiceRow = submissions.find((s) => !s.isLiveSubmission) ?? null;
  const liveCount = submissions.filter((s) => s.isLiveSubmission).length;
  const practiceCount = submissions.length - liveCount;

  // র্যাঙ্ক — দুই সারির জন্যই, তবু **এক কুয়েরিতে** (`getExamCandidateRanks`
  // একই examKey একাধিকবার চাইলে ডিডিউপ করে, তাই বাড়তি খরচ নেই)।
  const rankTargets: { examKey: string; score: number; timeSpent: string }[] = [];
  if (liveRow) rankTargets.push({ examKey: examId, score: liveRow.score, timeSpent: liveRow.timeSpent });
  if (practiceRow) rankTargets.push({ examKey: examId, score: practiceRow.score, timeSpent: practiceRow.timeSpent });
  const ranks = rankTargets.length > 0 ? await getExamCandidateRanks(rankTargets) : [];
  const rankAt = (i: number) =>
    ranks[i] ? { position: ranks[i].practiceRank, participants: ranks[i].totalCandidates } : { position: 0, participants: 0 };

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

  const totalQuestions = questions.length || mine.answers.length;

  /** একটাই ফলের ব্লক — স্কোর + অবস্থান (র্যাঙ্ক) + তারিখ + কতবার দিয়েছে। */
  const resultBlock = (
    row: (typeof submissions)[number] | null,
    rank: { position: number; participants: number },
    attempts: number
  ) =>
    row
      ? {
          score: row.score,
          correct: row.correct,
          incorrect: row.incorrect,
          totalQuestions,
          isPendingEvaluation: row.isPendingEvaluation,
          submittedAtISO: row.submittedAtISO,
          position: rank.position,
          participants: rank.participants,
          attempts,
          /**
           * প্রশ্ন-ক্রম অনুযায়ী শিক্ষার্থীর দেওয়া উত্তর (`null` = ছেড়ে দেওয়া)।
           *
           * ⚠️ কেন এখানে: অ্যাপে এখন লাইভ ও প্র্যাকটিস — দুইটা আলাদা অপশন, আর
           * প্রতিটির ভেতরে **নিজের** প্রশ্নভিত্তিক বিস্তারিত (কোনটা ঠিক, কোনটা
           * ভুল) দেখানো হয়। প্রশ্ন + সঠিক উত্তর + ব্যাখ্যা উপরে `review`-এ
           * **একবারই** যায়; দুইবার পাঠালে ২০০-প্রশ্নের পরীক্ষায় পেলোড দ্বিগুণ
           * হতো। অ্যাপ এই `answers` দিয়ে `review`-এর সাথে মিলিয়ে নিজের রিভিউ বানায়।
           */
          answers: row.answers,
        }
      : null;

  return apiOk({
    exam: examToDto(exam, Date.now()),
    submitted: true,
    isAnswersReleased: released,
    result: {
      score: mine.score,
      correct: mine.correct,
      incorrect: mine.incorrect,
      totalQuestions,
      answers: mine.answers,
      isPendingEvaluation: mine.isPendingEvaluation,
      isLiveSubmission: mine.isLiveSubmission,
      submittedAtISO: mine.submittedAtISO,
      passMark: exam.passMark ?? 0,
      isPassed: mine.score >= (exam.passMark ?? 1),
    },
    // ⭐ দুইটা ফল — বাঁয়ে লাইভ (একটাই), ডানে প্র্যাকটিস (সর্বশেষটা)
    liveResult: resultBlock(liveRow, rankAt(0), liveCount),
    practiceResult: resultBlock(
      practiceRow,
      rankAt(liveRow ? 1 : 0),
      practiceCount
    ),
    // reliz না হলে null — উপরের নিয়ম
    solutions: solutions
      ? solutions.map((s, idx) => ({ order: idx, correct: s.correct, explanation: s.exp || "" }))
      : null,
    review,
  });
});
