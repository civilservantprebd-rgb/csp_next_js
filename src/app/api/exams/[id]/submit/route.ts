import { apiFail, apiOk, readJsonBody, requireStudent, withApi } from "@/lib/api-auth";
import { assertExamAccess, assertExamWindow, fetchExamQuestions, loadExam } from "@/lib/exam-api";
import { submitExamAnswers } from "@/actions/exam-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/exams/{id}/submit — API কন্ট্রাক্ট v1 #12 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * বডি: `{ "answers": (number|null)[], "totalQuestions"?: number, "timeRemaining"?: number }`
 *
 * `answers[i]` = `order === i` প্রশ্নের নির্বাচিত অপশন-সূচক, না দিলে `null`।
 *
 * ── এই রাউট ইচ্ছাকৃতভাবে "বোকা" ──
 * কোনো স্কোরিং এখানে নেই। সব সিদ্ধান্তই `submitExamAnswers`-এ (সার্ভার অ্যাকশন):
 *   • পরিচয় সেশন থেকে (ক্লায়েন্টের `studentId`/`studentName` উপেক্ষিত, পেইড
 *     পরীক্ষায় রোস্টারের নামই লেখা হয়)
 *   • লাইভ-যোগ্যতা সার্ভার-নিবন্ধিত **শুরু-সময়ে** দিয়ে, জমা-সময়ে নয়
 *   • `time_spent` সার্ভার-ঘড়ি থেকে (লিডারবোর্ডের টাই-ব্রেকার জাল করা রোধ)
 *   • এক-শিক্ষার্থী-এক-সাবমিশন — DB unique index (23505) সহ
 *   • উত্তর-কী এখনো রিলিজ না হলে সারি `is_pending_evaluation` হিসেবে থাকে,
 *     রিলিজের পরে নিজে থেকেই মূল্যায়িত হয় (0 আটকে যায় না)
 *
 * রাউট শুধু: এনরোলমেন্ট, উইন্ডো ও প্রশ্ন-সংখ্যা ঠিক করে payload তৈরি করে।
 */
export const POST = withApi<RouteParams>("student", async (ctx, req, routeCtx) => {
  const identity = requireStudent(ctx);
  const examId = routeCtx.params?.id;

  const exam = await loadExam(examId);
  const access = await assertExamAccess(exam, identity);
  assertExamWindow(exam, Date.now());

  const body = await readJsonBody(req);

  // উত্তর স্যানিটাইজ: শুধু 0+ ইন্টিজার, না দিলে null (ছেড়ে দেওয়া প্রশ্ন)
  const rawAnswers = Array.isArray(body?.answers) ? (body!.answers as unknown[]) : [];
  const answers: (number | null)[] = rawAnswers.map((v) => {
    if (v === null || v === undefined || v === -1) return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  });

  // প্রশ্ন-সংখ্যা সার্ভার থেকেই — ক্লায়েন্ট "১০০টির মধ্যে ১০০" বলে স্কোর ফুলাতে
  // পারবে না। প্রশ্ন পড়া না গেলে ক্লায়েন্টের দাবিতে fallback (আগের আচরণ)।
  const questions = await fetchExamQuestions(examId);
  const declared = Number(body?.totalQuestions);
  const totalQuestions = questions.length > 0
    ? questions.length
    : Number.isFinite(declared) && declared > 0
      ? Math.floor(declared)
      : answers.length;

  const timeRemaining = Number(body?.timeRemaining);

  const result = await submitExamAnswers({
    // পেইড পরীক্ষায় সার্ভারই রোস্টারের নাম/id বসায়; এখানে ফ্রি-পরীক্ষার
    // fallback হিসেবে যাচাই-করা মান পাঠাই (ক্লায়েন্টের দাবি নয়)
    studentName: access.studentName,
    studentId: access.studentId,
    examKey: examId,
    // শিরোনাম ডেটাবেস থেকে — ক্লায়েন্ট ভুল/ভুয়া শিরোনাম বসাতে পারবে না
    examTitle: exam.title,
    examTimerMinutes: exam.timerMinutes || 60,
    timeRemaining: Number.isFinite(timeRemaining) ? timeRemaining : 0,
    answers,
    totalQuestions,
  });

  if (!result.success) {
    // `isLive: true` মানে লাইভ-প্রেক্ষাপটে প্রত্যাখ্যান — প্রায় সবসময়ই
    // "ইতিমধ্যে অংশগ্রহণ করেছেন"। অ্যাপ এতে রিট্রাই করবে না, ফলাফলে যাবে।
    if (result.isLive) {
      return apiFail(
        "ALREADY_SUBMITTED",
        result.message || "আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন।",
        409
      );
    }
    return apiFail("SUBMIT_FAILED", result.message || "উত্তরপত্র জমা দিতে ব্যর্থ হয়েছে।", 400);
  }

  return apiOk({
    submissionId: result.submissionId ?? null,
    isLiveSubmission: !!result.isLiveSubmission,
    /**
     * লাইভ পরীক্ষায় স্কোর এখানে **ইচ্ছাকৃতভাবে নেই** (`null`) — উত্তর-কী
     * রিলিজের আগে স্কোর জানালে শিক্ষার্থী এক-এক অপশন বদলে কতটা সঠিক হচ্ছে
     * তা মেপে নিতে পারত (bit-by-bit answer-key oracle)। ফলাফল `/result`-এ।
     */
    score: result.score ?? null,
    correct: result.correct ?? null,
    incorrect: result.incorrect ?? null,
  });
});
