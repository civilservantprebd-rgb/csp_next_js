import { apiOk, requireStudent, withApi } from "@/lib/api-auth";
import { assertExamAccess, examToDto, loadExam } from "@/lib/exam-api";
import { LIVE_GRACE_MS } from "@/lib/bangladesh-time";
import { claimExamStart, readExamStartMs } from "@/actions/exam-actions";

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

  // প্রকৃত started_at — claimExamStart প্রথম মানটাই রাখে, তাই এটাই সত্য
  const startedAtMs = await readExamStartMs(examId, access.studentId);

  const nowMs = Date.now();
  const dto = examToDto(exam, nowMs);

  const durationMs = Math.max(1, exam.timerMinutes || 10) * 60 * 1000;

  // ── উইন্ডো-ভিত্তিক বাকি সময় (আগের মতোই) ──
  // grace যোগ করা হয় যাতে নেট-ল্যাটেন্সিতে ঠিক সময়ে জমা দেওয়া শিক্ষার্থী বঞ্চিত না হয়
  const deadlineMs = dto.endTimeMs;
  const remainingSeconds =
    deadlineMs === null ? null : Math.floor((deadlineMs + LIVE_GRACE_MS - nowMs) / 1000);

  // ── ব্যক্তিগত বাকি সময় (নতুন) ──
  //
  // ⚠️ এটা ছাড়া একটা আসল বঞ্চনা ঘটত: যে শিক্ষার্থী লাইভ উইন্ডোর শেষ সেকেন্ডে
  // শুরু করে, সে ডিজাইন-অনুযায়ী পুরো পরীক্ষা-দৈর্ঘ্য পায় (আর উত্তর-কীও ততক্ষণ
  // বন্ধ থাকে)। কিন্তু অ্যাপ পটভূমি থেকে ফিরে `remainingSeconds` দেখলে
  // `endTime`-এর হিসাবে "শেষ" পেত — আর সাথে সাথেই অটো-সাবমিট করে তার পুরো
  // সময়টা জলে যেত।
  //
  // হিসাবটা অ্যাপের `resolveExamDeadlineMs()`-এর হুবহু প্রতিরূপ — দুই দিকে
  // একই সিদ্ধান্ত না হলে একটা আরেকটাকে খণ্ডন করত:
  //   • উইন্ডো নেই → null (সর্বদা-খোলা প্র্যাকটিস)
  //   • উইন্ডো শেষ হয়ে গেছে → null (প্র্যাকটিস-প্রয়াস; সার্ভারের `started_at`
  //     হয়তো লাইভ-উইন্ডোর পুরোনো সময়, ওটা দিয়ে ঘড়ি বাঁধলে পরীক্ষা খোলার
  //     সাথে সাথেই "সময় শেষ" হয়ে যেত — অর্থাৎ শেষ হওয়া পরীক্ষা আর দেওয়াই যেত না)
  //   • উইন্ডো খোলা → নিবন্ধিত শুরু থেকে পুরো দৈর্ঘ্য
  const hasWindow = dto.endTimeMs !== null;
  const windowOpen = hasWindow && nowMs <= dto.endTimeMs! + LIVE_GRACE_MS;
  const personalDeadlineMs = !windowOpen
    ? null
    : startedAtMs !== null && startedAtMs <= dto.endTimeMs! + LIVE_GRACE_MS
      ? startedAtMs + durationMs
      : dto.endTimeMs! + LIVE_GRACE_MS;
  const personalRemainingSeconds = personalDeadlineMs === null
    ? null
    : Math.floor((personalDeadlineMs + LIVE_GRACE_MS - nowMs) / 1000);

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
    /**
     * **এই মানটাই অ্যাপ ব্যবহার করবে** — সার্ভার-নিবন্ধিত শুরু থেকে পুরো
     * পরীক্ষা-দৈর্ঘ্যের হিসাব। উইন্ডো-শেষে ক্যাপ করা হয় না, তাই শেষ বাউন্ডারিতে
     * শুরু করাও শিক্ষার্থীও তার প্রাপ্য সময়টা পায়।
     */
    personalDeadlineMs,
    personalRemainingSeconds,
  });
});

/** GET একই তথ্য দেয় — কিছু HTTP ক্লায়েন্ট শুধু GET পাঠাতে পারে, আর দরকারটাও পড়ার মতোই। */
export const GET = POST;
