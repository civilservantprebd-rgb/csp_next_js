import { apiFail, apiOk, requireStudent, withApi } from "@/lib/api-auth";
import { getPracticeQuestions } from "@/actions/practice-actions";
import { verifyStudentAccess } from "@/actions/student-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/practice/questions — API কন্ট্রাক্ট v1 #16 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * `?topic=<নাম>&count=<n>` → প্র্যাকটিস-প্রশ্ন। `count=0` = সব প্রশ্ন।
 *
 * #15 (`POST /api/practice/session`)-এর GET-প্রতিরূপ — একই অ্যাকশন, শুধু
 * সুবিধাজনক HTTP-Verb। অ্যাপ যদি সেশন-অবস্থা নিজে রাখে (Riverpod), তবে GET-ই
 * যথেষ্ট; POST তখন দরকার হয় যখন "নতুন সেশন শুরু" আলাদা ইভেন্ট হিসেবে চিহ্নিত করতে চান।
 *
 * ⚠️ উত্তর (`correct`/`exp`) এখানেও যায় — প্র্যাকটিসে ইচ্ছাকৃত (#15-এর ব্যাখ্যা দেখুন)।
 * উত্তর-লক তবু সক্রিয়: লাইভ পরীক্ষায় থাকা প্রশ্ন পুলে আসে না।
 */
export const GET = withApi("student", async (ctx, req) => {
  const identity = requireStudent(ctx);

  const access = await verifyStudentAccess(identity.uid, "ALL", identity.email);
  if (!access.allowed) {
    return apiFail(
      "NOT_ENROLLED",
      access.message || "প্র্যাকটিসের জন্য অন্তত একটি কোর্সে এনরোল্ড থাকতে হবে।",
      403
    );
  }

  const url = new URL(req.url);
  const topic = String(url.searchParams.get("topic") || "").trim();
  const rawCount = Number(url.searchParams.get("count"));
  const count = Number.isFinite(rawCount) ? Math.max(0, Math.floor(rawCount)) : 10;

  const questions = await getPracticeQuestions(topic, count);

  if (questions.length === 0) {
    return apiFail(
      "NO_QUESTIONS",
      "এই টপিকে এখন দেখানোর মতো প্রশ্ন নেই — অন্য টপিক দেখুন, বা শিক্ষককে জানান।",
      404
    );
  }

  return apiOk({
    topic: topic || "all",
    requestedCount: count,
    unlimited: count === 0,
    total: questions.length,
    questions: questions.map((q) => ({
      id: q.id,
      q: q.q,
      opts: q.opts,
      correct: q.correct,
      explanation: q.exp || "",
      subject: q.subject,
      topic: q.topic ?? null,
    })),
  });
});
