import { apiOk, profileToDto, resolveStudentProfile, withApi } from "@/lib/api-auth";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { getDailyNews } from "@/actions/news-actions";
import { getCompletedExamKeys } from "@/actions/student-actions";
import { examToDto } from "@/lib/exam-api";
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
  const [config, news, profile, completedKeys] = await Promise.all([
    fetchAppConfigLite(),
    getDailyNews(),
    ctx.identity ? resolveStudentProfile(ctx.identity) : Promise.resolve(null),
    ctx.identity
      ? getCompletedExamKeys(ctx.identity.uid, ctx.identity.email).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
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

  for (const e of exams) {
    const dto = examToDto(e, nowMs);
    // উইন্ডো-হীন সর্বদা-খোলা পরীক্ষা live/upcoming তালিকায় যায় না
    if (dto.startTimeMs !== null && dto.endTimeMs !== null) {
      if (dto.isLive) live.push(e);
      else if (dto.isUpcoming) upcoming.push(e);
    }
    if (e.isFree !== false && free.length < 10) free.push(e);
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

  const courses = (config?.courses || [])
    .map((c) => String(c || "").trim())
    .filter(Boolean)
    .map((name) => ({
      courseName: name,
      title: name,
      isEnrolled: owns(name),
    }));

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
