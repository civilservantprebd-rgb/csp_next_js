import { apiOk, profileToDto, resolveStudentProfile, withApi } from "@/lib/api-auth";
import { fetchAppConfigMeta } from "@/actions/admin-actions";
import { getDailyNews } from "@/actions/news-actions";
import { getCompletedExamKeys } from "@/actions/student-actions";
import { getCoursePrices } from "@/actions/course-actions";
import { getCourseVideoCounts } from "@/actions/video-actions";
import { examToDto, isExamVisibleInApp } from "@/lib/exam-api";
import type { Exam } from "@/types/exam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/home — API কন্ট্রাক্ট v1 #8 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * **Aggregate ড্যাশবোর্ড** — অ্যাপ যেন এক কলেই সব সেকশনের ডেটা পায় (গাইড §৩.৩,
 * §২২.৩)। ছয়-সাতটা আলাদা কল করলে কম দামের ফোনে ও ধীর নেটে স্টার্টআপ লম্বা
 * হয়; এখানে সার্ভার-সাইডে Promise.all দিয়ে সমান্তরালে আনা হয়।
 *
 * `auth: "optional"` — অতিথিও ড্যাশবোর্ড দেখতে পারে (funnel: কী কী ফ্রি পরীক্ষা
 * আছে না দেখলে কেউ নিবন্ধন করবে না), কিন্তু লগইন থাকলে প্রতিটি সেকশন ব্যক্তিগত
 * হয়ে যায়: এনরোলমেন্ট, সম্পন্ন পরীক্ষার টিক, নিজের কোর্স।
 *
 * ── আগের সংস্করণ থেকে যা বদলালো ──
 * ফাইলের নিজের TODO ছিল: "auth-token থেকে student-নির্দিষ্ট ডেটা (এনরোলমেন্ট,
 * স্ট্যাট) যোগ করবেন"। এখন সেটা যোগ হয়েছে — Bearer টোকেন যাচাই করে
 * (`withApi`) রোস্টার-প্রোফাইল ও সম্পন্ন-পরীক্ষার তালিকা আনা হয়।
 *
 * ⚠️ এই রেসপন্সে **কখনো প্রশ্ন বা উত্তর আসে না** — শুধু শিরোনাম, সময়, কাউন্ট।
 * প্রশ্ন আলাদা রাউটে (`/api/exams/{id}/questions`), যেখানে উইন্ডো-গেট আছে।
 */
