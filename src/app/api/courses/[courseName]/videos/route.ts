import { apiFail, apiOk, requireStudent, withApi } from "@/lib/api-auth";
import { getCourseVideosForStudent } from "@/actions/video-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { courseName: string };
}

/**
 * GET /api/courses/{courseName}/videos — API কন্ট্রাক্ট v1 #6 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * কোর্সের ভিডিও লেসন — **শুধু ওই কোর্সে এনরোল্ড শিক্ষার্থীর**।
 * এনরোলমেন্ট চেক সবসময় সার্ভারে (`getCourseVideosForStudent` → `verifyStudentAccess`);
 * অ্যাপ থেকে কোনো id/email পাঠানো হয় না, পরিচয় আসে Bearer টোকেন থেকে।
 *
 * না-এনরোল্ড হলে 403 `NOT_ENROLLED` — অ্যাপ তখন "কোর্স কিনুন" স্ক্রিন দেখাবে।
 *
 * অ্যাপে চালানোর নোট: এখানে `youtubeId` যায়, পূর্ণ URL নয় — Flutter-এ
 * `youtube_player_iframe`/`webview_flutter` দিয়ে চালাতে হবে (Media3 সরাসরি
 * YouTube চালায় না)। পেইড কনটেন্ট, তাই লিংক কখনো ক্যাশ করা যাবে না।
 */
export const GET = withApi<RouteParams>("student", async (ctx, _req, routeCtx) => {
  requireStudent(ctx);

  const raw = String(routeCtx.params?.courseName ?? "");
  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    name = raw;
  }
  name = name.trim();

  if (!name) {
    return apiFail("BAD_REQUEST", "কোর্সের নাম প্রয়োজন।", 400);
  }

  const result = await getCourseVideosForStudent(name);

  if (!result.allowed) {
    return apiFail(
      "NOT_ENROLLED",
      result.message || "এই কোর্সে আপনার এনরোলমেন্ট নেই — কোর্স কিনলে ভিডিও খুলবে।",
      403
    );
  }

  return apiOk({
    courseName: name,
    studentName: result.name ?? null,
    total: result.videos.length,
    videos: result.videos.map((v) => ({
      id: v.id,
      course: v.course,
      subject: v.subject ?? null,
      title: v.title,
      /** YouTube ভিডিও-আইডি — অ্যাপ নিজে প্লেয়ার বানাবে */
      youtubeId: v.youtubeId,
      description: v.description ?? null,
      sortOrder: v.sortOrder,
    })),
  });
});
