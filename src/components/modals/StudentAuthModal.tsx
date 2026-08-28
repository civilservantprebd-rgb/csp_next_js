"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Clock,
  CircleHelp,
  Award,
  BookOpen,
  ArrowRight,
  X,
  User,
  ShieldCheck,
  Zap,
  CheckCircle2,
  LogIn
} from "lucide-react";
import { verifyStudentAccess } from "@/actions/student-actions";
import { checkStudentAlreadySubmitted } from "@/actions/exam-actions";
import { isExamCurrentlyLive } from "@/lib/bangladesh-time";
import { Exam } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";
import { getLocalStudentUser, loginWithGoogle, StudentUser } from "@/lib/student-auth";

interface StudentAuthModalProps {
  isOpen: boolean;
  exam: Exam;
  onClose: () => void;
  onVerified: (student: { id: string; name: string }) => void;
  onOpenEnrollModal?: () => void;
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({
  isOpen,
  exam,
  onClose,
  onVerified,
  onOpenEnrollModal
}) => {
  const isFree = !!exam.isFree;
  const [studentUser, setStudentUser] = useState<StudentUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setStudentUser(getLocalStudentUser());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const qCount = exam.questions?.length || 0;

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      await loginWithGoogle(exam.id);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      setErrorMsg("সার্ভারে সংযোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!studentUser) {
      setErrorMsg("পরীক্ষা শুরু করতে প্রথমে গুগল দিয়ে লগইন করুন।");
      return;
    }

    const isLive = isExamCurrentlyLive(exam);

    if (isFree) {
      // Free exam: anyone logged in with Google can take it
      if (isLive) {
        setIsLoading(true);
        const already = await checkStudentAlreadySubmitted(exam.id, studentUser.uid);
        setIsLoading(false);
        if (already) {
          setErrorMsg("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক অ্যাকাউন্ট দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          return;
        }
      }

      onVerified({
        name: studentUser.name,
        id: studentUser.uid,
      });
      return;
    }

    // Paid exam: Verify enrollment in allowed_students using Google UID
    setIsLoading(true);
    const res = await verifyStudentAccess(studentUser.uid, exam.course);

    if (res.allowed) {
      const targetId = res.normalizedId || studentUser.uid;

      if (isLive) {
        const already = await checkStudentAlreadySubmitted(exam.id, targetId);
        setIsLoading(false);
        if (already) {
          setErrorMsg("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক অ্যাকাউন্ট দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          return;
        }
      }

      setIsLoading(false);
      onVerified({
        name: res.studentName || studentUser.name,
        id: targetId,
      });
    } else {
      setIsLoading(false);
      setErrorMsg(res.message || "এই কোর্সের পেইড পরীক্ষায় অংশ নিতে আপনার অনুমোদন নেই।");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs font-bengali animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="বন্ধ করুন"
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Elegant Hero Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 p-5 text-white relative">
          <div className="flex items-center gap-2 mb-1.5">
            {isFree ? (
              <span className="inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                🎁 সম্পূর্ণ ফ্রি মক
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                👑 প্রিমিয়াম এক্সাম ({exam.course})
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
            {exam.title}
          </h2>
          <p className="text-[11px] text-indigo-300 mt-1 font-medium">
            বিষয়: {exam.subject}
          </p>
        </div>

        {/* Exam Metrics Row */}
        <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-100 py-3 text-center text-xs">
          <div className="border-r border-slate-200/60">
            <span className="text-[10px] text-slate-500 block">মোট প্রশ্ন</span>
            <strong className="text-slate-800 font-bold">{toBengaliDigits(qCount)} টি</strong>
          </div>
          <div className="border-r border-slate-200/60">
            <span className="text-[10px] text-slate-500 block">সময় বরাদ্দ</span>
            <strong className="text-slate-800 font-bold">{toBengaliDigits(exam.timerMinutes)} মিনিট</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">পূর্ণমান</span>
            <strong className="text-slate-800 font-bold">{toBengaliDigits(qCount)} নম্বর</strong>
          </div>
        </div>

        {/* Info or Form Body */}
        <div className="p-5 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {!studentUser ? (
            /* Google Login required */
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xs">
                <LogIn className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">গুগল লগইন আবশ্যক</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  পরীক্ষায় অংশ নিতে এবং আপনার ব্যক্তিগত প্রোফাইল ও ভুল উত্তরের খাতা সুরক্ষিত রাখতে গুগল দিয়ে লগইন করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl border border-slate-200 shadow-2xs transition flex items-center justify-center gap-2.5 text-xs sm:text-sm cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                <span>গুগল দিয়ে লগইন করুন</span>
              </button>
            </div>
          ) : (
            /* Logged in student starting form */
            <form onSubmit={handleStartExam} className="space-y-4">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  {studentUser.photoURL ? (
                    <img src={studentUser.photoURL} alt="Student avatar" className="w-8 h-8 rounded-full border border-indigo-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-800 truncate">{studentUser.name}</h4>
                    <p className="text-[10px] text-slate-500 truncate">{studentUser.email}</p>
                  </div>
                </div>
              </div>

              {/* Instructions summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-600 text-xs space-y-2 leading-relaxed">
                <p className="font-bold text-slate-800 text-center border-b border-slate-200 pb-1.5 mb-1.5">⏰ পরীক্ষার নিয়মাবলী</p>
                <div className="flex items-start gap-1.5">
                  <span className="text-indigo-600">•</span>
                  <span>প্রতিটি ভুল উত্তরের জন্য <strong>০.৫০ নম্বর</strong> কাটা হবে।</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-indigo-600">•</span>
                  <span>সময় শেষ হলে উত্তরপত্র স্বয়ংক্রিয়ভাবে জমা হয়ে যাবে।</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-xl shadow-xs transition duration-150 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
              >
                <span>{isLoading ? "যাচাই করা হচ্ছে..." : "পরীক্ষা শুরু করুন"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Payment CTA for non-allowed students */}
          {!isFree && studentUser && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                এই কোর্সে অংশ নেওয়ার অনুমতি নেই?{" "}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenEnrollModal) onOpenEnrollModal();
                  }}
                  className="text-indigo-600 hover:text-indigo-800 font-bold underline underline-offset-2 transition cursor-pointer"
                >
                  Enroll Now
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
