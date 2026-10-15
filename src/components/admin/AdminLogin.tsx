"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Shield,
  Mail,
  Key,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  Lock,
  Sparkles
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface AdminLoginProps {
  onSuccess?: (teacher: { email: string; role: string }) => void;
}

/**
 * শিক্ষক/অ্যাডমিন প্যানেলের লগইন ল্যান্ডিং পেজ (/admin)।
 * Google OAuth অথবা ইমেইল+পাসওয়ার্ড (Supabase Authentication)।
 */
export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const handleGoogleAuth = async () => {
    setErrorMsg("");
    setInfoMsg("");
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setIsLoading(true);

    try {
      const cleanEmail = email.trim();
      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) throw error;

      const token = data.session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (token) {
        document.cookie = `sb_access_token=${token}; path=/; SameSite=Lax; Max-Age=3600${window.location.protocol === "https:" ? "; Secure" : ""}`;
      }

      // SECURITY: verify server-side that this account is actually a teacher
      const { verifyTeacherSession } = await import("@/actions/admin-actions");
      const verified = await verifyTeacherSession(token);
      if (!verified.ok) {
        await supabase.auth.signOut();
        throw new Error(verified.error || "এই অ্যাকাউন্টে শিক্ষক প্যানেলের অনুমতি নেই।");
      }

      const teacherObj = { email: verified.email || data.user?.email || "শিক্ষক", role: "admin" };
      sessionStorage.setItem("teacher_user", JSON.stringify(teacherObj));

      if (onSuccess) {
        onSuccess(teacherObj);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "অথেনটিকেশনে সমস্যা হয়েছে।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      const input = prompt("আপনার নিবন্ধিত শিক্ষক ইমেইল এড্রেসটি দিন:");
      if (!input) return;
      setEmail(input);
    }
    try {
      const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://aarohon.com";
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl });
      if (error) throw error;
      setInfoMsg(`আপনার ইমেইল (${email})-এ একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।`);
    } catch (err: any) {
      setErrorMsg(err.message || "পাসওয়ার্ড রিসেট লিংক পাঠাতে সমস্যা হয়েছে।");
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
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40 border border-white/10 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-500" /> শিক্ষক লগইন
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> Supabase সুরক্ষা
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="p-3 rounded-xl text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
              {infoMsg}
            </div>
          )}

          {/* Google Login button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isGoogleLoading || isLoading}
            className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold py-3.5 px-4 rounded-xl border border-slate-200 transition text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>Google দিয়ে যাচাই হচ্ছে...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google দিয়ে শিক্ষক লগইন</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 my-1">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[11px] font-bold text-slate-400">অথবা ইমেইল ও পাসওয়ার্ড</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-indigo-500" /> ইমেইল এড্রেস
              </label>
              <input
                type="email"
                required
                placeholder="teacher@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-slate-50/50"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-indigo-500" /> পাসওয়ার্ড
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="পাসওয়ার্ড দেখুন/লুকান"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition text-xs sm:text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> যাচাই হচ্ছে...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" /> প্যানেলে প্রবেশ করুন
                </>
              )}
            </button>
          </form>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            শুধুমাত্র অনুমোদিত শিক্ষক/অ্যাডমিন অ্যাকাউন্ট প্রবেশ করতে পারবে। অননুমোদিত প্রবেশের
            চেষ্টা নিরীক্ষণ করা হয়।
          </p>
        </div>
      </div>
    </div>
  );
};
