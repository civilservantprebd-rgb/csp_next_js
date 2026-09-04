"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher } from "@/lib/teacher-auth";

export interface DailyNewsItem {
  id: string;
  heading: string;
  body: string;
  createdAt: string;
  readCount: number;
  /** অটোমেশন-সংযোজিত: পত্রিকার নাম (যেমন: প্রথম আলো) */
  source?: string | null;
  /** অটোমেশন-সংযোজিত: ক্যাটাগরি লেবেল (যেমন: অর্থনীতি ও ব্যাংকিং) */
  category?: string | null;
  /** মূল খবরের লিংক */
  sourceUrl?: string | null;
  /** ডাইজেস্ট তারিখ (YYYY-MM-DD) */
  newsDate?: string | null;
  /** আজকের গুরুত্বপূর্ণ খবর হিসেবে চিহ্নিত */
  isHighlight?: boolean | null;
}

export interface DailyNewsDigest {
  date: string;
  pdfUrl?: string | null;
  htmlUrl?: string | null;
  itemCount: number;
  mode?: string | null;
  updatedAt?: string | null;
}

/** অটোমেশন-কলাম থাকা-না-থাকা অনুযায়ী নিরাপদে মান বের করে */
function toItem(r: any): DailyNewsItem {
  return {
    id: String(r?.id || ""),
    heading: String(r?.heading || ""),
    body: String(r?.body || ""),
    createdAt: r?.created_at || "",
    readCount: Number(r?.read_count ?? 0),
    source: r?.source != null ? String(r.source) : null,
    category: r?.category != null ? String(r.category) : null,
    sourceUrl: r?.source_url != null ? String(r.source_url) : null,
    newsDate: r?.news_date != null ? String(r.news_date) : null,
    isHighlight: r?.is_highlight != null ? Boolean(r.is_highlight) : null
  };
}

/**
 * হোম পেজ / স্টুডেন্টদের জন্য দৈনিক সংবাদ (সবার পড়তে পারা) — সর্বশেষ আগে।
 * @param limit কতগুলো আনা হবে — অটোমেশনে দিনে ~১০০টি সংবাদ জমা হয়, তাই আর্কাইভ
 *   ক্যালেন্ডারে পুরনো দিন দেখাতে বড় লিমিট পাঠানো হয় (হোম পেজ: ২৫০০)।
 */
export async function getDailyNews(limit: number = 100): Promise<DailyNewsItem[]> {
  const trySelect = async (cols: string, lim: number) => {
    const { data, error } = await supabase
      .from("daily_news")
      .select(cols)
      .order("created_at", { ascending: false })
      .limit(lim);
    if (error) throw error;
    return (data || []).map(toItem);
  };
  try {
    // নতুন (migration-পরবর্তী) কলামসহ — না থাকলে ত্রুটি ধরে base কলামে ফিরে যায়
    return await trySelect(
      "id, heading, body, created_at, read_count, source, source_url, category, news_date, is_highlight",
      limit
    );
  } catch (err) {
    const msg = String((err as any)?.message || err || "");
    if (/read_count|source|category|news_date|is_highlight|column/i.test(msg)) {
      try {
        return await trySelect("id, heading, body, created_at, read_count", limit);
      } catch {
        try {
          return await trySelect("id, heading, body, created_at", limit);
        } catch {
          return [];
        }
      }
    }
    return []; // টেবিল না থাকলে চুপচাপ খালি
  }
}

/** প্রতিদিনের ডাইজেস্ট (PDF/HTML লিংক) — সর্বশেষ আগে; টেবিল না থাকলে খালি */
export async function getDailyNewsDigests(limit: number = 45): Promise<DailyNewsDigest[]> {
  try {
    const { data, error } = await supabase
      .from("daily_news_digests")
      .select("digest_date, pdf_url, html_url, item_count, mode, updated_at")
      .order("digest_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((r: any) => ({
      date: String(r?.digest_date || ""),
      pdfUrl: r?.pdf_url != null ? String(r.pdf_url) : null,
      htmlUrl: r?.html_url != null ? String(r.html_url) : null,
      itemCount: Number(r?.item_count ?? 0),
      mode: r?.mode != null ? String(r.mode) : null,
      updatedAt: r?.updated_at || null
    }));
  } catch {
    return []; // migration চালানো না হলে খালি দেখাবে — ক্র্যাশ করবে না
  }
}

/**
 * কোনো সংবাদ খুলে পড়া হলে read_count ১ বাড়ায়।
 * ক্লায়েন্ট প্রতি খোলায় কল করে — অ্যাডমিন প্যানেলে ভিউ-কাউন্ট দেখানো হয়।
 */
export async function incrementNewsRead(id: string): Promise<void> {
  try {
    const cleanId = String(id || "").trim();
    if (!cleanId) return;
    // read_count কলাম না থাকলে কোনো ক্ষতি নেই (নীরবে ব্যর্থ)
    await supabase.rpc("increment_daily_news_read", { row_id: cleanId });
  } catch {
    // নীরবে ব্যর্থ — পড়ার অভিজ্ঞতা যেন কখনো ভাঙে না
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
