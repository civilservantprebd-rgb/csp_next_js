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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-all font-bengali animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="বন্ধ করুন"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Minimalist Header */}
        <div className="p-6 sm:p-7 text-center border-b border-slate-100 bg-slate-50/50 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 shadow-2xs">
            <Contact className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-bold text-slate-900">
            স্টুডেন্ট পোর্টাল
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
            আপনার পরীক্ষার ফলাফল ও পারফরম্যান্স বিশ্লেষণ দেখতে আইডি বা মোবাইল নম্বর দিন
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-7 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200/80 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2">
              <CircleAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="leading-snug">{errorMsg}</p>
            </div>
          )}

          {/* Quick login with previously saved ID */}
          {savedId && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700 min-w-0">
                <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="truncate">সংরক্ষিত আইডি: <strong className="font-mono font-bold text-slate-900">{savedId}</strong></span>
              </div>
              <button
                type="button"
                onClick={() => handleUseSavedId(savedId)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-3 py-1.5 rounded-xl transition text-[11px] shrink-0 shadow-2xs cursor-pointer"
              >
                সরাসরি প্রবেশ
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
                  placeholder="যেমন: 01700000000 বা রোল নম্বর"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm font-mono transition text-slate-900 placeholder:text-slate-400 shadow-2xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer active:scale-[0.99]"
            >
              <span>ড্যাশবোর্ডে প্রবেশ করুন</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Footer Info / Enroll Helper */}
          {onOpenEnrollModal && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                নতুন শিক্ষার্থী?{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEnrollModal();
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-bold underline underline-offset-2 transition cursor-pointer inline-flex items-center gap-1"
                >
                  <BookOpen className="w-3.5 h-3.5" /> কোর্সে এনরোল করুন
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
