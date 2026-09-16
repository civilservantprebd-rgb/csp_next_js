import { apiOk, withApi } from "@/lib/api-auth";
import { getDailyNews } from "@/actions/news-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/news — API কন্ট্রাক্ট v1 #20 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * দৈনিক সংবাদ — সবার পড়ার জন্য (ওয়েব হোম পেজের মতোই)।
 *
 * `?limit=` দিয়ে সংখ্যা কমানো যায় (ডিফল্ট ২০, সর্বোচ্চ ১০০) — ড্যাশবোর্ড শুধু
 * সাম্প্রতিক কয়েকটা চায়, আর মোবাইল ডেটা বাঁচানো জরুরি (গাইড §২২.৩)।
 * `publishedAtMs` (epoch ms) দেওয়া হয় যাতে অ্যাপ ডিভাইস-লোকেল পার্সিং-এ
 * নির্ভর না করে — বাংলা টাইমজোনে ভুল তারিখ দেখানোর সাধারণ কারণ এটাই।
 */
export const GET = withApi("optional", async (_ctx, req) => {
  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(100, Math.floor(rawLimit)) : 20;

  const news = await getDailyNews();

  return apiOk({
    total: news.length,
    news: news.slice(0, limit).map((n) => ({
      id: n.id,
      title: n.heading,
      body: n.body,
      publishedAtMs: n.createdAt ? Date.parse(n.createdAt) || 0 : 0,
      readCount: n.readCount ?? 0,
    })),
  });
});
