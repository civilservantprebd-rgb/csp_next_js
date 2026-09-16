import { apiOk, resolveStudentProfile, withApi } from "@/lib/api-auth";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { getCoursePrices } from "@/actions/course-actions";
import { getCourseVideoCounts } from "@/actions/video-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/courses — API কন্ট্রাক্ট v1 #4 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * কোর্স-তালিকা + দাম/ছাড় + ভিডিও-সংখ্যা + **এই শিক্ষার্থীর এনরোলমেন্ট স্ট্যাটাস**।
 *
 * `auth: "optional"` — অতিথি দামসহ ক্যাটালগ দেখতে পারে (ওয়েব ল্যান্ডিং পেজের মতোই;
 * এনরোল করার আগে দাম না জানলে কেউ কিনবে না)। লগইন থাকলে প্রতিটি কোর্সে
 * `isEnrolled` সত্য/মিথ্যা হয়ে আসে, তাই অ্যাপ এক কলেই "কিনেছি / কিনিনি" কার্ড আঁকতে পারে।
 *
 * এনরোলমেন্টের নিয়ম (গাইড §১.৩, অপরিবর্তিত): `courses`-এ `"ALL"` বা `"সকল কোর্স"`
 * থাকলে সব কোর্সেই অ্যাক্সেস।
 */
export const GET = withApi("optional", async (ctx) => {
  const [config, prices, videoCounts] = await Promise.all([
    fetchAppConfigLite(),
    getCoursePrices(),
    getCourseVideoCounts(),
  ]);

  // সেশন থাকলে রোস্টার-এনরোলমেন্ট, নাহলে খালি (অতিথি)
  const profile = ctx.identity ? await resolveStudentProfile(ctx.identity) : null;
  const owned = new Set(
    (profile?.courses || []).map((c) => String(c || "").trim().toLowerCase()).filter(Boolean)
  );
  const ownsAll = owned.has("all") || owned.has("সকল কোর্স");

  // ল্যান্ডিং পেজের কার্ডে "Nটি বিষয়ের কনটেন্ট" ও পরীক্ষার সংখ্যা দেখাতে হয়
  // (web: LandingPage.tsx — subjects.filter(...).length ও exams per course)।
  // সার্ভারে গুনে পাঠানো হয়, যাতে অ্যাপকে পুরো config নামাতে না হয়।
  const subjectCounts: Record<string, number> = {};
  for (const s of config?.subjects || []) {
    const c = String(s?.course || "").trim();
    if (c) subjectCounts[c] = (subjectCounts[c] || 0) + 1;
  }
  const examCounts: Record<string, number> = {};
  for (const ex of Object.values(config?.exams || {})) {
    const c = String(ex?.course || "").trim();
    if (c) examCounts[c] = (examCounts[c] || 0) + 1;
  }

  const pinned = new Set(
    (config?.pinnedCourses || []).map((c) => String(c || "").trim()).filter(Boolean)
  );

  const courses = (config?.courses || [])
    .map((c) => String(c || "").trim())
    .filter(Boolean)
    .map((name) => {
      const price = prices[name] || {};
      return {
        courseName: name,
        title: name,
        priceTaka: price.price ?? null,
        offerPriceTaka: price.offerPrice ?? null,
        description: price.description ?? null,
        details: price.details ?? null,
        plannedExams: price.plannedExams ?? null,
        plannedVideos: price.plannedVideos ?? null,
        /** ওয়েবের কার্ড-বুলেটের জন্য: "Nটি বিষয়ের কনটেন্ট" */
        subjectCount: subjectCounts[name] ?? 0,
        /** ওয়েবের কার্ড-বুলেটের জন্য: এই কোর্সে যত পরীক্ষা আছে */
        examCount: examCounts[name] ?? 0,
        /** "সর্বাধিক জনপ্রিয়" ব্যাজ — ওয়েবের `pinnedCourses` */
        isPopular: pinned.has(name),
        /** এনরোল করা শিক্ষার্থীর কাছে অ্যাপ "ভিডিও" ট্যাব দেখাবে কি না */
        videoCount: videoCounts[name] ?? 0,
        hasVideos: (videoCounts[name] ?? 0) > 0,
        isEnrolled: ownsAll || owned.has(name.toLowerCase()),
      };
    })
    // জনপ্রিয় কোর্স আগে — ওয়েবের `sortedCourses`-এর মতোই
    .sort((a, b) => (a.isPopular === b.isPopular ? 0 : a.isPopular ? -1 : 1));

  return apiOk({
    courses,
    total: courses.length,
    /** অতিথি হলে false — অ্যাপ "লগইন করুন" দেখাবে */
    isLoggedIn: !!ctx.identity,
    enrolledCount: courses.filter((c) => c.isEnrolled).length,
  });
});
