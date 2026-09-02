"use server";

import { supabase } from "@/lib/supabase";
import { parseBangladeshDateTime } from "@/lib/bangladesh-time";

export interface NotifItem {
  id: string;
  type: "exam_start" | "exam_soon_end" | "new_video" | "new_exam";
  title: string;
  body: string;
  timeISO: string;
}

const DAY = 24 * 60 * 60 * 1000;
const START_SOON_MS = 60 * 60 * 1000; // ১ ঘণ্টার মধ্যে শুরু
const END_SOON_MS = 45 * 60 * 1000; // ৪৫ মিনিটের মধ্যে শেষ

/**
 * সাম্প্রতিক নোটিফিকেশন:
 * - শীঘ্রই শুরু হতে যাওয়া (১ ঘণ্টার মধ্যে) / শেষ হতে যাওয়া (৪৫ মিনিটের মধ্যে) পরীক্ষা
 * - গত ১ দিনে যোগ হওয়া নতুন পরীক্ষা ও নতুন ভিডিও
 * কলার নির্দিষ্ট স্টুডেন্ট নয় — সবার জন্য একই ইভেন্ট (কোর্সের নাম মেসেজে থাকে)।
 */
export async function getRecentNotifications(): Promise<NotifItem[]> {
  const now = Date.now();
  const items: NotifItem[] = [];
  const push = (t: NotifItem) => items.push(t);

  // ---- exams (created_at না থাকলে fallback — নিচের কোনো কোয়েরি যেন সব নষ্ট না করে)
  let examsRows: any[] = [];
  try {
    const { data, error } = await supabase
      .from("exams")
      .select("id,title,course,start_time,end_time,leaderboard_end_time,created_at")
      .limit(80);
    if (!error) examsRows = data || [];
    else if ((error as any)?.code === "42703" || /created_at/.test(String(error?.message || ""))) {
      const retry = await supabase
        .from("exams")
        .select("id,title,course,start_time,end_time,leaderboard_end_time")
        .limit(80);
      if (!retry.error) examsRows = retry.data || [];
    }
  } catch {
    examsRows = [];
  }

  (examsRows || []).forEach((ex: any) => {
    const title = String(ex.title || "").trim();
    if (!title) return;
    const course = String(ex.course || "").trim();
    const start = parseBangladeshDateTime(ex.start_time);
    const end = parseBangladeshDateTime(ex.end_time) || parseBangladeshDateTime(ex.leaderboard_end_time);

    // নতুন পরীক্ষা (গত ১ দিন) — created_at থাকলে
    const created = ex.created_at ? new Date(ex.created_at).getTime() : 0;
    if (created && now - created < DAY && now - created > -60 * 1000) {
      push({
        id: `new_exam_${ex.id}`,
        type: "new_exam",
        title: "নতুন পরীক্ষা যুক্ত হয়েছে",
        body: `"${title}"${course ? ` (${course})` : ""} — এখন থেকে দেওয়া যাবে।`,
        timeISO: new Date(created).toISOString()
      });
    }

    // শীঘ্রই শুরু
    if (start) {
      const diff = start.getTime() - now;
      if (diff > 0 && diff <= START_SOON_MS) {
        push({
          id: `start_${ex.id}`,
          type: "exam_start",
          title: "পরীক্ষা শুরুর সময় ঘনিয়ে এসেছে",
          body: `"${title}" শীঘ্রই শুরু হবে — প্রস্তুত থাকুন!`,
          timeISO: new Date(start.getTime()).toISOString()
        });
      }
    }

    // শেষ হতে বাকি (চলমান পরীক্ষা)
    if (end && end.getTime() > now && end.getTime() - now <= END_SOON_MS) {
      const started = start ? now >= start.getTime() : true;
      if (started) {
        push({
          id: `end_${ex.id}`,
          type: "exam_soon_end",
          title: "পরীক্ষা প্রায় শেষ",
          body: `"${title}" শেষ হতে আর বেশি সময় নেই — উত্তরপত্র জমা দিন।`,
          timeISO: new Date(end.getTime()).toISOString()
        });
      }
    }
  });

  // ---- new videos (গত ১ দিন)
  try {
    const { data: vids } = await supabase
      .from("course_videos")
      .select("id,course,title,created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    (vids || []).forEach((v: any) => {
      const t = v.created_at ? new Date(v.created_at).getTime() : 0;
      const title = String(v.title || "").trim();
      if (t && now - t < DAY && title) {
        push({
          id: `video_${v.id}`,
          type: "new_video",
          title: "নতুন ভিডিও ক্লাস",
          body: `"${title}"${v.course ? ` (${v.course})` : ""} — ভিডিও ক্লাসে দেখুন।`,
          timeISO: new Date(t).toISOString()
        });
      }
    });
  } catch {
    // ভিডিও টেবিল না থাকলে কিছু হবে না
  }

  return items
    .sort((a, b) => new Date(b.timeISO).getTime() - new Date(a.timeISO).getTime())
    .slice(0, 15);
}
