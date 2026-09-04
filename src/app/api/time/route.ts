import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// সিঙ্ক্রোনাইজড বাংলাদেশ সময় — API কন্ট্রাক্ট v1 (NATIVE-ANDROID-GUIDE.md §6.2)
// Web-এর পুরনো ক্লায়েন্ট (now/iso) ও native অ্যাপ (serverTimeMs/...) দুটোই কাজ করবে।
export async function GET() {
  const now = Date.now();
  return NextResponse.json({
    // --- বিদ্যমান ওয়েব কম্প্যাটিবিলিটি ---
    now,
    iso: new Date(now).toISOString(),
    // --- Native অ্যাপ কন্ট্রাক্ট (additive) ---
    serverTimeMs: now,
    ianaTimezone: "Asia/Dhaka",
    offsetFromUtcMinutes: 360,
  });
}
