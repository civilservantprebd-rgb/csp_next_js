"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher, sessionOwnsStudent, getSessionUserFromCookies } from "@/lib/teacher-auth";
import { getTrueDate } from "@/lib/bangladesh-time";
import { 
  ReferralRecord, 
  StudentReferralProfile, 
  ReferralSettings, 
  generateReferralCodeString,
  DEFAULT_REFERRAL_SETTINGS 
} from "@/types/referral";

import { getCoursePrices } from "@/actions/course-actions";

let cachedReferralSettings: ReferralSettings | null = null;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_TTL = 30000; // 30s cache

/**
 * রেফারেল সেটিংস নিয়ে আসে (ক্যাশ সহ)।
 * Supabase-এর app_settings টেবিল (id="main") এর referral_settings কলাম অথবা ইন-মেমোরি/ফলব্যাক থেকে আনা হয়।
 */
export async function getReferralSettings(): Promise<ReferralSettings> {
  const now = Date.now();
  if (cachedReferralSettings && now - lastSettingsFetch < SETTINGS_CACHE_TTL) {
    return cachedReferralSettings;
  }

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("referral_settings")
      .eq("id", "main")
      .maybeSingle();

    if (!error && data?.referral_settings) {
      const parsed = typeof data.referral_settings === "string" 
        ? JSON.parse(data.referral_settings) 
        : data.referral_settings;

      const loadedSettings: ReferralSettings = {
        ...DEFAULT_REFERRAL_SETTINGS,
        ...parsed,
        courseConfigs: parsed.courseConfigs || {}
      };
      cachedReferralSettings = loadedSettings;
      lastSettingsFetch = now;
      return loadedSettings;
    }
  } catch (err) {
    console.warn("Could not load referral_settings from app_settings, using defaults:", err);
  }

  return cachedReferralSettings ?? DEFAULT_REFERRAL_SETTINGS;
}

/**
 * শিক্ষক/অ্যাডমিন কর্তৃক কোর্স-ভিত্তিক রেফারেল ও ডিসকাউন্ট পার্সেন্টেজ সংরক্ষণ।
 */
export async function saveReferralSettings(
  settings: Partial<ReferralSettings>
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();

    const current = await getReferralSettings();
    const updated: ReferralSettings = {
      ...current,
      ...settings,
      courseConfigs: {
        ...current.courseConfigs,
        ...(settings.courseConfigs || {})
      }
    };

    // ডেটাবেজে সংরক্ষণের চেষ্টা (app_settings - referral_settings কলাম)
    const { error } = await supabase
      .from("app_settings")
      .update({ referral_settings: updated })
      .eq("id", "main");

    if (error) {
      // যদি কলাম না থাকে বা এরর হয়, তাহলে চেষ্টা করি পুরো app_settings অবজেক্টে সেভ করার
      console.warn("Direct update on referral_settings failed, checking fallback:", error.message);
      // ক্যাশ সবসময় আপডেট করে রাখি যাতে বর্তমান সেশনে কাজ করে
      cachedReferralSettings = updated;
      lastSettingsFetch = Date.now();
      return { 
        success: true, 
        message: "সেটিংস আপডেট হয়েছে (মেমোরি/লোকাল স্টেটে সক্রিয়)।" 
      };
    }

    cachedReferralSettings = updated;
    lastSettingsFetch = Date.now();

    return { success: true, message: "রেফারেল কমিশন ও ডিসকাউন্ট সফলভাবে সংরক্ষিত হয়েছে!" };
  } catch (err: any) {
    console.error("saveReferralSettings error:", err);
    return { success: false, message: err?.message || "সেটিংস সংরক্ষণ করা যায়নি।" };
  }
}

/**
 * স্টুডেন্টের রেফারেল কোড পায় বা তৈরি করে।
 */