export const GET = withApi("optional", async (ctx) => {
  const nowMs = Date.now();

  // স্বাধীন সব কোয়েরি একসাথে — ক্রমিক অপেক্ষা নেই
  const [config, news, profile, completedKeys, prices, videoCounts] = await Promise.all([
    // প্রশ্ন-বিহীন হালকা কনফিগ: ড্যাশবোর্ডের শুধু পরীক্ষার মেটাডেটা দরকার,
    // প্রতি প্রশ্নে একটি করে সারি (ও তার জয়েন) নয়। মোবাইলে হোম স্ক্রিন
    // প্রতিবার খোলা হয়, তাই এখানেই সবচেয়ে বড় লাভ।
    fetchAppConfigMeta(),
    getDailyNews(),
    ctx.identity ? resolveStudentProfile(ctx.identity) : Promise.resolve(null),
    ctx.identity
      ? getCompletedExamKeys(ctx.identity.uid, ctx.identity.email).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
    // কোর্স-কার্ডের দাম ও ভিডিওর সংখ্যা — নিচের `courses`-এ লাগে। এখানেই
    // রাখা হলো, যাতে দ্বিতীয় দফায় অপেক্ষা করতে না হয় (§২২.৩)।
    getCoursePrices(),
    getCourseVideoCounts(),
  ]);

  const completed = new Set((completedKeys || []).filter(Boolean));

  // রোস্টার-এনরোলমেন্ট → কোন কোর্সে ঢুকতে পারবে (গাইড §১.৩: "ALL" মানে সব)
  const ownedRaw = (profile?.courses || []).map((c) => String(c || "").trim().toLowerCase());
  const ownsAll = ownedRaw.includes("all") || ownedRaw.includes("সকল কোর্স");
  const owns = (name: string) => ownsAll || ownedRaw.includes(String(name || "").trim().toLowerCase());

  const exams = Object.values(config?.exams || {}).filter(
    (e): e is Exam => Boolean(e && e.id && e.title)
  );

  const live: Exam[] = [];
  const upcoming: Exam[] = [];
  const free: Exam[] = [];
  /** সত্যিকারের মোট ফ্রি-পরীক্ষার সংখ্যা — `free` তালিকা কাটা হলেও এটা অটুট */
  let freeTotal = 0;

  for (const e of exams) {
    const dto = examToDto(e, nowMs);
    /**
     * ⚠️ ২০২৬-০৯-২৩: **১২-ঘণ্টার দৃশ্যমানতা-নিয়ম** — ব্যবহারকারীর নির্দেশ:
     * *"যে এক্সামগুলো ১২ ঘন্টার মধ্যে শুরু হবে না বা লাইভ না, সেগুলো ব্যাকএন্ড
     * থেকে অ্যাপে দেখা যাবে না ... লিডারবোর্ড, কোর্স, কোথাও না।"*
     *
     * এটা ফিল্টার-লিস্টের **আগেই** বসানো, তাই live · upcoming · free — তিন
     * তালিকা থেকেই বাদ পড়ে যায়, আর `freeTotal`-ও মিলে থাকে (সংখ্যা আর তালিকা
     * কখনো আলাদা কথা বলে না)।
     */
    if (!isExamVisibleInApp(e, nowMs)) continue;
    // উইন্ডো-হীন সর্বদা-খোলা পরীক্ষা live/upcoming তালিকায় যায় না
    if (dto.startTimeMs !== null && dto.endTimeMs !== null) {
      if (dto.isLive) live.push(e);
      else if (dto.isUpcoming) upcoming.push(e);
    }
    // ⚠️ `free` তালিকা ১০টায় **কাটা** হয় (পেলোড ছোট রাখতে), কিন্তু সংখ্যাটা
    // আলাদা করে গোনা হয় — নাহলে ১৯টি ফ্রি পরীক্ষা থাকলেও অ্যাপ পর্দায়
    // "মোট ১০টি" লিখত, যা সরাসরি মিথ্যা।
    if (e.isFree !== false) {
      freeTotal += 1;
      /**
       * ⚠️ এখানে আগে **১০টায় কাটা** হত ("পেলোড ছোট রাখতে")। কিন্তু অ্যাপের
       * "ফ্রি মডেল টেস্ট" কার্ডে ট্যাপ করলে যে তালিকা খোলে, সেটাই এই
       * `freeExams` — তাই ১০-এর পরে যত ফ্রি পরীক্ষা (আর তাদের কোর্স) ছিল,
       * সেগুলো ব্যবহারকারীর চোখেই পড়ত না। বাস্তবে ঠিক সেটাই হয়েছিল:
       * ম্যাথ কোর্সের পরীক্ষাগুলো তালিকায় ছিল না, অথচ কার্ডে "মোট ১৯টি" লেখা।
       *
       * এখন পুরো তালিকাই পাঠানো হয়। `freeExamCount` আগের মতোই সত্যিকারের
       * মোট — দুই জায়গায় একই সংখ্যা হলে ব্যবহারকারী আর দ্বিধায় পড়েন না।
       *
       * সুরক্ষার জন্য একটা **উদার** ঊর্ধ্বসীমা (২০০) রাখা হলো, যাতে কোনো
       * অস্বাভাবিক ডেটাসেটে হোম-পেলোড ফুলে না ওঠে। ফ্রি পরীক্ষা যদি একদিন
       * এর চেয়েও বাড়ে, সঠিক সমাধান এই সীমা বাড়ানো নয় — আলাদা পেজিনেটেড
       * রুট বানানো, যেটা কার্ড খোলার সময়ই আনা হবে।
       */
      if (free.length < 200) free.push(e);
    }
  }

  live.sort((a, b) => (examToDto(a, nowMs).endTimeMs ?? 0) - (examToDto(b, nowMs).endTimeMs ?? 0));
  upcoming.sort(
    (a, b) => (examToDto(a, nowMs).startTimeMs ?? 0) - (examToDto(b, nowMs).startTimeMs ?? 0)
  );

  const examDto = (e: Exam, isLive: boolean) => ({
    ...examToDto(e, nowMs),
    // পেইড পরীক্ষায় এই শিক্ষার্থী ঢুকতে পারবে কি না — অ্যাপের কার্ডে তালা দেখানোর জন্য।
    // (আসল প্রতিরোধ /questions ও /submit-এ; এটা কেবল UI-সূত্র)
    canAttempt: e.isFree !== false || owns(e.course),
    /** ইতিমধ্যে দেওয়া হয়ে গেছে কি না — ড্যাশবোর্ডে "সম্পন্ন" টিক */
    isCompleted: completed.has(e.id),
    isLiveFlag: isLive,
  });

  // ── গণনার খুঁটিনাটি (কোর্স-কার্ডের জন্য) ──
  // ঠিক `/api/courses`-এর মতোই হিসাব, যাতে দুই রুট কখনো আলাদা না হয়।
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

  // ── কোর্স-কার্ডের পূর্ণ তথ্য ──
  //
  // ⚠️ ২০২৬-০৯-১৭: আগে এখানে কেবল `{courseName, title, isEnrolled}` যেত।
  // নতুন অ্যাপ-ডিজাইনে (Stitch) হোমের কোর্স-কার্ডে **দাম, কাটা দাম, ছাড়ের
  // শতাংশ, পরীক্ষার সংখ্যা ও ভিডিওর সংখ্যা** দেখাতে হয় — কিন্তু `/api/home`-এ
  // ওগুলো ছিল না, আর `/api/courses` আলাদা করে ডাকলে "এক কলেই ড্যাশবোর্ড"
  // নীতি ভাঙত (এই ফাইলের §কারণ দেখুন)।
  //
  // তাই `/api/courses` যা পাঠায়, ঠিক সেটাই এখানেও আনা হচ্ছে — একই অ্যাকশন
  // (`getCoursePrices` · `getCourseVideoCounts`) ব্যবহার করে, যাতে দুই রুটের
  // মান কখনো আলাদা হয়ে না যায়। (দুটোই উপরের `Promise.all`-এ আনা হয়েছে।)

  // ছাড়ের শতাংশ সার্ভারেই হিসাব করা হয় — UI-তে ভাগ-গুণ করতে দিলে দুই
  // ক্লায়েন্টে দুই রকম রাউন্ডিং আসত, আর ওয়েবের সাথে অ্যাপ মিলত না।
  const discountPercent = (price: number | null, offer: number | null): number | null => {
    if (!price || !offer || offer >= price) return null;
    return Math.round(((price - offer) / price) * 100);
  };

  const courses = (config?.courses || [])
    .map((c) => String(c || "").trim())
    .filter(Boolean)
    .map((name) => {
      const price = prices[name] || {};
      return {
        courseName: name,
        title: name,
        isEnrolled: owns(name),

        // ── দাম (কোর্স-কার্ডের নিচের স্তর) ──
        priceTaka: price.price ?? null,
        offerPriceTaka: price.offerPrice ?? null,
        discountPercent: discountPercent(price.price ?? null, price.offerPrice ?? null),
        /**
         * "সম্পূর্ণ ফ্রি" — ওয়েব ঠিক এই শর্তেই (`CourseCardGrid.tsx:145`)
         * ফ্রি ধরে: `price === 0 || offerPrice === 0`। অ্যাপে আলাদা করে
         * অনুমান করতে দিলে দুই ক্লায়েন্ট একদিন আলাদা কথা বলত, তাই সার্ভারেই
         * সিদ্ধান্ত নেওয়া হয়।
         */
        isFree: price.price === 0 || price.offerPrice === 0,
        description: price.description ?? null,
        /** ওয়েবের কার্ড-ট্যাগ: "পরীক্ষা N" · "ভিডিও N" (পরিকল্পিত মোট) */
        plannedExams: price.plannedExams ?? null,
        plannedVideos: price.plannedVideos ?? null,
        /** ওয়েবে যেগুলো "Nটি বিষয়ের কনটেন্ট" বুলেটে যায় */
        subjectCount: subjectCounts[name] ?? 0,
        examCount: examCounts[name] ?? 0,
        /** "জনপ্রিয়" ব্যাজ — ওয়েবের `pinnedCourses` */
        isPopular: pinned.has(name),
        videoCount: videoCounts[name] ?? 0,
        hasVideos: (videoCounts[name] ?? 0) > 0,
      };
    })
    // জনপ্রিয় কোর্স আগে — `/api/courses`-এর সাথে হুবহু এক ক্রম
    .sort((a, b) => (a.isPopular === b.isPopular ? 0 : a.isPopular ? -1 : 1));

  return apiOk({
    // ── অ্যাপের হেডার / প্রোফাইল পিল ──
    isLoggedIn: !!ctx.identity,
    ...profileToDto(profile),
    // Bearer-এ যাচাই করা লোকটির নাম/ছবি (রোস্টার-রো না থাকলেও দেখানো যায়)
    displayName: profile?.name || ctx.identity?.name || null,
    displayPhotoURL: profile?.photoURL || null,

    // ── সেকশনগুলো ──
    liveExams: live.map((e) => examDto(e, true)),
    upcomingExams: upcoming.map((e) => examDto(e, false)),
    freeExams: free.map((e) => examDto(e, live.includes(e))),
    /**
     * সত্যিকারের মোট — `freeExams` ১০টায় কাটা, তাই ওটার `length` দিয়ে
     * পর্দায় সংখ্যা লিখলে কম দেখাত। কার্ডের লেখার জন্য এটাই ব্যবহার করুন।
     */
    freeExamCount: freeTotal,
    courses,

    news: (news || []).slice(0, 10).map((n) => ({
      id: n.id,
      title: n.heading,
      body: n.body,
      publishedAtMs: n.createdAt ? Date.parse(n.createdAt) || 0 : 0,
      read: false,
    })),

    // ── ছোট স্ট্যাট কার্ড ──
    stats: ctx.identity
      ? {
          completedExamCount: completed.size,
          enrolledCourseCount: courses.filter((c) => c.isEnrolled).length,
          totalCourseCount: courses.length,
        }
      : null,
  });
});
