"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher } from "@/lib/teacher-auth";

export interface CourseWhatsAppLink {
  course: string;
  link: string;
}

/** শিক্ষক: সব কোর্সের WhatsApp লিংক তালিকা (ম্যানেজার UI-র জন্য) */
export async function getAllWhatsAppLinks(): Promise<CourseWhatsAppLink[]> {
  try {
    await requireTeacher();
    const { data, error } = await supabase.from("course_whatsapp").select("course, link").order("course", { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => ({ course: String(r.course || ""), link: String(r.link || "") }));
  } catch (err) {
    console.error("getAllWhatsAppLinks error:", err);
    return [];
  }
}

/** শিক্ষক: একটি কোর্সের WhatsApp গ্রুপ লিংক সেভ (খালি দিলে মুছে যায়) */
export async function saveWhatsAppLink(
  course: string,
  link: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const c = String(course || "").trim();
    if (!c) return { success: false, message: "কোর্সের নাম দিন।" };

    const l = String(link || "").trim();
    if (!l) {
      // খালি → মুছে ফেলা
      const { error } = await supabase.from("course_whatsapp").delete().eq("course", c);
      if (error) throw error;
      return { success: true, message: `"${c}"-এর WhatsApp লিংক সরানো হয়েছে।` };
    }
    if (!/^https?:\/\//i.test(l)) {
      return { success: false, message: "সঠিক লিংক দিন (https:// দিয়ে শুরু)।" };
    }

    const { error } = await supabase.from("course_whatsapp").upsert(
      { course: c, link: l, updated_at: new Date().toISOString() },
      { onConflict: "course" }
    );
    if (error) {
      if (/course_whatsapp/.test(String(error.message || ""))) {
        return {
          success: false,
          message: "course_whatsapp টেবিল এখনো নেই। Supabase SQL Editor-এ `supabase/migrations/2025_course_whatsapp.sql` ফাইলটি Run করুন।"
        };
      }
      throw error;
    }
    return { success: true, message: `"${c}"-এর WhatsApp গ্রুপ লিংক সেভ হয়েছে ✓` };
  } catch (err) {
    console.error("saveWhatsAppLink error:", err);
    return { success: false, message: "লিংক সেভ করতে সমস্যা হয়েছে।" };
  }
}

/**
 * স্টুডেন্ট: নিজের এনরোল্ড কোর্সগুলোর WhatsApp লিংক (যেকোনো একটি কোর্সে
 * এনরোল্ড থাকলেই — কোর্স-স্কোপ নয়)। শিক্ষক/অননুমোদিত হলে খালি।
 */
export async function getWhatsAppLinksForStudent(studentId?: string, email?: string): Promise<CourseWhatsAppLink[]> {
  try {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return [];

    const { isTeacherSession } = await import("@/lib/teacher-auth");
    if (await isTeacherSession()) return []; // শিক্ষককে স্টুডেন্ট প্রম্পট নয়

    const { verifyStudentAccess } = await import("@/actions/student-actions");
    const access = await verifyStudentAccess(cleanId, "ALL", email);
    if (!access.allowed) return [];

    const courses = (access.courses || [])
      .map((c: string) => String(c || "").trim())
      .filter(Boolean);
    if (courses.length === 0) return [];

    const { data, error } = await supabase
      .from("course_whatsapp")
      .select("course, link")
      .in("course", courses);
    if (error) {
      if (/course_whatsapp/.test(String(error.message || ""))) return [];
      throw error;
    }
    return (data || [])
      .map((r) => ({ course: String(r.course || ""), link: String(r.link || "") }))
      .filter((r) => r.link);
  } catch (err) {
    console.error("getWhatsAppLinksForStudent error:", err);
    return [];
  }
}

/**
 * কোর্স পেজ: একটি নির্দিষ্ট কোর্সের WhatsApp গ্রুপ লিংক — শুধু সেই কোর্সে
 * এনরোল্ড স্টুডেন্টই পায় (allowed_students যাচাই)। লিংক নেই / এনরোল্ড
 * নয় / শিক্ষক → খালি স্ট্রিং ফেরত।
 */
export async function getCourseWhatsAppForStudent(
  course: string,
  identity?: { id?: string; email?: string } | null
): Promise<string> {
  try {
    const name = String(course || "").trim();
    if (!name) return "";
    const cleanId = String(identity?.id || "").trim();
    const cleanEmail = String(identity?.email || "").trim().toLowerCase();
    if (!cleanId && !cleanEmail) return "";

    const { isTeacherSession } = await import("@/lib/teacher-auth");
    if (await isTeacherSession()) return ""; // শিক্ষক-সেশনকে স্টুডেন্ট লিংক নয়

    // ১) এই কোর্সের জন্য WhatsApp লিংক আছে?
    const { data: row } = await supabase
      .from("course_whatsapp")
      .select("link")
      .eq("course", name)
      .maybeSingle();
    if (row?.link) {
      // ২) স্টুডেন্ট কি এই কোর্সে এনরোল্ড? (id/email দিয়ে allowed_students ম্যাচ)
      const { verifyStudentAccess } = await import("@/actions/student-actions");
      const access = await verifyStudentAccess(cleanId || cleanEmail, name, cleanEmail);
      if (access.allowed) return String(row.link).trim();
    }
    return "";
  } catch (err) {
    console.error("getCourseWhatsAppForStudent error:", err);
    return "";
  }
}
