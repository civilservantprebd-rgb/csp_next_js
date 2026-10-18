"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher, sessionOwnsStudent, getSessionUserFromCookies } from "@/lib/teacher-auth";
import { getTrueDate } from "@/lib/bangladesh-time";
import { 
  ReferralRecord, 
  StudentReferralProfile, 
  ReferralSettings, 
  CourseReferralConfig,
  generateReferralCodeString,
  DEFAULT_REFERRAL_SETTINGS 
} from "@/types/referral";

import { getCoursePrices } from "@/actions/course-actions";
import { parseBengaliDigits } from "@/lib/utils";

interface ReferralMetaStore {
  bkash_numbers: Record<string, string>;
  payouts: Record<string, { status: "paid" | "unpaid"; paid_at?: string; note?: string }>;
  settings?: ReferralSettings;
}

export async function getReferralMeta(): Promise<ReferralMetaStore> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("archived_questions")
      .eq("id", "referral_meta")
      .maybeSingle();
    const raw = data?.archived_questions;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return {
        bkash_numbers: (raw as any).bkash_numbers || {},
        payouts: (raw as any).payouts || {},
        settings: (raw as any).settings || undefined
      };
    }
  } catch (err) {
    console.error("getReferralMeta error:", err);
  }
  return { bkash_numbers: {}, payouts: {} };
}

export async function saveReferralMeta(meta: ReferralMetaStore): Promise<void> {
  try {
    await supabase.from("app_settings").upsert({
      id: "referral_meta",
      teacher_pass: "referral_metadata_store",
      archived_questions: meta,
      updated_at: getTrueDate().toISOString()
    });
  } catch (err) {
    console.error("saveReferralMeta error:", err);
  }
}

let cachedReferralSettings: ReferralSettings | null = null;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_TTL = 30000; // 30s cache

/**
 * রেফারেল সেটিংস নিয়ে আসে (ক্যাশ ও ডেটাবেজ পারসিস্টেন্স সহ)।
 */
