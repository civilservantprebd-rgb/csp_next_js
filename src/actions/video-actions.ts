"use server";

import { supabase } from "@/lib/supabase";
import { CourseVideo } from "@/types/video";
import { requireTeacher, getSessionUserFromCookies, sessionOwnsStudent } from "@/lib/teacher-auth";
import { verifyStudentAccess } from "@/actions/student-actions";
import { extractYoutubeId } from "@/lib/youtube";

const TABLE = "course_videos";

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

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

/* ============================ অ্যাডমিন (টিচার-অনলি) ============================ */

/** অ্যাডমিন প্যানেলের জন্য সব ভিডিও — শুধু শিক্ষক */
export async function getCourseVideosAdmin(): Promise<CourseVideo[]> {
  try {
    await requireTeacher();
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(mapRow);
  } catch (err) {
    console.error("getCourseVideosAdmin error:", err);
    return [];
  }
}

/* ============================ পাবলিক (শুধু কাউন্ট — ভিডিও ID নয়) ============================ */

/** ফ্রন্ট-পেজ কোর্স কার্ডের জন্য প্রতি কোর্সে ভিডিও কাউন্ট — কোনো YouTube ID নেই */
export async function getCourseVideoCounts(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("course");
    if (error) throw error;
    const counts: Record<string, number> = {};
    (data || []).forEach((r) => {
      counts[r.course] = (counts[r.course] || 0) + 1;
    });
    return counts;
  } catch (err) {
    console.error("getCourseVideoCounts error:", err);
    return {};
  }
}

/* ============================ স্টুডেন্ট (সার্ভার-সাইড এনরোলমেন্ট গেট) ============================ */

export interface StudentVideoAccess {
  allowed: boolean;
  name?: string;
  message?: string;
  videos: CourseVideo[];
}

/**
 * কোর্সের ভিডিও শুধু ওই কোর্সে এনরোল্ড স্টুডেন্ট পায় — চেক সার্ভারে হয়:
 *
 * 1. Google/Supabase সেশন থাকলে (sb_access_token কুকি) → সেশন ইউজারকেই ধরবে;
 *    ক্লায়েন্টের পাঠানো id বিশ্বাস করা হয় না।
 * 2. সেশন না থাকলে ক্লায়েন্ট-পাঠানো id-ই একমাত্র পরিচয় (ম্যানুয়াল/মোবাইল স্টুডেন্ট)।
 *    কিন্তু সেটা যদি UUID-আকৃতির হয় (অন্য কারো uid অনুমান করে পাঠানো) → sessionOwnsStudent
 *    ব্যর্থ হওয়ায় সরাসরি নাকচ।
 * 3. এরপর allowed_students-এ ওই কোর্স (বা ALL) আছে কিনা — verifyStudentAccess দিয়ে।
 */
export async function getCourseVideosForStudent(
  course: string,
  clientIdentity?: { id?: string; email?: string } | null
): Promise<StudentVideoAccess> {
  const cleanCourse = String(course || "").trim();
  if (!cleanCourse) {
    return { allowed: false, message: "কোর্স পাওয়া যায়নি।", videos: [] };
  }

  try {
    // 1) প্রমাণিত সেশন (Google লগইন) — সবচেয়ে শক্তিশালী পরিচয়
    const sessionUser = await getSessionUserFromCookies();

    let identityId = sessionUser?.id || "";
    let identityEmail = sessionUser?.email || "";

    if (!sessionUser) {
      // 2) ম্যানুয়াল স্টুডেন্ট — ক্লায়েন্ট id গ্রহণযোগ্য শুধু মোবাইল/নন-UUID হলে
      const rawId = String(clientIdentity?.id || "").trim();
      if (!rawId) {
        return { allowed: false, message: "লগইন/আইডি প্রয়োজন।", videos: [] };
      }
      if (isUuidLike(rawId) && !(await sessionOwnsStudent(rawId))) {
        return { allowed: false, message: "অনুমোদিত নয়।", videos: [] };
      }
      identityId = rawId;
      identityEmail = String(clientIdentity?.email || "").trim();
    }

    // 3) এনরোলমেন্ট যাচাই (allowed_students-এ কোর্স/ALL আছে কিনা)
    const check = await verifyStudentAccess(identityId, cleanCourse, identityEmail || undefined);
    if (!check.allowed) {
      return {
        allowed: false,
        message: check.message || "এই কোর্সে আপনার এনরোলমেন্ট নেই — কোর্স কিনলে ভিডিও খুলবে।",
        videos: []
      };
    }

    // এনরোল্ড → ভিডিও দিন
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("course", cleanCourse)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;

    return {
      allowed: true,
      name: check.studentName,
      videos: (data || []).map(mapRow)
    };
  } catch (err) {
    console.error("getCourseVideosForStudent error:", err);
    const rlsDenied = /permission denied for table course_videos|42501/i.test(String((err as any)?.message || err));
    if (rlsDenied) {
      return {
        allowed: false,
        message: "ভিডিও সার্ভার কনফিগারেশন ত্রুটি — SUPABASE_SERVICE_ROLE_KEY সেট করা নেই (দেখুন .env.local.example)।",
        videos: []
      };
    }
    return { allowed: false, message: "ভিডিও লোড করতে সমস্যা হয়েছে।", videos: [] };
  }
}

/* ============================ লিখন (টিচার-অনলি) ============================ */

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
