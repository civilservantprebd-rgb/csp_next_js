"use server";

import { supabase } from "@/lib/supabase";
import { CoursePdfItem } from "@/types/pdf";
import { requireTeacher } from "@/lib/teacher-auth";

function parsePdfsFromDetails(rawDetails: any): CoursePdfItem[] {
  if (!rawDetails) return [];
  try {
    const parsed = typeof rawDetails === "string" ? JSON.parse(rawDetails) : rawDetails;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.pdfs)) return parsed.pdfs;
    return [];
  } catch {
    return [];
  }
}

/**
 * নির্দিষ্ট কোর্সের সমস্ত পিডিএফ তালিকা (পাবলিক / স্টুডেন্ট)
 */
export async function getCoursePdfs(course: string): Promise<CoursePdfItem[]> {
  const cleanCourse = String(course || "").trim();
  if (!cleanCourse) return [];

  try {
    const { data, error } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (error) {
      console.error("getCoursePdfs error:", error);
      return [];
    }

    return parsePdfsFromDetails(data?.details);
  } catch (err) {
    console.error("getCoursePdfs unexpected error:", err);
    return [];
  }
}

/**
 * সমস্ত কোর্সের এক্সাম পিডিএফের ম্যাপ (examId -> CoursePdfItem)
 * অ্যাডমিন প্যানেলে এক্সাম সেটে কোনগুলোতে পিডিএফ যুক্ত আছে তা দ্রুত দেখানোর জন্য
 */
export async function getAllCoursePdfsMap(): Promise<Record<string, CoursePdfItem>> {
  try {
    await requireTeacher();
    const { data, error } = await supabase
      .from("course_prices")
      .select("course, details");

    if (error) {
      console.error("getAllCoursePdfsMap error:", error);
      return {};
    }

    const map: Record<string, CoursePdfItem> = {};
    (data || []).forEach((row) => {
      const pdfs = parsePdfsFromDetails(row.details);
      pdfs.forEach((p) => {
        if (p.examId) {
          map[p.examId] = p;
        }
      });
    });

    return map;
  } catch (err) {
    console.error("getAllCoursePdfsMap unexpected error:", err);
    return {};
  }
}

export interface SaveExamPdfInput {
  examId: string;
  course: string;
  subject: string;
  title: string;
  driveLink: string;
}

/**
 * এক্সাম সেটে গুগল ড্রাইভ লিংক ও টাইটেল সংরক্ষণ (শিক্ষক-অনলি)
 */
export async function saveExamPdf(
  payload: SaveExamPdfInput
): Promise<{ success: boolean; message: string; pdf?: CoursePdfItem }> {
  try {
    await requireTeacher();

    const cleanExamId = String(payload.examId || "").trim();
    const cleanCourse = String(payload.course || "").trim();
    const cleanSubject = String(payload.subject || "").trim();
    const cleanTitle = String(payload.title || "").trim();
    let cleanLink = String(payload.driveLink || "").trim();

    if (!cleanExamId) return { success: false, message: "এক্সাম আইডি পাওয়া যায়নি।" };
    if (!cleanCourse) return { success: false, message: "কোর্সের নাম পাওয়া যায়নি।" };
    if (!cleanTitle) return { success: false, message: "পিডিএফের টাইটেল দিন।" };
    if (!cleanLink) return { success: false, message: "গুগল ড্রাইভ লিংক দিন।" };

    if (!cleanLink.startsWith("http://") && !cleanLink.startsWith("https://")) {
      cleanLink = `https://${cleanLink}`;
    }

    // বিদ্যমান সারি আনা
    const { data: existingRow, error: selErr } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (selErr) {
      console.warn("saveExamPdf fetch existing warning:", selErr);
    }

    const currentPdfs = parsePdfsFromDetails(existingRow?.details);
    const filtered = currentPdfs.filter((p) => p.examId !== cleanExamId);

    const newPdf: CoursePdfItem = {
      id: `pdf_${cleanExamId}_${Date.now()}`,
      examId: cleanExamId,
      course: cleanCourse,
      subject: cleanSubject,
      title: cleanTitle,
      driveLink: cleanLink,
      createdAt: new Date().toISOString()
    };

    const updatedPdfs = [newPdf, ...filtered];

    const { error: upsertErr } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: cleanCourse,
          details: JSON.stringify({ type: "course_pdfs", pdfs: updatedPdfs })
        },
        { onConflict: "course" }
      );

    if (upsertErr) {
      console.error("saveExamPdf upsert error:", upsertErr);
      return { success: false, message: `সংরক্ষণ ব্যর্থ হয়েছে: ${upsertErr.message}` };
    }

    return { success: true, message: "পিডিএফ লিংক সফলভাবে সংরক্ষিত হয়েছে!", pdf: newPdf };
  } catch (err: any) {
    console.error("saveExamPdf unexpected error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।" };
  }
}

/**
 * এক্সাম থেকে পিডিএফ ড্রাইভ লিংক মুছে ফেলা (শিক্ষক-অনলি)
 */
export async function deleteExamPdf(
  course: string,
  examId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();

    const cleanCourse = String(course || "").trim();
    const cleanExamId = String(examId || "").trim();

    if (!cleanCourse || !cleanExamId) {
      return { success: false, message: "কোর্স বা এক্সাম আইডি পাওয়া যায়নি।" };
    }

    const { data: existingRow, error: selErr } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (selErr) {
      return { success: false, message: `ডাটা লোড ত্রুটি: ${selErr.message}` };
    }

    const currentPdfs = parsePdfsFromDetails(existingRow?.details);
    const updatedPdfs = currentPdfs.filter((p) => p.examId !== cleanExamId);

    const { error: upErr } = await supabase
      .from("course_prices")
      .update({
        details: JSON.stringify({ type: "course_pdfs", pdfs: updatedPdfs })
      })
      .eq("course", cleanCourse);

    if (upErr) {
      return { success: false, message: `মুছতে ব্যর্থ হয়েছে: ${upErr.message}` };
    }

    return { success: true, message: "পিডিএফ লিংক মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("deleteExamPdf error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।" };
  }
}
