"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Clock,
  CircleHelp,
  Award,
  BookOpen,
  ArrowRight,
  X,
  User,
  Phone,
  ShieldCheck,
  Zap,
  CheckCircle2
} from "lucide-react";
import { verifyStudentAccess } from "@/actions/student-actions";
import { checkStudentAlreadySubmitted, isExamCurrentlyLive } from "@/actions/exam-actions";
import { Exam } from "@/types/exam";
import { toBengaliDigits, parseBengaliDigits } from "@/lib/utils";

interface StudentAuthModalProps {
  isOpen: boolean;
  exam: Exam;
  onClose: () => void;
  onVerified: (student: { id: string; name: string }) => void;
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({
  isOpen,
  exam,
  onClose,
  onVerified,
}) => {
  const isFree = !!exam.isFree;
  const [authMode, setAuthMode] = useState<"no_id" | "with_id">("no_id");
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const qCount = exam.questions?.length || 0;
  const isFreeNoId = isFree && authMode === "no_id";

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanInput = studentId.trim();
    if (!cleanInput) {
      setErrorMsg(
        isFreeNoId
          ? "ফলাফল সংরক্ষণের জন্য দয়া করে মোবাইল নাম্বারটি দিন।"
          : "দয়া করে অনুমোদিত স্টুডেন্ট আইডি বা মোবাইল নাম্বার প্রদান করুন।"
      );
      return;
    }

    const isLive = isExamCurrentlyLive(exam);

    if (isFreeNoId) {
      const normalizedPhone = parseBengaliDigits(cleanInput).trim();
      if (normalizedPhone.length < 6) {
        setErrorMsg("দয়া করে সঠিক মোবাইল নাম্বার লিখুন।");
        return;
      }

      if (isLive) {
        setIsLoading(true);
        const already = await checkStudentAlreadySubmitted(exam.id, normalizedPhone || cleanInput);
        setIsLoading(false);
        if (already) {
          setErrorMsg("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক আইডি বা মোবাইল নম্বর দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          return;
        }
      }

      onVerified({
        name: name.trim() || `পরীক্ষার্থী (${normalizedPhone.slice(-4)})`,
        id: normalizedPhone || cleanInput,
      });
      return;
    }

    // With Enrolled ID verification (for paid exams OR enrolled students taking free exam)
    setIsLoading(true);
    const res = await verifyStudentAccess(cleanInput, exam.course);

    if (res.allowed) {
      const targetId = res.normalizedId || cleanInput;

      if (isLive) {
        const already = await checkStudentAlreadySubmitted(exam.id, targetId);
        setIsLoading(false);
        if (already) {
          setErrorMsg("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক আইডি বা মোবাইল নম্বর দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          return;
        }
      } else {
        setIsLoading(false);
      }

      onVerified({
        name: name.trim() || res.studentName || "পরীক্ষার্থী",
        id: targetId,
      });
    } else {
      setIsLoading(false);
      setErrorMsg(res.message || "এই কোর্সের পরীক্ষায় অংশ নেওয়ার জন্য আপনার অনুমতি নেই।");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 font-bengali animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative border border-slate-100 flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="বন্ধ করুন"
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-slate-700 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-50/80 border-b border-slate-100 relative">
          <div className="space-y-2 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              {isFree ? (
                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                  <Sparkles className="w-3 h-3 text-emerald-600" /> ফ্রি পরীক্ষা
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 text-indigo-600" /> এনরোল্ড পরীক্ষা
                </span>
              )}
              <span className="bg-white text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-md border border-slate-200">
                {exam.course}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {exam.title}
            </h2>

            {/* Exam Meta Info Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-0.5 text-[11px] text-slate-600">
              <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                <BookOpen className="w-3 h-3 text-slate-400" /> {exam.subject}
              </span>
              <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                <Clock className="w-3 h-3 text-slate-400" /> {toBengaliDigits(exam.timerMinutes)} মিনিট
              </span>
              <span className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                <CircleHelp className="w-3 h-3 text-slate-400" /> {toBengaliDigits(qCount)} টি প্রশ্ন
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body & Form */}
        <div className="p-5 sm:p-6 space-y-4 bg-white">
          {/* Segmented Mode Switcher for Free Exams */}
          {isFree && (
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1 border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("no_id");
                  setErrorMsg("");
                }}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "no_id"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Zap className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" /> আইডি ছাড়া (ফ্রি)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("with_id");
                  setErrorMsg("");
                }}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  authMode === "with_id"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> এনরোল্ড আইডি দিয়ে
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-medium flex items-center gap-2">
              <span>⚠️</span> {errorMsg}
            </div>
          )}

          <form onSubmit={handleStartExam} className="space-y-3.5">
            {!isFreeNoId && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  আপনার পূর্ণ নাম <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
                </label>
                <input
                  type="text"
                  placeholder="যেমন: মোঃ আব্দুল্লাহ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-slate-50/50 hover:bg-white focus:bg-white transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Phone className={`w-4 h-4 ${isFreeNoId ? "text-emerald-600" : "text-indigo-600"}`} />
                {isFreeNoId ? "আপনার মোবাইল নম্বর দিন" : "অনুমোদিত স্টুডেন্ট আইডি / মোবাইল"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                autoFocus
                placeholder={isFreeNoId ? "01XXXXXXXXX" : "যেমন: 017XXXXXXXX বা আইডি"}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className={`w-full px-4 py-3 rounded-2xl border text-sm font-mono transition ${
                  isFreeNoId
                    ? "border-emerald-200 focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20 focus:bg-white"
                    : "border-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white"
                } focus:outline-none placeholder:text-slate-400`}
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                {isFreeNoId
                  ? "💡 কোনো পূর্বানুমতি লাগবে না। এই নম্বরে ফলাফল সংরক্ষিত থাকবে ও স্টুডেন্ট পোর্টাল থেকে দেখা যাবে।"
                  : "💡 আপনার অনুমোদিত আইডি দিলে প্রোফাইলে ও ড্যাশবোর্ডে ফলাফল স্বয়ংক্রিয়ভাবে যুক্ত হবে।"}
              </p>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full font-bold py-3.5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer disabled:opacity-50 active:scale-[0.99] ${
                  isFreeNoId
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25"
                }`}
              >
                {isFreeNoId ? (
                  <>
                    <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                    <span>{isLoading ? "শুরু হচ্ছে..." : "ফ্রি পরীক্ষা শুরু করুন"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    <span>{isLoading ? "যাচাই করা হচ্ছে..." : "যাচাই করে পরীক্ষা শুরু করুন"}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
