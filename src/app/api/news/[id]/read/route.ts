import { apiFail, apiOk, withApi } from "@/lib/api-auth";
import { incrementNewsRead } from "@/actions/news-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/news/{id}/read — API কন্ট্রাক্ট v1 #21 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * শিক্ষার্থী সংবাদটি খুললে read-count ১ বাড়ায় (শিক্ষক প্যানেলে ভিউ-কাউন্ট দেখায়)।
 *
 * `auth: "none"` — ওয়েবেও এটি লগইন ছাড়াই কাজ করে, আর ভিউ-কাউন্ট কেবল পরিসংখ্যান
 * (কোনো সংবেদনশীল ডেটা নেই)। বাড়তি ভিউ ঠেকাতে কিছু করা হয় না — এটা ইচ্ছাকৃত:
 * ভুয়া ভিউয়ের ক্ষতি শূন্য, অথচ কঠোর করা হলে আসল শিক্ষার্থীর পড়া আটকে যেত।
 *
 * রেসপন্স সবসময় 200 — কাউন্ট-আপডেট ব্যর্থ হলেও (RPC/মাইগ্রেশন নেই) অ্যাপের
 * পড়ার অভিজ্ঞতা ভাঙা উচিত নয় (ওয়েব অ্যাকশনের নীতিও এটাই)।
 */
export const POST = withApi<RouteParams>("none", async (_ctx, _req, routeCtx) => {
  const id = String(routeCtx.params?.id ?? "").trim();
  if (!id) {
    return apiFail("BAD_REQUEST", "সংবাদের আইডি প্রয়োজন।", 400);
  }

  // ইন্টারনালি নীরবে ব্যর্থ হয় — অ্যাপ কিছু ফিরিয়ে দিলেও ভাঙবে না
  await incrementNewsRead(id);

  return apiOk({ counted: true, newsId: id });
});
