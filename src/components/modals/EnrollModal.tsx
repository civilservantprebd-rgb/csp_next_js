"use client";

import React, { useState, useEffect } from "react";
import { X, UserPlus, CheckCircle2, ShieldCheck, ArrowRight, Sparkles, LogIn } from "lucide-react";
import { submitEnrollRequest } from "@/actions/enroll-actions";
import { getLocalStudentUser, loginWithGoogle, StudentUser } from "@/lib/student-auth";

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
  const [selectedCourses, setSelectedCourses] = useState<string[]>(
    initialCourse ? [initialCourse] : courses[0] ? [courses[0]] : ["সাধারণ কোর্স"]
  );
  const [studentUser, setStudentUser] = useState<StudentUser | null>(null);
  const [name, setName] = useState("");
  const [trxId, setTrxId] = useState("");
  const [coupon, setCoupon] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const user = getLocalStudentUser();
      setStudentUser(user);
      if (user) {
        setName(user.name);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialCourse && courses.includes(initialCourse)) {
      setSelectedCourses((prev) => Array.from(new Set([...prev, initialCourse])));
    } else if (courses.length > 0 && selectedCourses.length === 0) {
      setSelectedCourses([courses[0]]);
    }
  }, [isOpen, initialCourse, courses]);

  // Reset states when closed
  const handleClose = () => {
    setIsSubmitted(false);
    setErrorMsg("");
    onClose();
  };

  const handleToggleCourse = (cName: string) => {
    setSelectedCourses((prev) =>
      prev.includes(cName)
        ? prev.filter((item) => item !== cName)
        : [...prev, cName]
    );
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    const user = await loginWithGoogle();
    if (user) {
      setStudentUser(user);
      setName(user.name);
    } else {
      setErrorMsg("গুগল লগইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    
    if (!studentUser) {
      setErrorMsg("এনরোল করতে প্রথমে লগইন করুন।");
      return;
    }

    if (selectedCourses.length === 0) {
      setErrorMsg("দয়া করে অন্তত একটি কোর্স নির্বাচন করুন।");
      return;
    }

    setIsLoading(true);

    const res = await submitEnrollRequest({
      uid: studentUser.uid,
      email: studentUser.email,
      course: selectedCourses,
      name,
      trxId,
      coupon,
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm overflow-y-auto font-bengali animate-in fade-in duration-200">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl relative border border-slate-100 flex flex-col my-auto">
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
                শিক্ষক প্যানেল থেকে অনুমোদন দিলে আপনি আপনার এই গুগল অ্যাকাউন্ট দিয়ে লগইন করে <strong>{selectedCourses.join(", ")}</strong>-এর সকল মডেল টেস্টে অংশ নিতে পারবেন।
              </p>
            </div>

            {/* Submission Summary Details */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">নির্বাচিত কোর্স:</span>
                <span className="font-bold text-indigo-700">{selectedCourses.join(", ")}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">শিক্ষার্থীর নাম:</span>
                <span className="font-semibold text-slate-800">{name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">ইমেইল ঠিকানা:</span>
                <span className="font-semibold text-slate-800">{studentUser?.email}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">ট্রান্সেকশন আইডি:</span>
                <span className="font-mono font-bold text-emerald-700">{trxId}</span>
              </div>
              {coupon && (
                <div className="flex justify-between items-center py-1 border-t border-slate-200/60">
                  <span className="text-slate-500">কুপন কোড:</span>
                  <span className="font-mono font-bold text-emerald-700">{coupon}</span>
                </div>
              )}
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
          /* Enrollment / Login View */
          <>
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 p-5 sm:p-6 text-white relative">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 bg-indigo-500/50 border border-white/20 text-white text-sm font-semibold px-2.5 py-0.5 rounded-full">
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

            <div className="p-5 sm:p-6 space-y-4 bg-white">
              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl font-medium">
                  ⚠️ {errorMsg}
                </div>
              )}

              {!studentUser ? (
                /* Google Sign In Requirement View */
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-sm">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800">লগইন প্রয়োজন</h3>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      এনরোলমেন্ট রিকোয়েস্ট সাবমিট করতে প্রথমে আপনার গুগল অ্যাকাউন্ট দিয়ে লগইন করুন।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl border border-slate-200 shadow-sm transition flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
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
                /* Enrollment Form */
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      গুগল অ্যাকাউন্ট
                    </label>
                    <div className="bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs flex items-center justify-between">
                      <span className="text-slate-600 truncate max-w-[200px]">{studentUser.email}</span>
                      <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-md border border-indigo-100">সংযুক্ত</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        কোর্স নির্বাচন করুন (একাধিক সিলেক্ট করা যাবে) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-xs text-indigo-600 font-bold">
                        {selectedCourses.length}টি নির্বাচিত
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50/70 rounded-2xl border border-slate-200">
                      {courses.map((c) => {
                        const isChecked = selectedCourses.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleToggleCourse(c)}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer text-left ${
                              isChecked
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isChecked
                                  ? "bg-white border-white text-indigo-700"
                                  : "border-slate-300 bg-slate-50"
                              }`}
                            >
                              {isChecked && <CheckCircle2 className="w-3.5 h-3.5 fill-indigo-600 text-white" />}
                            </span>
                            <span className="truncate">{c}</span>
                          </button>
                        );
                      })}
                    </div>
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
                    <p className="text-[11px] text-slate-400 mt-1">
                      bKash/Nagad থেকে পাওয়া পুরো TrxID লিখুন — অক্ষর-সংখ্যা যেকোনোটা চলবে
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      কুপন কোড (যদি থাকে)
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: AROHON50"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm font-mono uppercase bg-slate-50/50 hover:bg-white focus:bg-white transition"
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
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};
