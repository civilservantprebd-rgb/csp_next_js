import { apiOk, ApiError, requireStudent, withApi } from "@/lib/api-auth";
import {
  assertExamAccess,
  assertExamWindow,
  examToDto,
  fetchExamQuestions,
  loadExam,
  questionsToDto,
} from "@/lib/exam-api";
import { LIVE_GRACE_MS } from "@/lib/bangladesh-time";
import { checkStudentAlreadySubmitted, claimExamStart } from "@/actions/exam-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/exams/{id}/questions — API কন্ট্রাক্ট v1 #11 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * ⭐ **এই অ্যাপের সবচেয়ে নিরাপত্তা-সংবেদনশীল রাউট।**
 *
 * রেসপন্সে কখনো `correct` বা `exp` থাকে না — `exam-api.ts`-এর `fetchExamQuestions`
 * select-এই ওই কলামগুলো আনে না (strip করার উপর ভরসা নয়, আনারই দরকার নেই)।
 *
 * প্রতিটি প্রশ্নের সাথে যা যায়: ক্রম (`order`), প্রশ্ন, অপশন, টপিক। উত্তর সূচিত
 * হয় **এই ক্রমেই** (`answers[i]` = `order === i` প্রশ্নের উত্তর) — ওয়েব অ্যাপের
 * সাথে হুবহু, তাই দুটো ক্লায়েন্ট থেকে জমা দেওয়া উত্তরপত্র একইভাবে স্কোর হয়।
 *
 * সার্ভার-জমা দেওয়া তথ্য প্রশ্নের সাথে থাকে (গাইড §৩.৩):
 *   `serverTimeMs`, `endTimeMs`, `durationSeconds`, `answersReleaseAtMs`
 * → অ্যাপ কখনো ডিভাইস-ঘড়ির উপর ভরসা করবে না (গাইড §২২.৪)।
 *
 * উইন্ডো বন্ধ থাকলে ৪২৫ (EXAM_NOT_STARTED) / ৪১০ (EXAM_CLOSED) — অ্যাপ
 * HTTP স্ট্যাটাস নয়, `error.code` ধরে স্ক্রিন বাছবে।
 */
export const GET = withApi<RouteParams>("student", async (ctx, _req, routeCtx) => {
  const identity = requireStudent(ctx);
  const examId = routeCtx.params?.id;
  const nowMs = Date.now();

  const exam = await loadExam(examId);

  // ক্রম গুরুত্বপূর্ণ: আগে এনরোলমেন্ট (কার আনা উচিত), তারপর উইন্ডো।
  // উল্টো করলে অ-এনরোল্ড কেউ "সময় শেষ" বার্তা পেত — ভ্রামক।
  const access = await assertExamAccess(exam, identity);
  assertExamWindow(exam, nowMs);

  // SECURITY: ইতিমধ্যে সাবমিট করা থাকলে প্রশ্নই দেওয়া হয় না — নাহলে লাইভ
  // চলাকালীন দ্বিতীয় ডিভাইসে প্রশ্ন দেখে প্রথমটায় উত্তর পাঠানো যেত।
  // (Worst case একই ছাত্রেরই লাভ, তবু লাইভ পরীক্ষার নিয়ম ভাঙে → fail-closed)
  const already = await checkStudentAlreadySubmitted(examId, access.studentId);
  if (already) {
    throw new ApiError(
      "ALREADY_SUBMITTED",
      "আপনি ইতিমধ্যে এই পরীক্ষায় অংশগ্রহণ করেছেন। লাইভ চলাকালীন একবারই দেওয়া যায়।",
      409
    );
  }

  const questions = await fetchExamQuestions(examId);
  if (questions.length === 0) {
    throw new ApiError(
      "NO_QUESTIONS",
      "এই পরীক্ষায় এখনো কোনো প্রশ্ন যোগ করা হয়নি।",
      404
    );
  }

  // সার্ভারে start-রেকর্ড — লিডারবোর্ড-যোগ্যতা ও প্রকৃত সময়-হিসাবের একমাত্র সূত্র
  // (ক্লায়েন্ট কত সময় নিল বলল, তা দিয়ে নয়)। টেবিল/মাইগ্রেশন না থাকলে নীরবে ব্যর্থ।
  const claim = await claimExamStart(examId, access.studentId);

  const dto = examToDto(exam, nowMs);

  return apiOk({
    examId: exam.id,
    title: exam.title,
    course: exam.course,
    subject: exam.subject,
    durationSeconds: dto.durationSeconds,
    startTimeMs: dto.startTimeMs,
    endTimeMs: dto.endTimeMs,
    answersReleaseAtMs: dto.answersReleaseAtMs,
    /** এই উইন্ডোতে শেষ সময়ের পরে সাবমিশনও "লাইভ" গণ্য হয় — অ্যাপ টাইমার এটুকু ঢিল রাখবে। */
    graceMs: LIVE_GRACE_MS,
    /** সার্ভার-নিবন্ধিত শুরু (থাকলে) — অ্যাপের এলাপসড-টাইমার এটাকেই অ্যাংকর করবে। */
    startedAtMs: claim?.startedAtMs ?? null,
    totalQuestions: questions.length,
    questions: questionsToDto(questions),
  });
});
