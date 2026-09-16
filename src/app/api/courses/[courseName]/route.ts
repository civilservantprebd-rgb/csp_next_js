import { apiFail, apiOk, withApi } from "@/lib/api-auth";
import { fetchCourseDetails, getCoursePrices } from "@/actions/course-actions";
import { getCourseVideoCounts } from "@/actions/video-actions";
import { getCourseWhatsAppForStudent } from "@/actions/whatsapp-actions";
import { verifyStudentAccess } from "@/actions/student-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: { courseName: string };
}

/**
 * GET /api/courses/{courseName} — API কন্ট্রাক্ট v1 #5 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * কোর্স-বিস্তারিত। দাম/বিবরণ সবার জন্য, কিন্তু **WhatsApp গ্রুপ লিংক কেবল
 * এনরোল্ড শিক্ষার্থীর** — গাইড §৬.১ #5 যা বলেছে, আর `getCourseWhatsAppForStudent`
 * নিজেই `verifyStudentAccess` দিয়ে যাচাই করে (এনরোল্ড না হলে খালি স্ট্রিং)।
 *
 * SECURITY: লিংকটা আসলে একটা ক্রেডেনশিয়াল — ওটায় ঢুকলে পেইড গ্রুপে যোগ দেওয়া যায়।
 * তাই এখানে কখনো এনরোলমেন্ট ছাড়া পাঠানো হয় না; পরিচয় আসে সেশন-টোকেন থেকে।
 */
export const GET = withApi<RouteParams>("optional", async (ctx, _req, routeCtx) => {
  // App Router params ডিকোড করা দেয়, তবে বাংলা কোর্স-নামে ডাবল-এনকোডিং হলে
  // একবার নিজেরাই ডিকোড করে নিই (ব্যর্থ হলে কাঁচা মানটাই থাকল)।
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

  const [prices, details, videoCounts] = await Promise.all([
    getCoursePrices(),
    fetchCourseDetails(name),
    getCourseVideoCounts(),
  ]);

  const price = prices[name] || null;

  // এনরোলমেন্ট + WhatsApp লিংক — সেশন-টোকেন ভিত্তিক (resolveStudyIdentity
  // Bearer-aware, তাই client identity পাঠানোর দরকার নেই)
  let isEnrolled = false;
  let whatsappLink = "";
  if (ctx.identity) {
    const access = await verifyStudentAccess(ctx.identity.uid, name, ctx.identity.email);
    isEnrolled = access.allowed;
    if (isEnrolled) {
      whatsappLink = await getCourseWhatsAppForStudent(name);
    }
  }

  return apiOk({
    courseName: name,
    title: name,
    priceTaka: price?.price ?? null,
    offerPriceTaka: price?.offerPrice ?? null,
    description: price?.description ?? null,
    details: details || price?.details || "",
    plannedExams: price?.plannedExams ?? null,
    plannedVideos: price?.plannedVideos ?? null,
    videoCount: videoCounts[name] ?? 0,
    isEnrolled,
    /** কেবল এনরোল্ড শিক্ষার্থীর কাছে; নাহলে খালি স্ট্রিং */
    whatsappLink,
  });
});
