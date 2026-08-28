"use client";

import React, { useState } from "react";
import { X, UserPlus, CheckCircle2, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import { submitEnrollRequest } from "@/actions/enroll-actions";

interface EnrollModalProps {
  isOpen: boolean;
  courses: string[];
  initialCourse?: string;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export const EnrollModal: React.FC<EnrollModalProps> = ({
  isOpen,
  courses,
  initialCourse,
  onClose,
  onSuccess,
}) => {
  const [course, setCourse] = useState(initialCourse || courses[0] || "সাধারণ কোর্স");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [trxId, setTrxId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  React.useEffect(() => {
    if (initialCourse && courses.includes(initialCourse)) {
      setCourse(initialCourse);
    } else if (courses.length > 0 && !courses.includes(course)) {
      setCourse(courses[0]);
    }
  }, [isOpen, initialCourse, courses]);

  // Reset states when closed
  const handleClose = () => {
    setIsSubmitted(false);
    setErrorMsg("");
    onClose();
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    const res = await submitEnrollRequest({
      course,
      mobile,
      name,
      trxId,
    });

    setIsLoading(false);
    if (res.success) {
      setIsSubmitted(true);
      if (onSuccess) {
        onSuccess(res.message);
      }
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 font-bengali animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative border border-slate-100 flex flex-col">
        {/* Close Button */}
        <button
          onClick={handleClose}
          type="button"
          aria-label="বন্ধ করুন"
          className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {isSubmitted ? (
          /* Beautiful Success Confirmation Card */
          <div className="p-6 sm:p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-9 h-9 animate-bounce" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> রিকোয়েস্ট গৃহীত হয়েছে
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                এনরোলমেন্ট সফলভাবে জমা হয়েছে!
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                শিক্ষক প্যানেল থেকে অনুমোদন দিলে আপনি এই মোবাইল নম্বর দিয়ে <strong>{course}</strong>-এর সকল মডেল টেস্টে অংশ নিতে পারবেন।
              </p>
            </div>

            {/* Submission Summary Details */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">নির্বাচিত কোর্স:</span>
                <span className="font-bold text-indigo-700">{course}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">শিক্ষার্থীর নাম:</span>
                <span className="font-semibold text-slate-800">{name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">মোবাইল (স্টুডেন্ট আইডি):</span>
                <span className="font-mono font-bold text-slate-800">{mobile}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">ট্রান্সেকশন আইডি:</span>
                <span className="font-mono font-bold text-emerald-700">{trxId}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-emerald-600/25 transition text-xs sm:text-sm cursor-pointer"
              >
                ঠিক আছে, ধন্যবাদ
              </button>
            </div>
          </div>
        ) : (
          /* Enrollment Form View */
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-5 sm:p-6 text-white relative">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 bg-indigo-500/50 border border-white/20 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> কোর্স এডমিশন
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-300" /> কোর্স এনরোলমেন্ট ফরম
              </h2>
              <p className="text-xs text-indigo-200 mt-1">
                পেমেন্ট সম্পন্ন করে নিচের তথ্য দিয়ে সাবমিট করুন
              </p>
            </div>

            {/* Form */}
            <div className="p-5 sm:p-6 space-y-4 bg-white">
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-medium">
                  ⚠️ {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    কোর্স নির্বাচন করুন
                  </label>
                  <select
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-slate-50/50 hover:bg-white focus:bg-white transition cursor-pointer"
                  >
                    {courses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    আপনার পূর্ণ নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: আব্দুর রহিম"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-slate-50/50 hover:bg-white focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    মোবাইল নম্বর (স্টুডেন্ট আইডি হিসেবে ব্যবহৃত হবে) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="যেমন: 017XXXXXXXX"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-mono bg-slate-50/50 hover:bg-white focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    বিকাশ/নগদ ট্রান্সেকশন আইডি (TrxID) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: 9H8G7F6E"
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-mono uppercase bg-slate-50/50 hover:bg-white focus:bg-white transition"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition text-xs sm:text-sm shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                  >
                    <span>{isLoading ? "জমা হচ্ছে..." : "রিকোয়েস্ট সাবমিট করুন"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
