"use server";

import { supabase } from "@/lib/supabase";
import { CoursePdfItem, CourseRoutineItem } from "@/types/pdf";
import { requireTeacher } from "@/lib/teacher-auth";

function parseDetailsPayload(rawDetails: any): { pdfs: CoursePdfItem[]; routines: CourseRoutineItem[] } {
  if (!rawDetails) return { pdfs: [], routines: [] };
  try {
    const parsed = typeof rawDetails === "string" ? JSON.parse(rawDetails) : rawDetails;
    if (Array.isArray(parsed)) {
      return { pdfs: parsed, routines: [] };
    }
    if (parsed && typeof parsed === "object") {
      const pdfs = Array.isArray(parsed.pdfs) ? parsed.pdfs : [];
      const routines = Array.isArray(parsed.routines) ? parsed.routines : [];
      return { pdfs, routines };
    }
    return { pdfs: [], routines: [] };
  } catch {
    return { pdfs: [], routines: [] };
  }
}

function parsePdfsFromDetails(rawDetails: any): CoursePdfItem[] {
  return parseDetailsPayload(rawDetails).pdfs;
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

    return parseDetailsPayload(data?.details).pdfs;
  } catch (err) {
    console.error("getCoursePdfs unexpected error:", err);
    return [];
  }
}

/**
 * নির্দিষ্ট কোর্সের সমস্ত রুটিন তালিকা (পাবলিক / স্টুডেন্ট)
 */
export async function getCourseRoutines(course: string): Promise<CourseRoutineItem[]> {
  const cleanCourse = String(course || "").trim();
  if (!cleanCourse) return [];

  try {
    const { data, error } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (error) {
      console.error("getCourseRoutines error:", error);
      return [];
    }

    return parseDetailsPayload(data?.details).routines;
  } catch (err) {
    console.error("getCourseRoutines unexpected error:", err);
    return [];
  }
}

/**
 * নির্দিষ্ট কোর্সের সমস্ত পিডিএফ ও রুটিন একসাথে লোড (পাবলিক / স্টুডেন্ট)
 */
export async function getCoursePdfsAndRoutines(
  course: string
): Promise<{ pdfs: CoursePdfItem[]; routines: CourseRoutineItem[] }> {
  const cleanCourse = String(course || "").trim();
  if (!cleanCourse) return { pdfs: [], routines: [] };

  try {
    const { data, error } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (error) {
      console.error("getCoursePdfsAndRoutines error:", error);
      return { pdfs: [], routines: [] };
    }

    return parseDetailsPayload(data?.details);
  } catch (err) {
    console.error("getCoursePdfsAndRoutines unexpected error:", err);
    return { pdfs: [], routines: [] };
  }
}

/**
 * সমস্ত কোর্সের এক্সাম পিডিএফের ম্যাপ (examId -> CoursePdfItem[])
 * অ্যাডমিন প্যানেলে এক্সাম সেটে কোনগুলোতে কয়টি পিডিএফ যুক্ত আছে তা দেখানোর জন্য
 */
export async function getAllCoursePdfsMap(): Promise<Record<string, CoursePdfItem[]>> {
  try {
    await requireTeacher();
    const { data, error } = await supabase
      .from("course_prices")
      .select("course, details");

    if (error) {
      console.error("getAllCoursePdfsMap error:", error);
      return {};
    }

    const map: Record<string, CoursePdfItem[]> = {};
    (data || []).forEach((row) => {
      const { pdfs } = parseDetailsPayload(row.details);
      pdfs.forEach((p) => {
        if (p.examId) {
          if (!map[p.examId]) map[p.examId] = [];
          map[p.examId].push(p);
        }
      });
    });

    return map;
  } catch (err) {
    console.error("getAllCoursePdfsMap unexpected error:", err);
    return {};
  }
}

export interface SaveCoursePdfInput {
  id?: string;
  course: string;
  subject: string;
  title: string;
  driveLink: string;
}

/**
 * কোর্স ও সাবজেক্টভিত্তিক নতুন পিডিএফ সংরক্ষণ বা এডিট (শিক্ষক-অনলি)
 * এটি কোনো নির্দিষ্ট এক্সামের সাথে বাঁধা নয় — সরাসরি কোর্স ও সাবজেক্টের সাথে যুক্ত থাকে।
 */