export async function getReferralSettings(): Promise<ReferralSettings> {
  const now = Date.now();
  if (cachedReferralSettings && now - lastSettingsFetch < SETTINGS_CACHE_TTL) {
    return cachedReferralSettings;
  }

  try {
    // ১. প্রথমে সুরক্ষিত referral_meta স্টোর চেক করি (১০০% পারসিস্টেন্ট)
    const meta = await getReferralMeta();
    if (meta.settings && typeof meta.settings === "object") {
      const merged: ReferralSettings = {
        ...DEFAULT_REFERRAL_SETTINGS,
        ...meta.settings,
        courseConfigs: meta.settings.courseConfigs || {}
      };
      cachedReferralSettings = merged;
      lastSettingsFetch = now;
      return merged;
    }

    // ২. বিকল্প হিসেবে app_settings কলাম চেক
    const { data } = await supabase
      .from("app_settings")
      .select("referral_settings")
      .eq("id", "main")
      .maybeSingle();

    if (data?.referral_settings) {
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

    // ১. referral_meta-এ সংরক্ষণ (যা ১০০% নিশ্চিতভাবে ডেটাবেজে পারসিস্ট করে)
    const meta = await getReferralMeta();
    meta.settings = updated;
    await saveReferralMeta(meta);

    // ২. কলাম থাকলে সরাসরি কলামেও আপডেট
    try {
      await supabase
        .from("app_settings")
        .update({ referral_settings: updated })
        .eq("id", "main");
    } catch {
      // ignore
    }

    cachedReferralSettings = updated;
    lastSettingsFetch = Date.now();

    return { success: true, message: "রেফারেল কমিশন ও ডিসকাউন্ট পার্সেন্টেজ সফলভাবে সংরক্ষিত হয়েছে!" };
  } catch (err: any) {
    console.error("saveReferralSettings error:", err);
    return { success: false, message: err?.message || "সেটিংস সংরক্ষণ করা যায়নি।" };
  }
}

/**
 * কোনো নির্দিষ্ট কোর্সের কনফিগারেশন বের করার হেল্পার
 */
function getCourseReferralConfig(
  settings: ReferralSettings,
  courseName: string
): CourseReferralConfig {
  const defReward = settings.defaultRewardPercent ?? 10;
  const defDiscount = settings.defaultDiscountPercent ?? 10;
  if (!courseName) {
    return { rewardPercent: defReward, discountPercent: defDiscount };
  }

  const direct = settings.courseConfigs?.[courseName];
  if (direct && typeof direct.rewardPercent === "number") {
    return direct;
  }

  const norm = courseName.trim().toLowerCase();
  for (const [k, v] of Object.entries(settings.courseConfigs || {})) {
    if (k.trim().toLowerCase() === norm && typeof v?.rewardPercent === "number") {
      return v;
    }
  }

  return { rewardPercent: defReward, discountPercent: defDiscount };
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

    // কোর্স অনুযায়ী প্রকৃত % ডিসকাউন্ট হিসাব
    const prices = await getCoursePrices();
    const coursesList = courseName 
      ? courseName.split(",").map((c) => c.trim()).filter(Boolean) 
      : [];

    let discount = 0;
    let discountPercent = settings.defaultDiscountPercent ?? 10;

    if (coursesList.length > 0) {
      let sumDiscount = 0;
      let sumPrice = 0;
      for (const c of coursesList) {
        const cConfig = getCourseReferralConfig(settings, c);
        const pInfo = prices[c];
        const p = pInfo ? (pInfo.offerPrice ?? pInfo.price ?? 500) : 500;
        sumPrice += p;
        sumDiscount += Math.round((p * cConfig.discountPercent) / 100);
      }
      discount = sumDiscount;
      discountPercent = sumPrice > 0 ? Math.round((sumDiscount / sumPrice) * 100) : discountPercent;
    } else if (coursePrice && coursePrice > 0) {
      const cConfig = getCourseReferralConfig(settings, "");
      discount = Math.round((coursePrice * cConfig.discountPercent) / 100);
      discountPercent = cConfig.discountPercent;
    } else {
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
 * শিক্ষার্থীর বিকাশ নাম্বার সংরক্ষণ বা আপডেট করা (রিওয়ার্ড পাওয়ার জন্য)।
 */
export async function saveStudentBkashNumber(
  studentId: string,
  bkashNumber: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return { success: false, message: "স্টুডেন্ট আইডি প্রয়োজন।" };

    if (!(await sessionOwnsStudent(cleanId))) {
      return { success: false, message: "অননুমোদিত অনুরোধ।" };
    }

    const cleanNum = parseBengaliDigits(String(bkashNumber || "")).trim().replace(/[^0-9]/g, "");
    if (!cleanNum || cleanNum.length !== 11 || !cleanNum.startsWith("01")) {
      return { success: false, message: "সঠিক ১১ ডিজিটের বিকাশ নাম্বার লিখুন (যেমন: 017XXXXXXXX)।" };
    }

    const meta = await getReferralMeta();
    meta.bkash_numbers[cleanId] = cleanNum;
    await saveReferralMeta(meta);

    // ডেটাবেজ কলাম থাকলে আপডেট
    try {
      await supabase
        .from("referral_records")
        .update({ referrer_bkash: cleanNum })
        .eq("referrer_id", cleanId);
    } catch {
      // কলাম না থাকলে মেটাতেই সুরক্ষিত
    }

    return { success: true, message: "আপনার বিকাশ নাম্বার সফলভাবে সংরক্ষিত হয়েছে!" };
  } catch (err: any) {
    console.error("saveStudentBkashNumber error:", err);
    return { success: false, message: err?.message || "বিকাশ নাম্বার সেভ করা যায়নি।" };
  }
}

/**
 * শিক্ষার্থীর সংরক্ষিত বিকাশ নাম্বার পাওয়া।
 */
export async function getStudentBkashNumber(studentId: string): Promise<string> {
  try {
    const cleanId = String(studentId || "").trim();
    if (!cleanId) return "";
    const meta = await getReferralMeta();
    return meta.bkash_numbers[cleanId] || "";
  } catch {
    return "";
  }
}

/**
 * শিক্ষক কর্তৃক রেফারেলের টাকা পরিশোধের স্ট্যাটাস মার্ক করা ('paid' বা 'unpaid')।
 */
export async function markReferralPayout(
  recordId: string,
  paymentStatus: "paid" | "unpaid",
  note?: string
): Promise<{ success: boolean; message: string; paidAt?: string }> {
  try {
    await requireTeacher();

    const cleanId = String(recordId || "").trim();
    if (!cleanId) return { success: false, message: "রেকর্ড আইডি পাওয়া যায়নি।" };

    const paidAt = paymentStatus === "paid" ? getTrueDate().toISOString() : undefined;
    const meta = await getReferralMeta();
    meta.payouts[cleanId] = {
      status: paymentStatus,
      paid_at: paidAt,
      note: note || (paymentStatus === "paid" ? "বিকাশ পেমেন্ট সম্পন্ন" : "")
    };
    await saveReferralMeta(meta);

    // ডেটাবেজ টেবিলে কলাম থাকলে আপডেট
    try {
      await supabase
        .from("referral_records")
        .update({
          payment_status: paymentStatus,
          paid_at: paidAt || null,
          payment_note: note || null
        })
        .eq("id", cleanId);
    } catch {
      // ignore
    }

    return {
      success: true,
      message: paymentStatus === "paid" ? "টাকা পরিশোধ সফলভাবে মার্ক করা হয়েছে!" : "পরিশোধ স্ট্যাটাস বাতিল (বাকি) করা হয়েছে।",
      paidAt
    };
  } catch (err: any) {
    console.error("markReferralPayout error:", err);
    return { success: false, message: err?.message || "পেমেন্ট স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে।" };
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
  referredUserBkash?: string;
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

    const cleanReferredBkash = payload.referredUserBkash
      ? parseBengaliDigits(payload.referredUserBkash).trim().replace(/[^0-9]/g, "")
      : "";

    // বিকাশ নাম্বার সংরক্ষণ
    const meta = await getReferralMeta();
    if (cleanReferredBkash) {
      meta.bkash_numbers[payload.referredUserId] = cleanReferredBkash;
      await saveReferralMeta(meta);
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
    
    // কোর্সের দাম অনুযায়ী কমিশন হিসাব (একাধিক কোর্স থাকলে প্রতিটির শতকরা হিসেব যোগ হয়)
    const courseList = payload.course.split(",").map(c => c.trim()).filter(Boolean);
    let totalReward = 0;
    for (const c of courseList) {
      const pInfo = prices[c];
      const actualPrice = pInfo ? (pInfo.offerPrice ?? pInfo.price ?? 500) : 500;
      const cConfig = getCourseReferralConfig(settings, c);
      totalReward += Math.round((actualPrice * cConfig.rewardPercent) / 100);
    }
    const computedReward = totalReward || (settings.rewardPerReferral || 50);

    const refBkash = meta.bkash_numbers[val.referrerId] || "";

    const insertPayload: Record<string, any> = {
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
    };

    if (refBkash) insertPayload.referrer_bkash = refBkash;
    if (cleanReferredBkash) insertPayload.referred_user_bkash = cleanReferredBkash;

    const { error } = await supabase.from("referral_records").insert(insertPayload);
    if (error) {
      // যদি কলাম না থাকে, বেসিক ফিল্ড দিয়ে সেভ করি
      delete insertPayload.referrer_bkash;
      delete insertPayload.referred_user_bkash;
      await supabase.from("referral_records").insert(insertPayload);
    }

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
    const meta = await getReferralMeta();

    // ২. রেফারেল রেকর্ডসমূহ
    const { data: rows } = await supabase
      .from("referral_records")
      .select("*")
      .eq("referrer_id", cleanId)
      .order("created_at", { ascending: false });

    const records: ReferralRecord[] = (rows || []).map((r) => {
      const payout = meta.payouts[r.id];
      const pStatus: "unpaid" | "paid" = (payout?.status === "paid" || r.payment_status === "paid") ? "paid" : "unpaid";
      return {
        id: r.id,
        referrerId: r.referrer_id,
        referrerName: r.referrer_name,
        referrerEmail: r.referrer_email,
        referrerBkash: meta.bkash_numbers[r.referrer_id] || r.referrer_bkash || "",
        referredUserId: r.referred_user_id,
        referredUserName: r.referred_user_name,
        referredUserEmail: r.referred_user_email,
        referredUserBkash: meta.bkash_numbers[r.referred_user_id] || r.referred_user_bkash || "",
        referralCode: r.referral_code,
        course: r.course,
        status: r.status as "pending" | "completed",
        rewardAmount: Number(r.reward_amount || DEFAULT_REFERRAL_SETTINGS.rewardPerReferral),
        paymentStatus: pStatus,
        paidAt: payout?.paid_at || r.paid_at,
        paymentNote: payout?.note || r.payment_note,
        createdAt: r.created_at,
        completedAt: r.completed_at
      };
    });

    const totalReferrals = records.length;
    const completedReferrals = records.filter((r) => r.status === "completed").length;
    const pendingReferrals = totalReferrals - completedReferrals;
    const totalEarnings = records
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    const paidEarnings = records
      .filter((r) => r.status === "completed" && r.paymentStatus === "paid")
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    const unpaidEarnings = totalEarnings - paidEarnings;

    return {
      referralCode,
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalEarnings,
      paidEarnings,
      unpaidEarnings,
      bkashNumber: meta.bkash_numbers[cleanId] || "",
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
  totalPaidAmount: number;
  totalUnpaidAmount: number;
  completedCount: number;
  pendingCount: number;
}> {
  try {
    await requireTeacher();

    const [rowsRes, meta] = await Promise.all([
      supabase.from("referral_records").select("*").order("created_at", { ascending: false }),
      getReferralMeta()
    ]);

    const rows = rowsRes.data || [];

    const records: ReferralRecord[] = rows.map((r: any) => {
      const payout = meta.payouts[r.id];
      const pStatus: "unpaid" | "paid" = (payout?.status === "paid" || r.payment_status === "paid") ? "paid" : "unpaid";
      return {
        id: r.id,
        referrerId: r.referrer_id,
        referrerName: r.referrer_name,
        referrerEmail: r.referrer_email,
        referrerBkash: meta.bkash_numbers[r.referrer_id] || r.referrer_bkash || "",
        referredUserId: r.referred_user_id,
        referredUserName: r.referred_user_name,
        referredUserEmail: r.referred_user_email,
        referredUserBkash: meta.bkash_numbers[r.referred_user_id] || r.referred_user_bkash || "",
        referralCode: r.referral_code,
        course: r.course,
        status: r.status as "pending" | "completed",
        rewardAmount: Number(r.reward_amount || DEFAULT_REFERRAL_SETTINGS.rewardPerReferral),
        paymentStatus: pStatus,
        paidAt: payout?.paid_at || r.paid_at,
        paymentNote: payout?.note || r.payment_note,
        createdAt: r.created_at,
        completedAt: r.completed_at
      };
    });

    const completedCount = records.filter((r) => r.status === "completed").length;
    const pendingCount = records.filter((r) => r.status === "pending").length;
    const totalEarningsIssued = records
      .filter((r) => r.status === "completed")
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    const totalPaidAmount = records
      .filter((r) => r.status === "completed" && r.paymentStatus === "paid")
      .reduce((sum, r) => sum + r.rewardAmount, 0);

    const totalUnpaidAmount = totalEarningsIssued - totalPaidAmount;

    return {
      records,
      totalEarningsIssued,
      totalPaidAmount,
      totalUnpaidAmount,
      completedCount,
      pendingCount
    };
  } catch (err) {
    console.error("getAllReferralRecordsForAdmin error:", err);
    return {
      records: [],
      totalEarningsIssued: 0,
      totalPaidAmount: 0,
      totalUnpaidAmount: 0,
      completedCount: 0,
      pendingCount: 0
    };
  }
}


