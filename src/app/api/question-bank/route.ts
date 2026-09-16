import { apiOk, requireStudent, withApi } from "@/lib/api-auth";
import { fetchTopicQuestionsForStudent } from "@/actions/student-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/question-bank — API কন্ট্রাক্ট v1 #19 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * `?topic=<টপিক পাথ>&page=1&pageSize=20`
 *
 * প্রশ্নব্যাংক ব্রাউজ। **পেজিনেশন বাধ্যতামূলক** — কেন: এই অ্যাকশন একটা টপিকের
 * সব প্রশ্ন (উত্তর ও ব্যাখ্যা সহ) ফেরায়, আর কিছু টপিকে ১০০০+ প্রশ্ন থাকে। পুরোটা
 * একবারে পাঠালে কম দামের ফোনে মেমরি ফুরিয়ে অ্যাপ ক্র্যাশ করবে (গাইড §২২.৩)।
 * তাই ডিফল্ট `pageSize=20`, সর্বোচ্চ ১০০।
 *
 * `fetchTopicQuestionsForStudent` বিদ্যমান অ্যাকশনই ব্যবহার করা হয় — তাই
 * নিরাপত্তার সব নিয়ম অপরিবর্তিত:
 *   • পরিচয় প্রমাণিত সেশন থেকে (Bearer contexto), ক্লায়েন্টের id থেকে নয়
 *   • অন্তত একটি কোর্সে এনরোল্ড থাকতে হবে
 *   • লাইভ-লকড প্রশ্ন বাদ (প্রশ্ন-পর্যায়ের লক, শুধু exam-key নয়)
 *   • যে exam আর নেই তার আর্কাইভ প্রশ্ন তবু পড়া যায়
 */
export const GET = withApi("student", async (ctx, req) => {
  requireStudent(ctx);

  const url = new URL(req.url);
  const topic = String(url.searchParams.get("topic") || "").trim();

  const rawSize = Number(url.searchParams.get("pageSize"));
  const pageSize = Number.isFinite(rawSize) && rawSize > 0
    ? Math.min(100, Math.floor(rawSize))
    : 20;

  const rawPage = Number(url.searchParams.get("page"));
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  // topic না দিলে অ্যাকশন "all" ধরে (কোনো টপিক-ফিল্টার নেই)
  const result = await fetchTopicQuestionsForStudent("", topic || "all");

  if (!result.success) {
    // এনরোলমেন্ট না থাকলে অ্যাকশন success:false + বার্তা দেয়
    const text = String(result.message || "");
    const denied = /অনুমতি|এনরোল/.test(text);
    return apiOk({
      topic: topic || "all",
      allowed: false,
      page,
      pageSize,
      total: 0,
      totalPages: 0,
      hasMore: false,
      questions: [],
      message: text || "প্রশ্ন লোড করা যায়নি।",
    }, denied ? 403 : 200);
  }

  const all = result.questions || [];
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = all.slice(start, start + pageSize);

  return apiOk({
    topic: topic || "all",
    allowed: true,
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasMore: safePage < totalPages,
    message: result.message || "",
    questions: slice.map((q: Record<string, unknown>) => ({
      id: q.id ? String(q.id) : null,
      q: String(q.q ?? ""),
      opts: Array.isArray(q.opts) ? (q.opts as unknown[]).map(String) : [],
      // প্রশ্নব্যাংকে উত্তর প্রকাশ্য — প্র্যাকটিসের মতোই ইচ্ছাকৃত (লাইভ-লকড প্রশ্ন বাদ)
      correct: Number(q.correct ?? 0),
      explanation: String(q.exp ?? ""),
      subject: String(q.subject ?? ""),
      topic: q.topic ? String(q.topic) : null,
    })),
  });
});
