"use server";

import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { requireTeacher, requireMasterAdmin, isMasterAdminEmail, PERMANENT_MASTER_ADMINS } from "@/lib/teacher-auth";

const ADMIN_STORAGE_KEY = "__ADMIN_ACCESS_LIST__";

export interface DynamicAdminUser {
  email: string;
  addedBy: string;
  addedAt: string;
  role: "admin" | "teacher";
}

function getMasterAdmins(): string[] {
  const envAdmins = (process.env.TEACHER_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...PERMANENT_MASTER_ADMINS.map((e) => e.toLowerCase()), ...envAdmins]));
}

function getAdminAuthClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) return null;
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function readDynamicAdminsFromDb(): Promise<DynamicAdminUser[]> {
  try {
    const { data, error } = await supabase
      .from("course_prices")
      .select("details")
      .eq("course", ADMIN_STORAGE_KEY)
      .maybeSingle();

    if (error || !data?.details) return [];
    const parsed = typeof data.details === "string" ? JSON.parse(data.details) : data.details;
    if (parsed && Array.isArray(parsed.admins)) {
      return parsed.admins;
    }
    return [];
  } catch (err) {
    console.error("readDynamicAdminsFromDb error:", err);
    return [];
  }
}

export async function writeDynamicAdminsToDb(admins: DynamicAdminUser[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("course_prices")
      .upsert(
        {
          course: ADMIN_STORAGE_KEY,
          details: JSON.stringify({
            type: "admin_access_list",
            admins
          })
        },
        { onConflict: "course" }
      );
    if (error) {
      console.error("writeDynamicAdminsToDb error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("writeDynamicAdminsToDb exception:", err);
    return false;
  }
}

export async function getAdminAccessList(): Promise<{
  envAdmins: string[];
  dynamicAdmins: DynamicAdminUser[];
  isMasterAdmin: boolean;
  currentEmail: string;
}> {
  const currentTeacher = await requireTeacher();

  const envAdmins = getMasterAdmins();
  const dynamicAdmins = await readDynamicAdminsFromDb();

  return {
    envAdmins,
    dynamicAdmins,
    isMasterAdmin: isMasterAdminEmail(currentTeacher.email),
    currentEmail: currentTeacher.email || ""
  };
}

export async function grantAdminAccess(email: string): Promise<{ success: boolean; message: string }> {
  let currentTeacher: { id: string; email?: string };
  try {
    currentTeacher = await requireMasterAdmin();
  } catch (err: any) {
    return { success: false, message: err?.message || "অননুমোদিত: শুধুমাত্র মূল (Master) অ্যাডমিন নতুন অ্যাডমিন নিয়োগ করতে পারেন।" };
  }
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return { success: false, message: "একটি বৈধ ইমেইল ঠিকানা দিন।" };
  }

  const masterAdmins = getMasterAdmins();

  if (masterAdmins.includes(cleanEmail)) {
    return { success: false, message: "এই ইমেইলটি ইতিমধ্যে সিস্টেমের মূল (Master) অ্যাডমিন হিসেবে যুক্ত আছে।" };
  }

  const currentList = await readDynamicAdminsFromDb();
  const existing = currentList.find((a) => a.email.toLowerCase() === cleanEmail);

  if (existing) {
    return { success: false, message: "এই ইমেইলটি ইতিমধ্যে অ্যাডমিন তালিকায় যুক্ত আছে।" };
  }

  // 1. Supabase Auth-এ ইউজার থাকলে সরাসরি app_metadata.role = "admin" করে দেওয়া
  const adminClient = getAdminAuthClient();
  let userFoundInAuth = false;
  if (adminClient) {
    try {
      const { data: userData } = await adminClient.auth.admin.listUsers();
      const targetUser = userData?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );
      if (targetUser) {
        userFoundInAuth = true;
        await adminClient.auth.admin.updateUserById(targetUser.id, {
          app_metadata: { ...targetUser.app_metadata, role: "admin" }
        });
      }
    } catch (authErr) {
      console.warn("Supabase Auth sync warning (will still store in DB):", authErr);
    }
  }

  // 2. ডেটাবেজে সংরক্ষণ করা
  const newAdmin: DynamicAdminUser = {
    email: cleanEmail,
    addedBy: currentTeacher.email || "অ্যাডমিন",
    addedAt: new Date().toISOString(),
    role: "admin"
  };

  const saved = await writeDynamicAdminsToDb([newAdmin, ...currentList]);
  if (!saved) {
    return { success: false, message: "ডেটাবেজে অ্যাডমিন সংরক্ষণ করতে সমস্যা হয়েছে।" };
  }

  return {
    success: true,
    message: userFoundInAuth
      ? `সফলভাবে "${cleanEmail}"-কে অ্যাডমিন এক্সেস দেওয়া হয়েছে। তিনি এখন লগইন করতে পারবেন ✓`
      : `সফলভাবে "${cleanEmail}"-কে অ্যাডমিন এক্সেস তালিকায় যুক্ত করা হয়েছে। তিনি যখন সাইন ইন করবেন, সাথে সাথে অ্যাডমিন হয়ে যাবেন ✓`
  };
}

export async function revokeAdminAccess(email: string): Promise<{ success: boolean; message: string }> {
  try {
    await requireMasterAdmin();
  } catch (err: any) {
    return { success: false, message: err?.message || "অননুমোদিত: শুধুমাত্র মূল (Master) অ্যাডমিন অ্যাডমিন এক্সেস বাতিল করতে পারেন।" };
  }
  const cleanEmail = String(email || "").trim().toLowerCase();

  const masterAdmins = getMasterAdmins();

  if (masterAdmins.includes(cleanEmail)) {
    return { success: false, message: "সিস্টেমের মূল (Master) অ্যাডমিন এক্সেস বাতিল করা যাবে না।" };
  }

  const currentList = await readDynamicAdminsFromDb();
  const filtered = currentList.filter((a) => a.email.toLowerCase() !== cleanEmail);

  // 1. Supabase Auth-এ রোল রিমুভ করা
  const adminClient = getAdminAuthClient();
  if (adminClient) {
    try {
      const { data: userData } = await adminClient.auth.admin.listUsers();
      const targetUser = userData?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );
      if (targetUser) {
        await adminClient.auth.admin.updateUserById(targetUser.id, {
          app_metadata: { ...targetUser.app_metadata, role: null }
        });
      }
    } catch (authErr) {
      console.warn("Supabase Auth revoke warning:", authErr);
    }
  }

  // 2. ডেটাবেজ থেকে রিমুভ করা
  const saved = await writeDynamicAdminsToDb(filtered);
  if (!saved) {
    return { success: false, message: "এক্সেস বাতিল করতে সমস্যা হয়েছে।" };
  }

  return {
    success: true,
    message: `"${cleanEmail}"-এর অ্যাডমিন এক্সেস বাতিল করা হয়েছে ✓`
  };
}
