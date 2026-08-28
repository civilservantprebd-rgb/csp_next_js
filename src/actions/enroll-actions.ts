"use server";

import { supabase } from "@/lib/supabase";
import { EnrollmentRequest } from "@/types/student";
import { getTrueDate } from "@/lib/bangladesh-time";

export async function submitEnrollRequest(payload: {
  uid: string;
  email: string;
  name: string;
  course: string;
  trxId: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!payload.uid || !payload.name || !payload.trxId) {
      return { success: false, message: "দয়া করে সকল তথ্য সঠিকভাবে পূরণ করুন।" };
    }

    const { error } = await supabase.from("enroll_requests").insert({
      student_uid: payload.uid,
      email: payload.email,
      name: payload.name.trim(),
      course: payload.course,
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

export async function approveEnrollRequest(
  docId: string,
  uid: string,
  name: string,
  course: string,
  email?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = uid.trim();

    let existingCourses: string[] = [];
    const { data: exData } = await supabase
      .from("allowed_students")
      .select("courses")
      .eq("id", cleanId)
      .maybeSingle();

    if (exData) {
      existingCourses = exData.courses || [];
    }

    const mergedCourses = Array.from(new Set([...existingCourses, course]));

    const { error: upsertError } = await supabase.from("allowed_students").upsert({
      id: cleanId,
      name: name,
      email: email || "",
      courses: mergedCourses,
      approved_at: getTrueDate().toISOString()
    });

    if (upsertError) throw upsertError;

    if (docId) {
      const { error: deleteError } = await supabase
        .from("enroll_requests")
        .delete()
        .eq("id", docId);
      if (deleteError) throw deleteError;
    }

    return { success: true, message: `${name} (${email || cleanId})-কে "${course}" কোর্সে অনুমোদন দেওয়া হয়েছে।` };
  } catch (err) {
    console.error("Approve enroll request error:", err);
    return { success: false, message: "অনুমোদনে সমস্যা হয়েছে।" };
  }
}
