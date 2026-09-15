import { getSessionUserFromCookies } from "@/lib/teacher-auth";

/**
 * পড়াশোনার কনটেন্টের (প্রশ্নব্যাংক / প্র্যাকটিস / কোর্স-ভিডিও / WhatsApp লিংক)
 * জন্য **নিরাপদ পরিচয় নির্ধারণ**।
 *
 * সমস্যা যা এটা বন্ধ করে:
 * আগে এই action-গুলো ক্লায়েন্টের পাঠানো `studentId`/`email` সোজা
 * `verifyStudentAccess`-এ ঢুকিয়ে দিত। কিন্তু `verifyStudentAccess` কোনো
 * authentication নয় — সে শুধু বলে "এই আইডি/ইমেইলটি enrolled", কখনো না "তুমি
 * সেই মানুষ"। ফলে যে কেউ একজন এনরোল্ড ছাত্রের ফোন নম্বর/ইমেইল জানলেই — লগইন
 * ছাড়াই — পুরো পেইড প্রশ্নব্যাংক উত্তর সহ, প্র্যাকটিস পুল, কোর্সের ভিডিও ও
 * পেইড গ্রুপের ইনভাইট লিংক বের করে নিতে পারত।
 *
 * নীতি (দুই স্তর):
 *   ১. **সেশন থাকলে** সেটাই একমাত্র পরিচয় — ক্লায়েন্টের দেওয়া id/email
 *      সম্পূর্ণ উপেক্ষা করা হয়। Google-লগইন করা শিক্ষার্থীদের জন্য এটাই পথ,
 *      আর `verifyStudentAccess` ইমেইল দিয়ে মিলিয়ে প্রকৃত রোস্টার-আইডি
 *      (`normalizedId`) বের করে দেয় — যা submission/notebook-এ ব্যবহৃত হয়।
 *   ২. **সেশন না থাকলে** শিক্ষক-হাতে-যোগ-করা ম্যানুয়াল (ফোন-আইডি) ছাত্রদের
 *      জন্য সংকীর্ণ fallback: id **এবং** email দুটোই দিতে হবে এবং দুটোই
 *      `allowed_students`-এর **একই** সারিতে মিলতে হবে। শুধু একটি ফোন নম্বর
 *      জানা আর যথেষ্ট নয় — তাই আগের "নম্বর জানলেই ঢুকতে পারবে" অবস্থার অবসান।
 *
 * নোট: অ্যাপের নিয়ম অপরিবর্তিত — **যেকোনো একটি কোর্সে এনরোল্ড থাকলেই**
 * প্রশ্নব্যাংক/প্র্যাকটিসের সব প্রশ্ন দেখা ও প্র্যাকটিস করা যায়। এখানে শুধু
 * "কে" সেই এনরোল্ড ছাত্র, সেটা নির্ধারণ করা হয়।
 */
export interface StudyIdentity {
  /** সেশন-বাঁধা বা (fallback-এ) যাচাইকৃত আইডি। */
  id: string;
  email?: string;
  /** true হলে পরিচয় প্রমাণিত সেশন থেকে এসেছে (fallback নয়)। */
  fromSession: boolean;
}

export async function resolveStudyIdentity(
  clientId?: string | null,
  clientEmail?: string | null
): Promise<StudyIdentity | null> {
  // ── স্তর ১: যাচাইকৃত সেশন (সবচেয়ে শক্তিশালী পরিচয়) ──
  try {
    const sessionUser = await getSessionUserFromCookies();
    if (sessionUser?.id) {
      return { id: sessionUser.id, email: sessionUser.email, fromSession: true };
    }
  } catch {
    // সেশন পড়তে ব্যর্থ → fallback-এ নামি (fallback নিজেই কড়া)
  }

  // ── স্তর ২: ম্যানুয়াল ছাত্রদের জন্য সংকীর্ণ fallback ──
  // id ও email দুটোই লাগবে, এবং দুটোই একই সারিতে মিলতে হবে।
  const id = String(clientId ?? "").trim();
  const email = String(clientEmail ?? "").trim().toLowerCase();
  if (!id || !email) return null;

  try {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase
      .from("allowed_students")
      .select("id, email")
      .eq("id", id)
      .maybeSingle();

    const rowEmail = String(data?.email ?? "").trim().toLowerCase();
    if (!rowEmail || rowEmail !== email) return null;

    return { id, email, fromSession: false };
  } catch {
    return null;
  }
}
