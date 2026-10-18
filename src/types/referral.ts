export interface ReferralRecord {
  id: string; // unique referral record id (UUID)
  referrerId: string; // student uid who referred
  referrerName?: string;
  referrerEmail?: string;
  referrerBkash?: string; // রেফারারের বিকাশ নাম্বার
  referredUserId: string; // new student uid
  referredUserName: string;
  referredUserEmail?: string;
  referredUserBkash?: string; // যে রেফারেল ব্যবহার করল তার বিকাশ নাম্বার
  referralCode: string;
  course: string;
  status: "pending" | "completed"; // pending = enrolled/submitted, completed = approved
  rewardAmount: number; // e.g. 50 tk or bonus points
  paymentStatus: "unpaid" | "paid"; // টাকা প্রদান করা হয়েছে কিনা
  paidAt?: string; // টাকা প্রদানের তারিখ
  paymentNote?: string; // পেমেন্ট নোট
  createdAt: string;
  completedAt?: string;
}

export interface StudentReferralProfile {
  referralCode: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  paidEarnings: number; // ইতিমধ্যে পরিশোধিত টাকা
  unpaidEarnings: number; // এখনো বাকি টাকা
  bkashNumber?: string; // স্টুডেন্টের সংরক্ষিত বিকাশ নাম্বার
  referrals: ReferralRecord[];
}

export interface CourseReferralConfig {
  rewardPercent: number; // Referrer reward % of course price (e.g. 10%)
  discountPercent: number; // Referee discount % of course price (e.g. 10%)
}

export interface ReferralSettings {
  enabled: boolean;
  defaultRewardPercent: number; // Default referrer reward % if not customized for a course (e.g. 10%)
  defaultDiscountPercent: number; // Default referee discount % if not customized for a course (e.g. 10%)
  courseConfigs: Record<string, CourseReferralConfig>; // Course-wise percentage config: { [courseName]: { rewardPercent, discountPercent } }
  rewardPerReferral?: number; // fallback flat amount
  refereeDiscount?: number; // fallback flat amount
  referralNotice?: string;
}

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  enabled: true,
  defaultRewardPercent: 10, // ১০% রিওয়ার্ড
  defaultDiscountPercent: 10, // ১০% ছাড়
  courseConfigs: {},
  rewardPerReferral: 50,
  refereeDiscount: 50,
  referralNotice: "প্রতিটি সফল রেফারেলের জন্য আপনি পাবেন নির্ধারিত % রিওয়ার্ড এবং আপনার বন্ধু পাবেন % ছাড়!"
};

export function generateReferralCodeString(seed: string): string {
  const clean = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const suffix = clean.length >= 4 ? clean.slice(-4) : Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BCS-${suffix}`;
}


