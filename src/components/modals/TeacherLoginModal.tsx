"use client";

import React, { useState } from "react";
import {
  X,
  Shield,
  Loader2,
  Sparkles
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TeacherLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: { email: string; role: "admin" | "subadmin" }) => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-bengali">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 relative border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="bg-indigo-50 text-indigo-600 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2 text-2xl shadow-inner border border-indigo-100">
            <Shield className="w-7 h-7" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            শিক্ষক প্যানেল লগইন
          </h3>
          <p className="text-xs text-slate-500">শুধুমাত্র Google Authentication দ্বারা সুরক্ষিত এক্সেস</p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200">
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={isGoogleLoading}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl transition text-xs sm:text-sm shadow-md flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
        >
          {isGoogleLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span>যাচাই হচ্ছে...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Google দিয়ে শিক্ষক লগইন করুন</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
