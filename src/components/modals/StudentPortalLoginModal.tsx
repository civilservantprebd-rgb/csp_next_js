"use client";

import React, { useState, useEffect } from "react";
import { X, Contact, ArrowRight, Sparkles, UserCheck, CircleAlert, Phone, BookOpen } from "lucide-react";
import { parseBengaliDigits } from "@/lib/utils";

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
  const [studentId, setStudentId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("bcs_last_student_id");
      if (stored) {
        setSavedId(stored);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = studentId.trim();
    if (!clean) {
      setErrorMsg("দয়া করে আপনার স্টুডেন্ট আইডি বা মোবাইল নম্বরটি লিখুন।");
      return;
    }

    const normalized = parseBengaliDigits(clean).trim();
    if (typeof window !== "undefined") {
      localStorage.setItem("bcs_last_student_id", normalized || clean);
    }

    setErrorMsg("");
    onLoginSuccess(normalized || clean);
    onClose();
  };

  const handleUseSavedId = (id: string) => {
    setStudentId(id);
    const normalized = parseBengaliDigits(id).trim();
    onLoginSuccess(normalized || id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md transition-all font-bengali">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Gradient */}
        <div className="relative bg-gradient-to-tr from-indigo-900 via-indigo-800 to-violet-800 text-white p-6 sm:p-7 text-center overflow-hidden">
          {/* Subtle decorative background circles */}
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-400/20 rounded-full blur-lg pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition backdrop-blur-sm cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative inline-flex mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-900/90 rounded-[14px] flex items-center justify-center">
                <Contact className="w-8 h-8 text-amber-300" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow">
              <Sparkles className="w-3 h-3" />
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            স্টুডেন্ট পোর্টাল
          </h3>
          <p className="text-xs sm:text-sm text-indigo-200 mt-1.5 max-w-xs mx-auto leading-relaxed">
            আপনার পরীক্ষার ফলাফল, মার্কশিট ও পারফরম্যান্স বিশ্লেষণ দেখতে আইডি দিয়ে লগইন করুন
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200/80 text-rose-700 text-xs p-3.5 rounded-2xl flex items-start gap-2.5 shadow-sm">
              <CircleAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="leading-snug">{errorMsg}</p>
            </div>
          )}

          {/* Quick login with previously saved ID */}
          {savedId && (
            <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-indigo-900 min-w-0">
                <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">আগের আইডি: <strong className="font-mono font-bold text-indigo-700">{savedId}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => handleUseSavedId(savedId)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-xl transition text-[11px] shrink-0 shadow-sm cursor-pointer"
              >
                সরাসরি প্রবেশ
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                স্টুডেন্ট আইডি / মোবাইল নম্বর
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="যেমন: 01700000000 বা স্টুডেন্ট রোল"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm font-mono transition text-slate-900 placeholder:text-slate-400 shadow-inner"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <span>💡</span> ভর্তির সময় ব্যবহৃত মোবাইল নম্বরটিই আপনার স্টুডেন্ট আইডি
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-500/25 transition-all duration-150 flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-[0.99]"
            >
              <span>ড্যাশবোর্ডে প্রবেশ করুন</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer Info / Enroll Helper */}
          {onOpenEnrollModal && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                এখনও কোর্সে ভর্তি হননি?{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEnrollModal();
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-bold underline underline-offset-2 transition cursor-pointer inline-flex items-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" /> নতুন এনরোল করুন
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
