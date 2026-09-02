"use server";

import { supabase } from "@/lib/supabase";
import { EnrollmentRequest } from "@/types/student";
import { getTrueDate } from "@/lib/bangladesh-time";
import { requireTeacher } from "@/lib/teacher-auth";

export async function submitEnrollRequest(payload: {
  uid: string;
  email: string;
  name: string;
  course: string | string[];
  trxId: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!payload.uid || !payload.name || !payload.trxId) {
      return { success: false, message: "দয়া করে সকল তথ্য সঠিকভাবে পূরণ করুন।" };
    }

    const courseStr = Array.isArray(payload.course) ? payload.course.join(", ") : payload.course;

    if (!courseStr.trim()) {
      return { success: false, message: "দয়া করে অন্তত একটি কোর্স নির্বাচন করুন।" };
    }

    // Validate email format when provided
    const cleanEmail = String(payload.email || "").trim();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, message: "ইমেইল ঠিকানা সঠিক নয়।" };
    }

    // Basic rate-limit/dedupe: block duplicate requests from the same uid+course
    // within the last hour (spam protection).
    const oneHourAgo = new Date(getTrueDate().getTime() - 60 * 60 * 1000).toISOString();
    const { data: recentReq } = await supabase
      .from("enroll_requests")
      .select("id")
      .eq("student_uid", String(payload.uid).trim())
      .eq("course", courseStr)
      .gte("created_at", oneHourAgo)
      .maybeSingle();
    if (recentReq) {
      return { success: false, message: "আপনি ইতিমধ্যে একটি এনরোলমেন্ট রিকোয়েস্ট জমা দিয়েছেন। শিক্ষকের অনুমোদনের অপেক্ষায় থাকুন।" };
    }

    const { error } = await supabase.from("enroll_requests").insert({
      student_uid: payload.uid,
      email: payload.email,
      name: payload.name.trim(),
      course: courseStr,
      trx_id: payload.trxId.trim().toUpperCase(),
      created_at: getTrueDate().toISOString()
    });

    if (error) throw error;

    return {
      success: true,
      message: "আপনার এনরোলমেন্ট রিকোয়েস্ট জমা হয়েছে! শিক্ষক প্যানেল থেকে অনুমোদন দিলে পরীক্ষা দিতে পারবেন।"
    };
  } catch (err) {
    console.error("Submit enroll request error:", err);
    return { success: false, message: "রিকোয়েস্ট জমা দিতে সমস্যা হয়েছে।" };
  }
}

export async function getEnrollRequests(): Promise<EnrollmentRequest[]> {
  try {
    // SECURITY: enrollment requests contain names, emails and payment trx ids — teachers only
    await requireTeacher();

    const { data, error } = await supabase
      .from("enroll_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((r) => ({
      docId: r.id,
      id: r.student_uid,
      email: r.email,
      name: r.name,
      course: r.course,
      trxId: r.trx_id,
      timestamp: r.created_at
    }));
  } catch (err) {
    console.error("Fetch enroll requests error:", err);
    return [];
  }
}

export async function declineEnrollRequest(
  docId: string,
  uid: string,
  name: string
): Promise<{ success: boolean; message: string }> {
  try {
    // SECURITY: declining removes a pending enrollment request — teachers only
    await requireTeacher();

    if (!docId || !String(uid || "").trim()) {
      return { success: false, message: "রিকোয়েস্ট তথ্য সঠিক নয়।" };
    }

    const cleanId = String(uid).trim();

    // Only delete the request that belongs to this student (no cross-uid deletes)
    const { error } = await supabase
      .from("enroll_requests")
      .delete()
      .eq("id", docId)
      .eq("student_uid", cleanId);

    if (error) throw error;

    return {
      success: true,
      message: `${name}-এর এনরোলমেন্ট রিকোয়েস্টটি বাতিল (decline) করা হয়েছে।`
    };
  } catch (err) {
    console.error("Decline enroll request error:", err);
    return { success: false, message: "রিকোয়েস্ট বাতিল করতে সমস্যা হয়েছে।" };
  }
}

export async function approveEnrollRequest(
  docId: string,
  uid: string,
  name: string,
  course: string | string[],
  email?: string
): Promise<{ success: boolean; message: string }> {
  try {
    // SECURITY: approving enrollment grants paid-course access — teachers only
    await requireTeacher();

    const cleanId = uid.trim();

    let existingCourses: string[] = [];
    let existingEmail = "";
    const { data: exData, error: exError } = await supabase
      .from("allowed_students")
      .select("courses, email")
      .eq("id", cleanId)
      .maybeSingle();
    if (exError) throw exError;

    if (exData) {
      existingCourses = Array.isArray(exData.courses) ? exData.courses : [];
      existingEmail = String(exData.email || "").trim();
    }

    const rawCourses = Array.isArray(course) ? course : [course];
    const newCourses = Array.from(new Set(rawCourses.map((c) => String(c || "").trim()).filter(Boolean)));
    if (newCourses.length === 0 || newCourses.length > 10) {
      return { success: false, message: "কোর্স তালিকা সঠিক নয়।" };
    }
    const mergedCourses = Array.from(new Set([...existingCourses, ...newCourses])).filter(Boolean);

    const resolvedEmail = email && String(email).trim() ? String(email).trim() : existingEmail;

    const { error: upsertError } = await supabase.from("allowed_students").upsert({
      id: cleanId,
      name: name,
      email: resolvedEmail,
      courses: mergedCourses,
      approved_at: getTrueDate().toISOString()
    });

    if (upsertError) throw upsertError;

    if (docId) {
      // Only delete the request that belongs to this student (no cross-uid deletes)
      const { error: deleteError } = await supabase
        .from("enroll_requests")
        .delete()
        .eq("id", docId)
        .eq("student_uid", cleanId);
      if (deleteError) throw deleteError;
    }

    const courseSummary = newCourses.join(", ");
    return { success: true, message: `${name} (${email || cleanId})-কে "${courseSummary}" কোর্সে অনুমোদন দেওয়া হয়েছে।` };
  } catch (err) {
    console.error("Approve enroll request error:", err);
    return { success: false, message: "অনুমোদনে সমস্যা হয়েছে।" };
  }
}
