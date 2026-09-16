import { apiOk, profileToDto, requireStudent, resolveStudentProfile, withApi } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/student/me — API কন্ট্রাক্ট v1 #2 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * সেশন-বাঁধা শিক্ষার্থীর প্রোফাইল + এনরোলমেন্ট স্ট্যাটাস।
 *
 * শিক্ষার্থী Supabase-এ লগইন করা কিন্তু রোস্টারে না থাকলে 404 নয়, বরং
 * `registered: false` সহ 200 দেওয়া হয় — অ্যাপ তখন "এনরোল করুন" স্ক্রিন
 * দেখাবে (এটা ত্রুটি নয়, স্বাভাবিক অবস্থা)।
 */
export const GET = withApi("student", async (ctx) => {
  const identity = requireStudent(ctx);
  const profile = await resolveStudentProfile(identity);

  if (!profile) {
    return apiOk({
      ...profileToDto(null),
      // অ্যাপ যাতে লগইন-করা লোকটির নাম/ছবি দেখাতে পারে, রোস্টার-রো না থাকলেও
      studentId: identity.uid,
      name: identity.name ?? null,
      email: identity.email ?? null,
      photoURL: null,
    });
  }

  return apiOk({
    ...profileToDto(profile),
    // submission/notebook/portal — সব জায়গায় এই id-তেই keyed
    studentId: profile.id,
    name: profile.name,
    email: profile.email,
    photoURL: profile.photoURL || null,
  });
});