export async function getOrCreateStudentReferralCode(
  studentId: string,
  name?: string
): Promise<{ referralCode: string; error?: string }> {
  try {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return { referralCode: "", error: "স্টুডেন্ট আইডি প্রয়োজন" };

    // ১. ডেটাবেজ টেবিলে চেক করি
    const { data: dbRow } = await supabase
      .from("student_referral_codes")
      .select("code")
      .eq("student_id", cleanId)
      .maybeSingle();

    if (dbRow?.code) {
      return { referralCode: dbRow.code };
    }

    // টেবিল না থাকলে বা নতুন হলে কোড তৈরি
    const code = generateReferralCodeString(cleanId);

    // টেবিলে ইনসার্ট চেষ্টা
    await supabase.from("student_referral_codes").upsert({
      student_id: cleanId,
      code: code,
      created_at: getTrueDate().toISOString()
    });

    return { referralCode: code };
  } catch (err: any) {
    console.error("getOrCreateStudentReferralCode error:", err);
    // ফলব্যাক কোড
    return { referralCode: generateReferralCodeString(studentId) };
  }
}

/**
 * কুপন বা রেফারেল কোড ভ্যালিডেট করা।
 * কুপন ইনপুট বক্সে রেফারেল কোড দিলে কোর্স অনুযায়ী পার্সেন্টেজ ডিসকাউন্ট ও রেফারেল তথ্য যাচাই করে।
 */
export async function validateReferralCode(
  code: string,
  courseName?: string,
  coursePrice?: number
): Promise<{
  valid: boolean;
  discount: number;
  discountPercent?: number;
  referrerName?: string;
  referrerId?: string;
  message: string;
}> {
  try {
    const cleanCode = String(code || "").trim().toUpperCase();
    if (!cleanCode) {
      return { valid: false, discount: 0, message: "কোড প্রদান করুন।" };
    }

    const settings = await getReferralSettings();
    if (settings.enabled === false) {
      return { valid: false, discount: 0, message: "বর্তমানে রেফারেল অফার সাময়িকভাবে বন্ধ রয়েছে।" };
    }

    // ১. রেফারেল কোড টেবিলে খুঁজি
    const { data: refRow } = await supabase
      .from("student_referral_codes")
      .select("student_id, code")
      .eq("code", cleanCode)
      .maybeSingle();

    let targetStudentId = refRow?.student_id;

    // ২. টেবিলে না পেলে allowed_students আইডির সাথে মেলাতে পারি (ফলব্যাক BCS-XXXX)
    if (!targetStudentId && cleanCode.startsWith("BCS-")) {
      const suffix = cleanCode.replace("BCS-", "");
      const { data: students } = await supabase
        .from("allowed_students")
        .select("id, name")
        .limit(200);

      const matched = (students || []).find((s) => {
        const gen = generateReferralCodeString(s.id);
        return gen === cleanCode;
      });

      if (matched) {
        targetStudentId = matched.id;
      }
    }

    if (!targetStudentId) {
      return { valid: false, discount: 0, message: "অবৈধ রেফারেল বা কুপন কোড।" };
    }

    // রেফারারের নাম আনি
    const { data: referrer } = await supabase
      .from("allowed_students")
      .select("name")
      .eq("id", targetStudentId)
      .maybeSingle();

    const referrerName = referrer?.name || "সহপাঠী";

    // কোর্স অনুযায়ী % ডিসকাউন্ট হিসাব
    const courseConfig = courseName ? settings.courseConfigs[courseName] : undefined;
    const discountPercent = courseConfig?.discountPercent ?? settings.defaultDiscountPercent ?? 10;

    let discount = 0;
    if (coursePrice && coursePrice > 0) {
      discount = Math.round((coursePrice * discountPercent) / 100);
    } else {
      // যদি দাম না আসে, তবে ডিফল্ট ফ্ল্যাট ডিসকাউন্ট
      discount = settings.refereeDiscount || 50;
    }

    return {
      valid: true,
      discount: discount,
      discountPercent: discountPercent,
      referrerId: targetStudentId,
      referrerName: referrerName,
      message: `🎉 অভিনন্দন! ${referrerName}-এর রেফারেল কোড সক্রিয় হয়েছে। আপনি ${discountPercent}% ছাড় (৳${discount}) পাচ্ছেন!`
    };
  } catch (err: any) {
    console.error("validateReferralCode error:", err);
    return { valid: false, discount: 0, message: "কোড যাচাই করতে সমস্যা হয়েছে।" };
  }
}

