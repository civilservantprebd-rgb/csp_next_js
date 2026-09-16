import { apiFail, apiOk, readJsonBody, requireStudent, withApi } from "@/lib/api-auth";
import { getPracticeQuestions } from "@/actions/practice-actions";
import { verifyStudentAccess } from "@/actions/student-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/practice/session — API কন্ট্রাক্ট v1 #15 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * {topic, count} পাঠিয়ে প্র্যাকটিস-প্রশ্নের পুল তৈরি। `count: 0` = "সব প্রশ্ন"
 * (প্রশ্নব্যাংক রিডিং মোড), ১–৫০ = কুইজ মোড (শাফল করা)।
 *
 * ⚠️ **এই একমাত্র জায়গা যেখানে `correct`/`exp` ক্লায়েন্টে যায় — এবং যাওয়া উচিত।**
 * প্র্যাকটিসে কোনো লিডারবোর্ড, র্যাংক বা পুরস্কার নেই; শিক্ষার্থী উত্তর দেখে শেখে —
 * এটাই ফিচার (গাইড §৬.১ #16: "প্র্যাকটিসে লিক-ঝুঁকি নেই")। কিন্তু উত্তর-লক
 * তখনও কাজ করে: যে প্রশ্ন **এই মুহূর্তে কোনো লাইভ পরীক্ষায়** আছে, সেটি পুলে
 * আসেই না (`loadAnswerLockState`), তাই প্র্যাকটিসের সূত্র ধরে চলমান পরীক্ষার
 * উত্তর বের করা যায় না।
 *
 * পেইড কনটেন্ট: অন্তত একটি কোর্সে এনরোল্ড থাকতে হবে (কোর্স-স্কোপ নয়)।
 */
export const POST = withApi("student", async (ctx, req) => {
  const identity = requireStudent(ctx);

  const access = await verifyStudentAccess(identity.uid, "ALL", identity.email);
  if (!access.allowed) {
    return apiFail(
      "NOT_ENROLLED",
      access.message || "প্র্যাকটিসের জন্য অন্তত একটি কোর্সে এনরোল্ড থাকতে হবে।",
      403
    );
  }

  const body = await readJsonBody(req);
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const rawCount = Number(body?.count);
  // count না দিলে ১০ (ওয়েব কুইজের ডিফল্ট); 0 দিলে "সব প্রশ্ন"
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
      // প্র্যাকটিসে উত্তর প্রকাশ্য — ইচ্ছাকৃত (উপরে ব্যাখ্যা)
      correct: q.correct,
      explanation: q.exp || "",
      subject: q.subject,
      topic: q.topic ?? null,
    })),
  }, 201);
});
