"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher } from "@/lib/teacher-auth";

export interface DailyNewsItem {
  id: string;
  heading: string;
  body: string;
  createdAt: string;
}

/** হোম পেজ / স্টুডেন্টদের জন্য দৈনিক সংবাদ (সবার পড়তে পারা) — সর্বশেষ আগে */
export async function getDailyNews(): Promise<DailyNewsItem[]> {
  try {
    const { data, error } = await supabase
      .from("daily_news")
      .select("id, heading, body, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      heading: String(r.heading || ""),
      body: String(r.body || ""),
      createdAt: r.created_at || ""
    }));
  } catch (err) {
    console.error("getDailyNews error:", err);
    const missing = /daily_news/.test(String((err as any)?.message || err));
    if (missing) {
      // migration এখনো run করা হয়নি — UI তে খালি দেখাবে, ক্র্যাশ করবে না
      return [];
    }
    return [];
  }
}

/** শিক্ষক: নতুন সংবাদ যোগ */
export async function addDailyNews(heading: string, body: string): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const h = String(heading || "").trim();
    const b = String(body || "").trim();
    if (!h) return { success: false, message: "সংবাদের হেডিং লিখুন।" };
    if (!b) return { success: false, message: "সংবাদের বিস্তারিত (৩-৪ লাইন) লিখুন।" };

    const { error } = await supabase.from("daily_news").insert({
      heading: h,
      body: b
    });
    if (error) {
      if (/daily_news/.test(String(error.message || ""))) {
        return {
          success: false,
          message: "daily_news টেবিল এখনো নেই। Supabase SQL Editor-এ `supabase/migrations/2025_daily_news.sql` ফাইলটি Run করুন।"
        };
      }
      throw error;
    }
    return { success: true, message: "সংবাদ যোগ হয়েছে ✓" };
  } catch (err) {
    console.error("addDailyNews error:", err);
    return { success: false, message: "সংবাদ যোগ করতে সমস্যা হয়েছে।" };
  }
}

/** শিক্ষক: সংবাদ সম্পাদনা */
export async function updateDailyNews(
  id: string,
  heading: string,
  body: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const cleanId = String(id || "").trim();
    const h = String(heading || "").trim();
    const b = String(body || "").trim();
    if (!cleanId) return { success: false, message: "সংবাদটি খুঁজে পাওয়া যায়নি।" };
    if (!h || !b) return { success: false, message: "হেডিং ও বিস্তারিত দুটোই লিখুন।" };

    const { error } = await supabase.from("daily_news").update({ heading: h, body: b }).eq("id", cleanId);
    if (error) throw error;
    return { success: true, message: "সংবাদ আপডেট হয়েছে ✓" };
  } catch (err) {
    console.error("updateDailyNews error:", err);
    return { success: false, message: "সংবাদ আপডেট করতে সমস্যা হয়েছে।" };
  }
}

/** শিক্ষক: সংবাদ মুছে ফেলা */
export async function deleteDailyNews(id: string): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const cleanId = String(id || "").trim();
    if (!cleanId) return { success: false, message: "সংবাদটি খুঁজে পাওয়া যায়নি।" };

    const { error } = await supabase.from("daily_news").delete().eq("id", cleanId);
    if (error) throw error;
    return { success: true, message: "সংবাদটি মুছে ফেলা হয়েছে।" };
  } catch (err) {
    console.error("deleteDailyNews error:", err);
    return { success: false, message: "সংবাদ মুছতে সমস্যা হয়েছে।" };
  }
}
