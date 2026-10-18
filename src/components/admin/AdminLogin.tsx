"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Shield,
  Loader2,
  ArrowLeft,
  Lock,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AdminLoginProps {
  onSuccess?: (teacher: { email: string; role: string }) => void;
}

/**
 * শিক্ষক/অ্যাডমিন প্যানেলের লগইন ল্যান্ডিং পেজ (/admin)।
 * শুধুমাত্র Google Authentication (Google Sign-In)-এর মাধ্যমে প্রবেশাধিকার।
 */
export const AdminLogin: React.FC<AdminLoginProps> = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGoogleAuth = async () => {
    setErrorMsg("");
    setIsGoogleLoading(true);
    try {
      const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/admin`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || "Google লগইনে সমস্যা হয়েছে।");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 overflow-hidden flex items-center justify-center p-4 sm:p-6 font-bengali">
      {/* Decorative blobs */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Back to home */}
      <Link
        href="/"
        className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-xl transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> হোমে ফিরুন
      </Link>

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-7 space-y-3">
          <div className="inline-flex items-center gap-3">
            <span className="bg-gradient-to-tr from-amber-400 to-indigo-500 p-3 rounded-2xl shadow-lg shadow-black/30">
              <GraduationCap className="w-8 h-8 text-slate-900" />
            </span>
            <span className="text-3xl font-black tracking-wide text-white">আরোহণ</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-black text-white flex items-center justify-center gap-2">
              <Shield className="w-5 h-5 text-amber-300" /> শিক্ষক প্যানেল
            </h1>
            <p className="text-xs sm:text-sm text-indigo-300/90 font-medium">
              পরীক্ষা, প্রশ্নব্যাংক, কোর্স ও শিক্ষার্থীদের নিয়ন্ত্রণ — একটি সুরক্ষিত জায়গায়
            </p>
          </div>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40 border border-white/10 space-y-6">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-500" /> সুরক্ষিত শিক্ষক প্রবেশ
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> Google Auth
            </span>
          </div>

          <div className="text-center space-y-2 py-1">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs border border-indigo-100">
              <Shield className="w-7 h-7" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              অ্যাডমিন / শিক্ষক হিসেবে লগইন
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
              পাসওয়ার্ডের ঝামেলা ছাড়া আপনার অনুমোদিত জিমেইল / গুগল অ্যাকাউন্ট দিয়ে সরাসরি প্রবেশ করুন।
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Google Login button */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-2xl transition text-sm shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Google দিয়ে যাচাই হচ্ছে...</span>
                </>
              ) : (
                <>
                  <div className="bg-white p-1 rounded-full shadow-xs">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <span>Google দিয়ে শিক্ষক লগইন করুন</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-1.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> অনুমোদিত ইমেইল আবশ্যক
            </div>
            <p className="leading-relaxed">
              শুধুমাত্র সিস্টেমে পূর্বানুমোদিত শিক্ষক ও অ্যাডমিনদের জিমেইল দিয়েই প্যানেলটি আনলক হবে।
            </p>
          </div>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            অননুমোদিত প্রবেশের চেষ্টা সার্ভার-স্তরে স্বয়ংক্রিয়ভাবে প্রত্যাখ্যাত হয়।
          </p>
        </div>
      </div>
    </div>
  );
};
