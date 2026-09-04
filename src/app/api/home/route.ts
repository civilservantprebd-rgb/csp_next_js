import { NextResponse } from "next/server";
import { fetchAppConfigLite } from "@/actions/admin-actions";
import { getDailyNews } from "@/actions/news-actions";
import type { Exam } from "@/types/exam";

export const dynamic = "force-dynamic";

// GET /api/home — Native অ্যাপের ড্যাশবোর্ড aggregate (১ কল = সব সেকশন)
// API কন্ট্রাক্ট v1 (NATIVE-ANDROID-GUIDE.md §6.1 #8)। সার্ভার action রিইউজ — কোনো লজিক ডুপ্লিকেট নয়।
// TODO (ফেজ ১ সম্পূর্ণ): auth-token থেকে student-নির্দিষ্ট ডেটা (এনরোলমেন্ট, স্ট্যাট) যোগ করবেন।

function examToDto(exam: Exam, nowMs: number, isLive: boolean) {
  const start = exam.startTime ? Date.parse(exam.startTime) : NaN;
  const end = exam.endTime ? Date.parse(exam.endTime) : NaN;
  const durationSeconds = (exam.timerMinutes || 60) * 60;
  return {
    examId: exam.id,
    title: exam.title,
    startTimeMs: Number.isFinite(start) ? start : nowMs,
    endTimeMs: Number.isFinite(end) ? end : nowMs + durationSeconds * 1000,
    durationSeconds,
    isFree: exam.isFree !== false,
    isLive,
  };
}

export async function GET() {
  const nowMs = Date.now();
  const [config, news] = await Promise.all([fetchAppConfigLite(), getDailyNews()]);

  const exams = Object.values(config.exams || {}).filter(
    (e): e is Exam => Boolean(e && e.id && e.title)
  );

  const live: Exam[] = [];
  const upcoming: Exam[] = [];
  const free: Exam[] = [];
  for (const e of exams) {
    const start = e.startTime ? Date.parse(e.startTime) : NaN;
    const end = e.endTime ? Date.parse(e.endTime) : NaN;
    if (Number.isFinite(start) && Number.isFinite(end)) {
      if (nowMs >= start && nowMs <= end) live.push(e);
      else if (nowMs < start) upcoming.push(e);
    }
    if (e.isFree !== false && free.length < 10) free.push(e);
  }
  live.sort((a, b) => Date.parse(a.endTime || "") - Date.parse(b.endTime || ""));
  upcoming.sort((a, b) => Date.parse(a.startTime || "") - Date.parse(b.startTime || ""));

  return NextResponse.json({
    serverTimeMs: nowMs,
    liveExams: live.map((e) => examToDto(e, nowMs, true)),
    upcomingExams: upcoming.map((e) => examToDto(e, nowMs, false)),
    freeExams: free.map((e) => examToDto(e, nowMs, live.includes(e))),
    courses: (config.courses || []).map((c) => ({
      courseName: c,
      title: c,
      priceTaka: null,
      isEnrolled: false,
      hasVideos: false,
    })),
    news: (news || []).map((n) => ({
      id: n.id,
      title: n.heading,
      body: n.body,
      publishedAtMs: n.createdAt ? Date.parse(n.createdAt) : 0,
      read: false,
    })),
    stats: null,
  });
}
