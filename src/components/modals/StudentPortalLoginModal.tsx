"use client";

import React, { useState } from "react";
import { X, Contact, CircleAlert, LogIn, Sparkles, BookOpen } from "lucide-react";
import { loginWithGoogle } from "@/lib/student-auth";

interface StudentPortalLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (studentId: string) => void;
  onOpenEnrollModal?: () => void;
}

export const StudentPortalLoginModal: React.FC<StudentPortalLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  onOpenEnrollModal,
}) => {
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      // loginWithGoogle will trigger browser redirection to Google login;
      // after login the student returns to /portal
      await loginWithGoogle(undefined, "/portal");
      // We don't turn off isLoading or set user successful login state here
      // since the page will redirect.
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setErrorMsg("সার্ভারে সংযোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all font-bengali animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 flex items-center justify-center transition cursor-pointer backdrop-blur-sm"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="p-6 sm:p-8 text-center border-b border-slate-100/60 bg-white/40 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100/50 flex items-center justify-center mx-auto text-indigo-900 shadow-sm">
            <Contact className="w-7 h-7" />
          </div>

          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">
            স্টুডেন্ট পোর্টাল
          </h3>
          <p className="text-sm font-medium text-indigo-950/70 tracking-wide">
            Login with Google
          </p>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-4 bg-slate-50/40">
          {errorMsg && (
            <div className="bg-rose-50/80 border border-rose-200/50 text-rose-700 text-xs p-3.5 rounded-xl flex items-start gap-2 backdrop-blur-sm">
              <CircleAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="leading-snug">{errorMsg}</p>
            </div>
          )}

          <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 shadow-sm shadow-slate-200/30">
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleLogin}
              className="w-14 h-14 rounded-full border border-slate-200 hover:border-indigo-300 bg-white hover:bg-slate-50 flex items-center justify-center transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md active:scale-95 group"
              aria-label="Google Login"
            >
              {isLoading ? (
                <span className="text-sm text-slate-400 font-bold">...</span>
              ) : (
                <svg className="w-6 h-6 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.89 3.02C6.21 7.42 8.87 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.99 3.7-8.62z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.78a7.02 7.02 0 0 1-.37-2.22c0-.77.13-1.51.37-2.22L1.39 7.32A11.96 11.96 0 0 0 0 12c0 1.72.36 3.35.99 4.83l4.29-3.05z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.1.74-2.51 1.18-4.23 1.18-3.13 0-5.79-2.38-6.73-5.54l-3.89 3.02C3.37 20.33 7.35 23 12 23z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