export async function saveCoursePdf(
  payload: SaveCoursePdfInput
): Promise<{ success: boolean; message: string; pdf?: CoursePdfItem }> {
  try {
    await requireTeacher();

    const cleanCourse = String(payload.course || "").trim();
    const cleanSubject = String(payload.subject || "সাধারণ").trim();
    const cleanTitle = String(payload.title || "").trim();
    let cleanLink = String(payload.driveLink || "").trim();
    const pdfId = payload.id && payload.id.trim() ? payload.id.trim() : `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!cleanCourse) return { success: false, message: "কোর্সের নাম নির্বাচন করুন।" };
    if (!cleanTitle) return { success: false, message: "পিডিএফের শিরোনাম বা নাম দিন।" };
    if (!cleanLink) return { success: false, message: "গুগল ড্রাইভ লিংক দিন।" };

    if (!cleanLink.startsWith("http://") && !cleanLink.startsWith("https://")) {
      cleanLink = `https://${cleanLink}`;
    }

    const { data: existingRow, error: selErr } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (selErr) {
      console.warn("saveCoursePdf fetch existing warning:", selErr);
    }

    const { pdfs: currentPdfs, routines: currentRoutines } = parseDetailsPayload(existingRow?.details);

    // If editing existing PDF with the same id
    const existingIndex = currentPdfs.findIndex((p) => p.id === pdfId);
    const newPdf: CoursePdfItem = {
      id: pdfId,
      course: cleanCourse,
      subject: cleanSubject,
      title: cleanTitle,
      driveLink: cleanLink,
      createdAt: existingIndex >= 0 && currentPdfs[existingIndex].createdAt ? currentPdfs[existingIndex].createdAt : new Date().toISOString()
    };

    let updatedPdfs: CoursePdfItem[];
    if (existingIndex >= 0) {
      updatedPdfs = [...currentPdfs];
      updatedPdfs[existingIndex] = newPdf;
    } else {
      updatedPdfs = [newPdf, ...currentPdfs];
    }

    const { error: upsertErr } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: cleanCourse,
          details: JSON.stringify({ type: "course_pdfs", pdfs: updatedPdfs, routines: currentRoutines })
        },
        { onConflict: "course" }
      );

    if (upsertErr) {
      console.error("saveCoursePdf upsert error:", upsertErr);
      return { success: false, message: `সংরক্ষণ ব্যর্থ হয়েছে: ${upsertErr.message}` };
    }

    invalidatePdfRoutineServerCache();
    return { success: true, message: "পিডিএফ সফলভাবে সংরক্ষিত হয়েছে!", pdf: newPdf };
  } catch (err: any) {
    console.error("saveCoursePdf unexpected error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।" };
  }
}

/**
 * কোর্স থেকে নির্দিষ্ট একটি পিডিএফ মুছে ফেলা (শিক্ষক-অনলি)
 */
export async function deleteCoursePdf(
  course: string,
  pdfId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const cleanCourse = String(course || "").trim();
    const cleanId = String(pdfId || "").trim();

    if (!cleanCourse || !cleanId) {
      return { success: false, message: "কোর্স বা পিডিএফ আইডি পাওয়া যায়নি।" };
    }

    const { data: existingRow, error: selErr } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (selErr) {
      return { success: false, message: `ডাটা লোড ত্রুটি: ${selErr.message}` };
    }

    const { pdfs: currentPdfs, routines: currentRoutines } = parseDetailsPayload(existingRow?.details);
    const updatedPdfs = currentPdfs.filter((p) => p.id !== cleanId);

    const { error: upErr } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: cleanCourse,
          details: JSON.stringify({ type: "course_pdfs", pdfs: updatedPdfs, routines: currentRoutines })
        },
        { onConflict: "course" }
      );

    if (upErr) {
      return { success: false, message: `মুছতে ব্যর্থ হয়েছে: ${upErr.message}` };
    }

    invalidatePdfRoutineServerCache();
    return { success: true, message: "পিডিএফ সফলভাবে মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("deleteCoursePdf error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।" };
  }
}

/**
 * পূর্বের সকল পিডিএফ একসাথে মুছে ফেলা (শিক্ষকের অনুরোধ অনুযায়ী নতুন করে শুরুর জন্য)
 */
export async function clearAllExistingPdfs(): Promise<{ success: boolean; message: string; count: number }> {
  try {
    await requireTeacher();
    const { data, error } = await supabase
      .from("course_prices")
      .select("course, details");

    if (error) {
      return { success: false, message: error.message, count: 0 };
    }

    let clearedCount = 0;
    for (const row of (data || [])) {
      const { pdfs, routines } = parseDetailsPayload(row.details);
      if (pdfs.length > 0) {
        clearedCount += pdfs.length;
        await supabase
          .from("course_prices")
          .update({
            details: JSON.stringify({ type: "course_pdfs", pdfs: [], routines })
          })
          .eq("course", row.course);
      }
    }

    return { success: true, message: `পূর্বের সকল পিডিএফ (${clearedCount}টি) মুছে ফেলা হয়েছে।`, count: clearedCount };
  } catch (err: any) {
    console.error("clearAllExistingPdfs error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।", count: 0 };
  }
}

