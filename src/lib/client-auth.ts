"use client";

import { supabase } from "@/lib/supabase";

/**
 * ক্লায়েন্ট থেকে AI-র রাউটে পাঠানোর জন্য অথ-হেডার।
 *
 * ── কেন Bearer হেডারও পাঠানো হয় ──
 * সার্ভার `sb_access_token` কুকি দিয়েও পরিচয় পায়, কিন্তু কুকিটা কেবল
 * লগইনের সময় `onAuthStateChange`-এ বসে এবং `Max-Age=3600` পরে মুছে যায়।
 * কুকি না থাকলেও সেশনটা ব্রাউজারে ঠিকই থাকে — তাই সেশন থেকে সরাসরি টোকেন
 * পাঠিয়ে দেওয়াই নিরাপদ। সার্ভার দিকের যাচাই (`requireTeacherForRequest`)
 * প্রথমে Bearer দেখে, না মিললে কুকিতে নামে; ফলে কোনো একটা পথ ভাঙলেও
 * শিক্ষকের কাজ আটকায় না।
 *
 * টোকেন না পেলে শুধু বাকি হেডারগুলোই ফেরে — কুকি-পথ তখন নিজে কাজ করবে।
 */
export async function authHeaders(
  extra?: Record<string, string>
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...(extra || {}) };

  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // সেশন পড়া না গেলে কুকি-পথ আছে — এখানে থামানো ঠিক নয়
  }

  return headers;
}
