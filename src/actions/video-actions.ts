"use server";

import { supabase } from "@/lib/supabase";
import { CourseVideo } from "@/types/video";
import { requireTeacher } from "@/lib/teacher-auth";
import { extractYoutubeId } from "@/lib/youtube";

const TABLE = "course_videos";

function mapRow(r: any): CourseVideo {
  return {
    id: Number(r.id),
    course: r.course || "",
    subject: r.subject || undefined,
    title: r.title || "",
    youtubeId: r.youtube_id || "",
    description: r.description || undefined,
    sortOrder: Number(r.sort_order ?? 0),
    createdAt: r.created_at
  };
}

/** কোনো কোর্সের (বা সব) ভিডিও — ভিডিও লিস্ট পেজ ও ফ্রন্ট-পেজ কাউন্টের জন্য */
export async function getCourseVideos(course?: string): Promise<CourseVideo[]> {
  try {
    let builder = supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (course) builder = builder.eq("course", String(course).trim());
    const { data, error } = await builder;
    if (error) throw error;
    return (data || []).map(mapRow);
  } catch (err: any) {
    // টেবিল এখনো তৈরি না হলে (42P01) খালি লিস্ট — অ্যাডমিন UI-তে SQL হিন্ট দেখানো হবে
    if (err?.code === "42P01" || /course_videos/.test(String(err?.message || err))) {
      return [];
    }
    console.error("getCourseVideos error:", err);
    return [];
  }
}

export interface CourseVideoInput {
  course: string;
  subject?: string;
  title: string;
  youtubeUrl: string;
  description?: string;
  sortOrder?: number;
}

export async function addCourseVideo(payload: CourseVideoInput): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();

    const course = String(payload.course || "").trim();
    const title = String(payload.title || "").trim();
    const youtubeId = extractYoutubeId(payload.youtubeUrl);
    if (!course || !title) return { success: false, message: "কোর্স ও ভিডিওর নাম দিন।" };
    if (!youtubeId) return { success: false, message: "সঠিক YouTube লিংক/ভিডিও ID দিন।" };

    const { error } = await supabase.from(TABLE).insert({
      course: course,
      subject: String(payload.subject || "").trim() || null,
      title: title,
      youtube_id: youtubeId,
      description: String(payload.description || "").trim() || null,
      sort_order: Number(payload.sortOrder ?? 0)
    });
    if (error) throw error;
    return { success: true, message: "ভিডিও যুক্ত হয়েছে ✓" };
  } catch (err: any) {
    if (err?.code === "42P01" || /course_videos/.test(String(err?.message || err))) {
      return {
        success: false,
        message: "course_videos টেবিল এখনো নেই। Supabase SQL Editor-এ `supabase/course_videos.sql` ফাইলটি Run করুন।"
      };
    }
    console.error("addCourseVideo error:", err);
    return { success: false, message: "ভিডিও যোগ করতে সমস্যা হয়েছে।" };
  }
}

export async function updateCourseVideo(
  id: number,
  payload: CourseVideoInput
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const youtubeId = extractYoutubeId(payload.youtubeUrl);
    if (!youtubeId) return { success: false, message: "সঠিক YouTube লিংক/ভিডিও ID দিন।" };

    const { error } = await supabase
      .from(TABLE)
      .update({
        course: String(payload.course).trim(),
        subject: String(payload.subject || "").trim() || null,
        title: String(payload.title || "").trim(),
        youtube_id: youtubeId,
        description: String(payload.description || "").trim() || null,
        sort_order: Number(payload.sortOrder ?? 0)
      })
      .eq("id", Number(id));
    if (error) throw error;
    return { success: true, message: "ভিডিও আপডেট হয়েছে ✓" };
  } catch (err: any) {
    console.error("updateCourseVideo error:", err);
    return { success: false, message: "আপডেট করতে সমস্যা হয়েছে।" };
  }
}

export async function deleteCourseVideo(id: number): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const { error } = await supabase.from(TABLE).delete().eq("id", Number(id));
    if (error) throw error;
    return { success: true, message: "ভিডিও মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("deleteCourseVideo error:", err);
    return { success: false, message: "মুছতে সমস্যা হয়েছে।" };
  }
}