export interface SaveExamPdfInput {
  examId: string;
  course: string;
  subject: string;
  title: string;
  driveLink: string;
}

export interface ExamPdfInputItem {
  id?: string;
  title: string;
  driveLink: string;
}

export interface SaveExamPdfsInput {
  examId: string;
  course: string;
  subject: string;
  pdfs: ExamPdfInputItem[];
}

/**
 * এক্সাম সেটে একাধিক গুগল ড্রাইভ লিংক ও টাইটেল সংরক্ষণ (শিক্ষক-অনলি)
 */
export async function saveExamPdfs(
  payload: SaveExamPdfsInput
): Promise<{ success: boolean; message: string; pdfs: CoursePdfItem[] }> {
  try {
    await requireTeacher();

    const cleanExamId = String(payload.examId || "").trim();
    const cleanCourse = String(payload.course || "").trim();
    const cleanSubject = String(payload.subject || "").trim();
    const rawPdfs = Array.isArray(payload.pdfs) ? payload.pdfs : [];

    if (!cleanExamId) return { success: false, message: "এক্সাম আইডি পাওয়া যায়নি।", pdfs: [] };
    if (!cleanCourse) return { success: false, message: "কোর্সের নাম পাওয়া যায়নি।", pdfs: [] };

    // Validate and clean each PDF
    const validPdfs: CoursePdfItem[] = [];
    for (let i = 0; i < rawPdfs.length; i++) {
      const item = rawPdfs[i];
      const cleanTitle = String(item.title || "").trim();
      let cleanLink = String(item.driveLink || "").trim();

      if (!cleanTitle && !cleanLink) {
        // empty row, ignore
        continue;
      }
      if (!cleanTitle) {
        return { success: false, message: `পিডিএফ #${i + 1}-এর টাইটেল দিন।`, pdfs: [] };
      }
      if (!cleanLink) {
        return { success: false, message: `পিডিএফ #${i + 1}-এর গুগল ড্রাইভ লিংক দিন।`, pdfs: [] };
      }

      if (!cleanLink.startsWith("http://") && !cleanLink.startsWith("https://")) {
        cleanLink = `https://${cleanLink}`;
      }

      validPdfs.push({
        id: item.id && item.id.trim() ? item.id.trim() : `pdf_${cleanExamId}_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        examId: cleanExamId,
        course: cleanCourse,
        subject: cleanSubject,
        title: cleanTitle,
        driveLink: cleanLink,
        createdAt: new Date().toISOString()
      });
    }

    // বিদ্যমান সারি আনা
    const { data: existingRow, error: selErr } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (selErr) {
      console.warn("saveExamPdfs fetch existing warning:", selErr);
    }

    const { pdfs: currentPdfs, routines: currentRoutines } = parseDetailsPayload(existingRow?.details);

    // Remove all old PDFs belonging to this examId
    const otherPdfs = currentPdfs.filter((p) => p.examId !== cleanExamId);

    // Preserving original createdAt for already existing items
    const existingMap = new Map<string, CoursePdfItem>();
    currentPdfs.forEach((p) => {
      if (p.examId === cleanExamId && p.id) {
        existingMap.set(p.id, p);
      }
    });

    const finalExamPdfs = validPdfs.map((vp) => {
      const old = existingMap.get(vp.id);
      if (old?.createdAt) {
        vp.createdAt = old.createdAt;
      }
      return vp;
    });

    const updatedPdfs = [...finalExamPdfs, ...otherPdfs];

    const { error: upsertErr } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: cleanCourse,
          details: JSON.stringify({ type: "course_pdfs", pdfs: updatedPdfs, routines: currentRoutines })
        },
        { onConflict: "course" }
      );

    if (upsertErr) {
      console.error("saveExamPdfs upsert error:", upsertErr);
      return { success: false, message: `সংরক্ষণ ব্যর্থ হয়েছে: ${upsertErr.message}`, pdfs: [] };
    }

    const countText = finalExamPdfs.length === 1 ? "পিডিএফ" : `${finalExamPdfs.length}টি পিডিএফ`;
    return {
      success: true,
      message: `${countText} সফলভাবে সংরক্ষিত হয়েছে!`,
      pdfs: finalExamPdfs
    };
  } catch (err: any) {
    console.error("saveExamPdfs unexpected error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।", pdfs: [] };
  }
}

/**
 * এক্সাম সেটে একক পিডিএফ সংরক্ষণ (backward compatibility)
 */
export async function saveExamPdf(
  payload: SaveExamPdfInput
): Promise<{ success: boolean; message: string; pdf?: CoursePdfItem }> {
  const res = await saveExamPdfs({
    examId: payload.examId,
    course: payload.course,
    subject: payload.subject,
    pdfs: [{ title: payload.title, driveLink: payload.driveLink }]
  });
  return {
    success: res.success,
    message: res.message,
    pdf: res.pdfs?.[0]
  };
}

/**
 * এক্সাম থেকে নির্দিষ্ট একটি পিডিএফ মুছে ফেলা (শিক্ষক-অনলি)
 */
export async function deleteSingleExamPdf(
  course: string,
  pdfId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();

    const cleanCourse = String(course || "").trim();
    const cleanId = String(pdfId || "").trim();

    if (!cleanCourse || !cleanId) {
      return { success: false, message: "কোর্স বা পিডিএফ আইডি পাওয়া যায়নি।" };
    }

    const { data: existingRow, error: selErr } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (selErr) {
      return { success: false, message: `ডাটা লোড ত্রুটি: ${selErr.message}` };
    }

    const { pdfs: currentPdfs, routines: currentRoutines } = parseDetailsPayload(existingRow?.details);
    const updatedPdfs = currentPdfs.filter((p) => p.id !== cleanId);

    const { error: upErr } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: cleanCourse,
          details: JSON.stringify({ type: "course_pdfs", pdfs: updatedPdfs, routines: currentRoutines })
        },
        { onConflict: "course" }
      );

    if (upErr) {
      return { success: false, message: `মুছতে ব্যর্থ হয়েছে: ${upErr.message}` };
    }

    return { success: true, message: "পিডিএফ সফলভাবে মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("deleteSingleExamPdf error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।" };
  }
}

/**
 * এক্সাম থেকে সমস্ত পিডিএফ ড্রাইভ লিংক মুছে ফেলা (শিক্ষক-অনলি)
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

    const { pdfs: currentPdfs, routines: currentRoutines } = parseDetailsPayload(existingRow?.details);
    const updatedPdfs = currentPdfs.filter((p) => p.examId !== cleanExamId);

    const { error: upErr } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: cleanCourse,
          details: JSON.stringify({ type: "course_pdfs", pdfs: updatedPdfs, routines: currentRoutines })
        },
        { onConflict: "course" }
      );

    if (upErr) {
      return { success: false, message: `মুছতে ব্যর্থ হয়েছে: ${upErr.message}` };
    }

    return { success: true, message: "সবগুলো পিডিএফ লিংক মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("deleteExamPdf error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।" };
  }
}

/**
 * কোর্সে রুটিন (Google Drive লিংক) যোগ করা (শিক্ষক-অনলি)
 * সাপ্তাহিক বা নতুন রুটিন যোগ করলে নতুনটি সবার উপরে থাকবে এবং পুরাতনগুলোও সংরক্ষিত থাকবে।
 */
export async function addCourseRoutine(
  course: string,
  title: string,
  driveLink: string
): Promise<{ success: boolean; message: string; routine?: CourseRoutineItem }> {
  try {
    await requireTeacher();
    const cleanCourse = String(course || "").trim();
    const cleanTitle = String(title || "").trim();
    let cleanLink = String(driveLink || "").trim();

    if (!cleanCourse) return { success: false, message: "কোর্সের নাম পাওয়া যায়নি।" };
    if (!cleanTitle) return { success: false, message: "রুটিনের টাইটেল দিন (যেমন: ৩য় সপ্তাহের রুটিন)।" };
    if (!cleanLink) return { success: false, message: "গুগল ড্রাইভ লিংক দিন।" };

    if (!cleanLink.startsWith("http://") && !cleanLink.startsWith("https://")) {
      cleanLink = `https://${cleanLink}`;
    }

    const { data: existingRow, error: selErr } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (selErr) {
      console.warn("addCourseRoutine fetch warning:", selErr);
    }

    const { pdfs: currentPdfs, routines: currentRoutines } = parseDetailsPayload(existingRow?.details);

    const newRoutine: CourseRoutineItem = {
      id: `routine_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      course: cleanCourse,
      title: cleanTitle,
      driveLink: cleanLink,
      createdAt: new Date().toISOString()
    };

    // নতুন রুটিন শীর্ষে (latest first)
    const updatedRoutines = [newRoutine, ...currentRoutines];

    const { error: upsertErr } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: cleanCourse,
          details: JSON.stringify({ type: "course_pdfs", pdfs: currentPdfs, routines: updatedRoutines })
        },
        { onConflict: "course" }
      );

    if (upsertErr) {
      return { success: false, message: `সংরক্ষণ ব্যর্থ হয়েছে: ${upsertErr.message}` };
    }

    invalidatePdfRoutineServerCache();
    return { success: true, message: "রুটিন সফলভাবে যুক্ত হয়েছে!", routine: newRoutine };
  } catch (err: any) {
    console.error("addCourseRoutine error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।" };
  }
}

/**
 * কোর্স থেকে রুটিন মুছে ফেলা (শিক্ষক-অনলি)
 */
export async function deleteCourseRoutine(
  course: string,
  routineId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const cleanCourse = String(course || "").trim();
    const cleanId = String(routineId || "").trim();

    if (!cleanCourse || !cleanId) {
      return { success: false, message: "কোর্স বা রুটিন আইডি পাওয়া যায়নি।" };
    }

    const { data: existingRow, error: selErr } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", cleanCourse)
      .maybeSingle();

    if (selErr) {
      return { success: false, message: `ডাটা লোড ত্রুটি: ${selErr.message}` };
    }

    const { pdfs: currentPdfs, routines: currentRoutines } = parseDetailsPayload(existingRow?.details);
    const updatedRoutines = currentRoutines.filter((r) => r.id !== cleanId);

    const { error: upErr } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: cleanCourse,
          details: JSON.stringify({ type: "course_pdfs", pdfs: currentPdfs, routines: updatedRoutines })
        },
        { onConflict: "course" }
      );

    if (upErr) {
      return { success: false, message: `মুছতে ব্যর্থ হয়েছে: ${upErr.message}` };
    }

    invalidatePdfRoutineServerCache();
    return { success: true, message: "রুটিন মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("deleteCourseRoutine error:", err);
    return { success: false, message: err?.message || "সার্ভার ত্রুটি।" };
  }
}

// In-memory server cache for all PDFs and routines (TTL: 60s)
let serverPdfsAndRoutinesCache: {
  data: { allPdfs: CoursePdfItem[]; allRoutines: CourseRoutineItem[] };
  timestamp: number;
} | null = null;

export async function invalidatePdfRoutineServerCache(): Promise<void> {
  serverPdfsAndRoutinesCache = null;
}

/**
 * সকল কোর্সের সমস্ত পিডিএফ এবং রুটিন একসাথে লোড (ড্যাশবোর্ড লাইব্রেরির জন্য)
 */
export async function getAllPdfsAndRoutines(): Promise<{
  allPdfs: CoursePdfItem[];
  allRoutines: CourseRoutineItem[];
}> {
  const now = Date.now();
  if (serverPdfsAndRoutinesCache && now - serverPdfsAndRoutinesCache.timestamp < 60000) {
    return serverPdfsAndRoutinesCache.data;
  }

  try {
    const { data, error } = await supabase
      .from("course_prices")
      .select("course, details");

    if (error) {
      console.error("getAllPdfsAndRoutines error:", error);
      if (serverPdfsAndRoutinesCache) return serverPdfsAndRoutinesCache.data;
      return { allPdfs: [], allRoutines: [] };
    }

    const allPdfs: CoursePdfItem[] = [];
    const allRoutines: CourseRoutineItem[] = [];

    (data || []).forEach((row) => {
      if (row.course === "__AMBASSADORS_DATA__") return;
      const { pdfs, routines } = parseDetailsPayload(row.details);
      pdfs.forEach((p) => {
        if (!p.course && row.course) p.course = row.course;
        allPdfs.push(p);
      });
      routines.forEach((r) => {
        if (!r.course && row.course) r.course = row.course;
        allRoutines.push(r);
      });
    });

    // Sort latest first
    allPdfs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    allRoutines.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const result = { allPdfs, allRoutines };
    serverPdfsAndRoutinesCache = {
      data: result,
      timestamp: now,
    };

    return result;
  } catch (err) {
    console.error("getAllPdfsAndRoutines unexpected error:", err);
    if (serverPdfsAndRoutinesCache) return serverPdfsAndRoutinesCache.data;
    return { allPdfs: [], allRoutines: [] };
  }
}

