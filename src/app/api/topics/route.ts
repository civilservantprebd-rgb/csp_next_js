import { apiFail, apiOk, requireStudent, withApi } from "@/lib/api-auth";
import { getPracticeTopics } from "@/actions/practice-actions";
import { verifyStudentAccess } from "@/actions/student-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/topics — API কন্ট্রাক্ট v1 #18 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * প্র্যাকটিস/প্রশ্নব্যাংকের টপিক-হায়ারার্কি + প্রতি টপিকে প্রশ্নসংখ্যা।
 *
 * নিয়ম (গাইড §১.৩, অপরিবর্তিত): **যেকোনো একটি কোর্সে এনরোল্ড থাকলেই** সব
 * টপিক দেখা যায় — কোর্স-স্কোপ ফিল্টার নেই।
 *
 * উত্তর-লক স্বয়ংক্রিয়ভাবে প্রয়োগ হয়: যে প্রশ্ন এই মুহূর্তে কোনো লাইভ পরীক্ষায়
 * আছে, সেটি `count`-এও ধরা হয় না (lib/answer-lock.ts) — নাহলে কাউন্ট দেখেই বোঝা
 * যেত কোন প্রশ্ন লাইভ পরীক্ষায় আছে, আর ব্যাংক থেকে উত্তর মিলিয়ে নেওয়া যেত।
 *
 * এনরোল্ড না হলে 403 `NOT_ENROLLED` — অ্যাকশন নিজে খালি অ্যারে ফেরায়, কিন্তু
 * অ্যাপের "কেন খালি?" প্রশ্নের উত্তর দরকার, তাই গেটটা রাউট-স্তরেই স্পষ্ট করা।
 */
export const GET = withApi("student", async (ctx) => {
  const identity = requireStudent(ctx);

  const access = await verifyStudentAccess(identity.uid, "ALL", identity.email);
  if (!access.allowed) {
    return apiFail(
      "NOT_ENROLLED",
      access.message || "প্র্যাকটিসের জন্য অন্তত একটি কোর্সে এনরোল্ড থাকতে হবে।",
      403
    );
  }

  // পরিচয় Bearer context থেকে যায় — ক্লায়েন্টের id/email পাঠানোর দরকার নেই
  const topics = await getPracticeTopics();

  return apiOk({
    total: topics.length,
    totalQuestions: topics.reduce((sum, t) => sum + (t.count || 0), 0),
    topics: topics.map((t) => ({
      name: t.name,
      questionCount: t.count || 0,
    })),
  });
});
