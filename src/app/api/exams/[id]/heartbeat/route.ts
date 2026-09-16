import { apiOk, requireStudent, withApi } from "@/lib/api-auth";
import { assertExamAccess, examToDto, loadExam } from "@/lib/exam-api";
import { LIVE_GRACE_MS } from "@/lib/bangladesh-time";
import { supabase } from "@/lib/supabase";
import { claimExamStart } from "@/actions/exam-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/exams/{id}/heartbeat — API কন্ট্রাক্ট v1 #26 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * **কেন দরকার:** শিক্ষার্থী পরীক্ষার মাঝপথে অ্যাপ মিনিমাইজ করল, ফোন বন্ধ করল,
 * বা নেট গেল। ফিরে এসে অ্যাপের লোকাল কাউন্টডাউন আর সার্ভারের সত্যিকারের সময়
 * আলাদা হয়ে যায় — তখন শিক্ষার্থী হয় সময়ের বেশি পায়, নাহয় হঠাৎ "সময় শেষ" দেখে
 * চকিতে পড়ে (গাইড §২২.৪)।
 *
 * এই রাউট দুটো কাজ করে:
 *   ১. অ্যাপ ফিরে এলে সার্ভারের সত্যিকারের অবশিষ্ট সময় জানায়
 *      (`remainingSeconds`), আর সার্ভার-নিবন্ধিত `startedAtMs` ফেরত দেয় —
 *      অ্যাপের এলাপসড-টাইমার এটাকেই অ্যাংকর করবে, ডিভাইস-ঘড়িকে নয়।
 *   ২. প্রথম কলে (বা সেশন হারালে) start-রেকর্ড নিশ্চিত করে — কারণ
 *      **লিডারবোর্ড-যোগ্যতা ও সময়-হিসাব দুটোই এই সার্ভার-রেকর্ডের উপর নির্ভর করে**
 *      (submit-এ ক্লায়েন্টের `timeRemaining` কেবল fallback)।
 *
 * `claimExamStart` ডুপ্লিকেট-নিরাপদ (ignoreDuplicates) — তাই বারবার কল করলেও
 * **প্রথম** শুরুর সময়টাই অপরিবর্তিত থাকে। এটাই কাঙ্ক্ষিত: হৃদস্পন্দন যতই আসুক,
 * ঘড়ি একবারই শুরু হয়।
 *
 * উইন্ডো-চেক এখানে কঠোর নয় (`assertExamWindow` ডাকা হয় না) — কারণ শেষ
 * বাউন্ডারিতে থাকা অবস্থায়ও অ্যাপকে সত্যিকারের অবশিষ্ট সময় জানানো দরকার, এবং
 * `remainingSeconds` নেগেটিভ হলে অ্যাপ নিজেই অটো-সাবমিট করে দেবে।
 */
export const POST = withApi<RouteParams>("student", async (ctx, _req, routeCtx) => {
  const identity = requireStudent(ctx);
  const examId = routeCtx.params?.id;

  const exam = await loadExam(examId);
  const access = await assertExamAccess(exam, identity);

  // সেশন হারিয়ে থাকলে (অ্যাপ নতুন করে ইনস্টল/ক্লিয়ার) start-রেকর্ড নিশ্চিত করি
  await claimExamStart(examId, access.studentId);

  // প্রকৃত started_at পড়ি — claimExamStart প্রথম মানটাই রাখে, তাই এটাই সত্য
  let startedAtMs: number | null = null;
  try {
    const { data } = await supabase
      .from("exam_attempt_starts")
      .select("started_at")
      .eq("exam_id", examId)
      .eq("student_id", access.studentId)
      .maybeSingle();
    if (data?.started_at) {
      const t = Date.parse(String(data.started_at));
      if (!Number.isNaN(t)) startedAtMs = t;
    }
  } catch {
    // টেবিল/মাইগ্রেশন না থাকলে startedAtMs null থাকল — অ্যাপ ক্লায়েন্ট-ঘড়িতে চলবে
  }

  const nowMs = Date.now();
  const dto = examToDto(exam, nowMs);

  // অবশিষ্ট সময়: endTime-ই শেষ সীমা; grace যোগ করা হয় যাতে নেট-ল্যাটেন্সিতে
  // ঠিক সময়ে জমা দেওয়া শিক্ষার্থী বঞ্চিত না হয় (submit-এর নিয়মের সাথে সামঞ্জস্যপূর্ণ)
  const deadlineMs = dto.endTimeMs;
  const remainingSeconds =
    deadlineMs === null ? null : Math.floor((deadlineMs + LIVE_GRACE_MS - nowMs) / 1000);

  return apiOk({
    examId: exam.id,
    startedAtMs,
    isLive: dto.isLive,
    isClosed: dto.isClosed,
    endTimeMs: deadlineMs,
    answersReleaseAtMs: dto.answersReleaseAtMs,
    graceMs: LIVE_GRACE_MS,
    /** `null` = উইন্ডো নেই (সর্বদা-খোলা); ঋণাত্মক = সময় শেষ, অ্যাপ অটো-সাবমিট করবে */
    remainingSeconds,
  });
});

/** GET একই তথ্য দেয় — কিছু HTTP ক্লায়েন্ট শুধু GET পাঠাতে পারে, আর দরকারটাও পড়ার মতোই। */
export const GET = POST;
