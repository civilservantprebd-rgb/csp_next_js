"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher } from "@/lib/teacher-auth";

export interface CoursePrice {
  price?: number;
  offerPrice?: number;
  /** পরিকল্পিত মোট: কোর্সের শেষ পর্যন্ত যতটা পরীক্ষা/ভিডিও দেয়া হবে */
  plannedExams?: number;
  plannedVideos?: number;
  /** কোর্সের সংক্ষিপ্ত বিবরণ (বাংলা) — কার্ডে টাইটেলের নিচে দেখায় */
  description?: string;
}

/** সব কোর্সের দাম ও পরিকল্পিত সংখ্যা (পাবলিক — হোম পেজের কার্ডে) */
export async function getCoursePrices(): Promise<Record<string, CoursePrice>> {
  try {
    const { data, error } = await supabase.from("course_prices").select("*");
    if (error) throw error;
    const out: Record<string, CoursePrice> = {};
    (data || []).forEach((r: any) => {
      const num = (v: any): number | undefined =>
        v === null || v === undefined ? undefined : Number(v);
      out[String(r.course)] = {
        price: num(r.price),
        offerPrice: num(r.offer_price),
        plannedExams: num(r.planned_exams),
        plannedVideos: num(r.planned_videos),
        description: r.description ? String(r.description) : undefined
      };
    });
    return out;
  } catch (err) {
    console.error("Get course prices error:", err);
    return {};
  }
}

/** একটি কোর্সের দাম/ছাড় + পরিকল্পিত পরীক্ষা/ভিডিও সংখ্যা সেভ (শিক্ষক-অনলি) */
export async function saveCoursePrice(
  course: string,
  price?: number | null,
  offerPrice?: number | null,
  plannedExams?: number | null,
  plannedVideos?: number | null,
  description?: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const name = String(course || "").trim();
    if (!name) return { success: false, message: "কোর্সের নাম দিন।" };

    const cleanNum = (v: number | null | undefined): number | null => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) || n < 0 ? null : Math.round(n);
    };
    const cleanPrice = (v: number | null | undefined): number | null => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) || n < 0 ? null : Math.round(n * 100) / 100;
    };

    const { error } = await supabase.from("course_prices").upsert(
      {
        course: name,
        price: cleanPrice(price),
        offer_price: cleanPrice(offerPrice),
        planned_exams: cleanNum(plannedExams),
        planned_videos: cleanNum(plannedVideos),
        description: String(description || "").trim() || null
      },
      { onConflict: "course" }
    );
    if (error) {
      if ((error as any)?.code === "42P01" || /course_prices/.test(String(error?.message || ""))) {
        return {
          success: false,
          message: "course_prices টেবিলটি এখনো নেই — Supabase SQL Editor-এ মাইগ্রেশন ফাইলটি Run করুন (supabase/migrations/2025_course_prices.sql)।"
        };
      }
      throw error;
    }
    return { success: true, message: `"${name}"-এর তথ্য সংরক্ষণ হয়েছে ✓` };
  } catch (err) {
    console.error("Save course price error:", err);
    return { success: false, message: "সংরক্ষণে সমস্যা হয়েছে।" };
  }
}