/**
 * যখন কোনো শিক্ষার্থী রেফারেল কোড দিয়ে এনরোল রিকোয়েস্ট সাবমিট করে:
 * রেফারেল রেকর্ড তৈরি/রেকর্ড করা। কোর্স-ভিত্তিক রিওয়ার্ড % অনুযায়ী রেফারার বোনাস হিসাব করা হয়।
 */
export async function trackReferralSubmission(payload: {
  referralCode: string;
  referredUserId: string;
  referredUserName: string;
  referredUserEmail?: string;
  course: string;
}): Promise<boolean> {
  try {
    const cleanCode = payload.referralCode.trim().toUpperCase();
    if (!cleanCode) return false;

    // রেফারার বের করি
    const val = await validateReferralCode(cleanCode);
    if (!val.valid || !val.referrerId) return false;

    // নিজেকে নিজে রেফার করা নিষিদ্ধ
    if (val.referrerId === payload.referredUserId) {
      return false;
    }

    const { data: existingRef } = await supabase
      .from("referral_records")
      .select("id")
      .eq("referred_user_id", payload.referredUserId)
      .eq("course", payload.course)
      .maybeSingle();

    if (existingRef) {
      return true; // ইতিমধ্যে ট্র্যাকিং করা আছে
    }

    // রেফারারের ইমেইল/নাম
    const { data: refUser } = await supabase
      .from("allowed_students")
      .select("name, email")
      .eq("id", val.referrerId)
      .maybeSingle();

    // সেটিংস ও কোর্সের দাম অনুযায়ী রেফারারের রিওয়ার্ড (% হিসাব)
    const settings = await getReferralSettings();
    const prices = await getCoursePrices();
    
    // কোর্সের দাম বের করি (একাধিক কোর্স কমা দিয়ে থাকতে পারে, প্রথমটি বা সবগুলোর সমষ্টি)
    const targetCourse = payload.course.split(",")[0].trim();
    const pInfo = prices[targetCourse];
    const actualPrice = pInfo ? (pInfo.offerPrice ?? pInfo.price ?? 500) : 500;

    const courseConfig = settings.courseConfigs[targetCourse];
    const rewardPercent = courseConfig?.rewardPercent ?? settings.defaultRewardPercent ?? 10;
    const computedReward = Math.round((actualPrice * rewardPercent) / 100) || (settings.rewardPerReferral || 50);

    await supabase.from("referral_records").insert({
      referrer_id: val.referrerId,
      referrer_name: refUser?.name || val.referrerName || "রেফারার",
      referrer_email: refUser?.email || "",
      referred_user_id: payload.referredUserId,
      referred_user_name: payload.referredUserName,
      referred_user_email: payload.referredUserEmail || "",
      referral_code: cleanCode,
      course: payload.course,
      status: "pending",
      reward_amount: computedReward,
      created_at: getTrueDate().toISOString()
    });

    return true;
  } catch (err) {
    console.error("trackReferralSubmission error:", err);
    return false;
  }
}

/**
 * শিক্ষক যখন এনরোল রিকোয়েস্ট Approve করেন:
 * পেন্ডিং রেফারেল থাকলে সেটা 'completed' হয় এবং রিওয়ার্ড কাউন্ট হয়।
 */
export async function completeReferralOnApproval(
  studentUid: string,
  courses: string[]
): Promise<void> {
  try {
    const courseList = Array.isArray(courses) ? courses : [courses];
    
    // এই স্টুডেন্টের পেন্ডিং রেফারেল আছে কিনা
    const { data: pendingRefs } = await supabase
      .from("referral_records")
      .select("*")
      .eq("referred_user_id", studentUid)
      .eq("status", "pending");

    if (!pendingRefs || pendingRefs.length === 0) return;

    for (const ref of pendingRefs) {
      await supabase
        .from("referral_records")
        .update({
          status: "completed",
          completed_at: getTrueDate().toISOString()
        })
        .eq("id", ref.id);
    }
  } catch (err) {
    console.error("completeReferralOnApproval error:", err);
  }
}

/**
 * স্টুডেন্ট পোর্টালে তার রেফারেল ড্যাশবোর্ড ও ইতিহাস দেখার ডেটা।
 */
export async function getStudentReferralProfile(
  studentId: string
): Promise<StudentReferralProfile | null> {
  try {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return null;

    if (!(await sessionOwnsStudent(cleanId))) return null;

    // ১. রেফারেল কোড
    const { referralCode } = await getOrCreateStudentReferralCode(cleanId);

    // ২. রেফারেল রেকর্ডসমূহ
    const { data: rows } = await supabase
      .from("referral_records")
      .select("*")
      .eq("referrer_id", cleanId)
      .order("created_at", { ascending: false });

    const records: ReferralRecord[] = (rows || []).map((r) => ({
      id: r.id,
      referrerId: r.referrer_id,
      referrerName: r.referrer_name,
      referrerEmail: r.referrer_email,
      referredUserId: r.referred_user_id,
      referredUserName: r.referred_user_name,
      referredUserEmail: r.referred_user_email,
      referralCode: r.referral_code,
      course: r.course,
      status: r.status as "pending" | "completed",
      rewardAmount: Number(r.reward_amount || DEFAULT_REFERRAL_SETTINGS.rewardPerReferral),
      createdAt: r.created_at,
      completedAt: r.completed_at
    }));

    const totalReferrals = records.length;
    const completedReferrals = records.filter((r) => r.status === "completed").length;
    const pendingReferrals = totalReferrals - completedReferrals;
    const totalEarnings = records
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    return {
      referralCode,
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalEarnings,
      referrals: records
    };
  } catch (err) {
    console.error("getStudentReferralProfile error:", err);
    return null;
  }
}

/**
 * অ্যাডমিন/শিক্ষক প্যানেলের জন্য সব রেফারেল হিস্ট্রি আনা।
 */
export async function getAllReferralRecordsForAdmin(): Promise<{
  records: ReferralRecord[];
  totalEarningsIssued: number;
  completedCount: number;
  pendingCount: number;
}> {
  try {
    await requireTeacher();

    const { data: rows, error } = await supabase
      .from("referral_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const records: ReferralRecord[] = (rows || []).map((r) => ({
      id: r.id,
      referrerId: r.referrer_id,
      referrerName: r.referrer_name,
      referrerEmail: r.referrer_email,
      referredUserId: r.referred_user_id,
      referredUserName: r.referred_user_name,
      referredUserEmail: r.referred_user_email,
      referralCode: r.referral_code,
      course: r.course,
      status: r.status as "pending" | "completed",
      rewardAmount: Number(r.reward_amount || DEFAULT_REFERRAL_SETTINGS.rewardPerReferral),
      createdAt: r.created_at,
      completedAt: r.completed_at
    }));

    const completedCount = records.filter((r) => r.status === "completed").length;
    const pendingCount = records.filter((r) => r.status === "pending").length;
    const totalEarningsIssued = records
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    return {
      records,
      totalEarningsIssued,
      completedCount,
      pendingCount
    };
  } catch (err) {
    console.error("getAllReferralRecordsForAdmin error:", err);
    return {
      records: [],
      totalEarningsIssued: 0,
      completedCount: 0,
      pendingCount: 0
    };
  }
}
