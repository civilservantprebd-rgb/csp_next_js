"use client";

import React, { useEffect, useState } from "react";
import {
  GraduationCap,
  LogIn,
  Lock,
  Sparkles,
  CheckCircle2,
  Check,
  Crown,
  Layers
} from "lucide-react";
import { Exam, SubjectItem } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";
import { getCoursePrices } from "@/actions/course-actions";

interface LandingPageProps {
  /** চলমান কোর্স — লগইন বাটনের নিচে, প্যাকেজ-স্টাইল কার্ডে */
  courses?: string[];
  subjects?: SubjectItem[];
  exams?: Record<string, Exam>;
  pinnedCourses?: string[];
  /** লগইন চালু করে (Google OAuth) */
  onLogin: () => void;
}

type CoursePriceInfo = {
  price?: number;
  offerPrice?: number;
  plannedExams?: number;
  plannedVideos?: number;
};

/**
 * লগইন-গেট ল্যান্ডিং পেজ। লগইন বাটনের ঠিক নিচে "…সব কোর্স এক নজরে" সেকশন —
 * Live MCQ™-এর "সব প্যাকেজ এক নজরে" সেকশনের মতো: নাম, বর্ণনা, দাম/ছাড়,
 * ✅ ফিচার বুলেট ও "এনরোল করতে লগইন করুন" বাটনসহ কার্ড।
 */
export const LandingPage: React.FC<LandingPageProps> = ({
  courses = [],
  subjects = [],
  exams = {},
  pinnedCourses = [],
  onLogin
}) => {
  const [prices, setPrices] = useState<Record<string, CoursePriceInfo>>({});

  useEffect(() => {
    getCoursePrices()
      .then(setPrices)
      .catch(() => {
        // দাম না এলে "দাম শীঘ্রই" লেখাই দেখাবে
      });
  }, []);

  const fmtTaka = (n: number) => `৳${toBengaliDigits(n.toLocaleString("en-IN"))}`;

  // পিন করা (জনপ্রিয়) কোর্স আগে
  const sortedCourses = [...courses].sort((a, b) => {
    const pa = pinnedCourses.includes(a) ? 0 : 1;
    const pb = pinnedCourses.includes(b) ? 0 : 1;
    return pa - pb;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 text-white font-bengali flex flex-col relative overflow-hidden">
      {/* ডেকোরেশন */}
      <div className="pointer-events-none absolute -top-28 -right-24 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-28 w-[28rem] h-[28rem] rounded-full bg-indigo-400/15 blur-3xl" />

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 flex flex-col flex-grow">
        {/* উপরে ব্র্যান্ড + দ্রুত লগইন */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-gradient-to-tr from-amber-400 to-indigo-500 p-1.5 rounded-xl shadow-lg shadow-black/25">
              <GraduationCap className="w-5 h-5 text-slate-900" />
            </span>
            <span className="text-lg sm:text-xl font-black tracking-wide">আরোহণ</span>
          </div>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" /> লগইন
          </button>
        </header>

        <main className="flex-grow py-8 sm:py-12">
          {/* হিরো + লগইন CTA */}
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-bold text-indigo-100 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" /> BCS ও সরকারি চাকরির প্রস্তুতি পোর্টাল
            </span>

            <h1 className="mt-5 text-3xl sm:text-5xl font-black leading-tight">
              আপনার প্রস্তুতি শুরু হোক{" "}
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                এক লগইনে
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-indigo-100/90 leading-relaxed font-medium">
              পরীক্ষা দেওয়া, ফলাফল দেখা, মেধা তালিকায় র‍্যাংকিং ও কোর্স ভিডিও —
              সবকিছুর জন্য <b className="text-white">লগইন প্রয়োজন</b>। গুগল
              অ্যাকাউন্ট দিয়ে ঢুকলেই সব খুলে যাবে।
            </p>

            {/* প্রধান CTA */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm sm:text-base px-8 sm:px-10 py-3.5 rounded-2xl shadow-xl shadow-amber-500/25 transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <LogIn className="w-5 h-5" /> Google দিয়ে লগইন করুন
              </button>
              <p className="text-[11px] sm:text-xs text-indigo-200/80 font-semibold flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-amber-300" />
                নতুন ব্যবহারকারী? গুগল অ্যাকাউন্টই যথেষ্ট — আলাদা রেজিস্ট্রেশন নেই
              </p>
            </div>
          </div>

          {/* কোর্স — "সব কোর্স এক নজরে" (Live MCQ-এর প্যাকেজ সেকশনের মতো) */}
          {sortedCourses.length > 0 && (
            <section className="mt-16">
              <div className="text-center max-w-2xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-amber-200 text-[11px] font-black">
                  <Layers className="w-3.5 h-3.5 text-amber-300" /> চলমান কোর্স
                </span>
                <h2 className="mt-3 text-2xl sm:text-3xl font-black">
                  আরোহণের সব চলমান কোর্স এক নজরে
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-indigo-200/85 font-semibold">
                  আপনার লক্ষ্য অনুযায়ী সঠিক কোর্স বেছে নিন — লগইন করে এনরোল করুন
                </p>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-5 max-w-6xl mx-auto">
                {sortedCourses.map((courseName) => {
                  const p = prices[courseName];
                  const isPopular = pinnedCourses.includes(courseName);
                  const subjectCount = subjects.filter((s) => s.course === courseName).length;
                  const examCount = Object.values(exams).filter((ex) => ex.course === courseName).length;
                  const videoCount = p?.plannedVideos;
                  const plannedExams = p?.plannedExams;
                  const isFreeCourse = p && (p.price === 0 || p.offerPrice === 0);
                  const hasOffer =
                    p?.offerPrice !== undefined && p.offerPrice > 0 && p.price && p.offerPrice < p.price;

                  const bullets: string[] = [];
                  const nExams = plannedExams ?? examCount;
                  if (nExams > 0) bullets.push(`${toBengaliDigits(nExams)}টি পরীক্ষা ও মডেল টেস্ট`);
                  else bullets.push("সকল পরীক্ষা ও মডেল টেস্ট");
                  if (videoCount !== undefined && videoCount > 0) bullets.push(`${toBengaliDigits(videoCount)}টি ভিডিও ক্লাস`);
                  else bullets.push("কোর্স ভিডিও ক্লাস");
                  if (subjectCount > 0) bullets.push(`${toBengaliDigits(subjectCount)}টি বিষয়ের কনটেন্ট`);
                  else bullets.push("বিষয়ভিত্তিক কনটেন্ট ও নোটিশ");
                  bullets.push("WhatsApp কমিউনিটি এক্সেস");

                  return (
                    <div
                      key={courseName}
                      className={`relative bg-white text-slate-900 w-full sm:w-[350px] rounded-3xl overflow-hidden flex flex-col shadow-xl shadow-black/25 transition hover:-translate-y-1 hover:shadow-2xl ${
                        isPopular ? "ring-2 ring-amber-400" : "ring-1 ring-white/40"
                      }`}
                    >
                      {/* জনপ্রিয় ব্যাজ */}
                      {isPopular && (
                        <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-[10px] font-black px-2.5 py-1 rounded-full shadow-md shadow-amber-500/30">
                          <Crown className="w-3 h-3" /> সর্বাধিক জনপ্রিয়
                        </span>
                      )}

                      {/* কভার */}
                      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 p-5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shrink-0 shadow-md shadow-black/20">
                            <span className="w-full h-full bg-slate-900/90 rounded-[14px] flex items-center justify-center">
                              <GraduationCap className="w-5 h-5 text-amber-300" />
                            </span>
                          </span>
                          <span className="text-[10px] font-black tracking-widest text-indigo-200/90">
                            কোর্স
                          </span>
                        </div>
                        <h3 className="mt-3 font-black text-base leading-snug text-white line-clamp-2 min-h-[2.7em] pr-14">
                          {courseName}
                        </h3>
                      </div>

                      {/* দেহ */}
                      <div className="p-5 flex flex-col flex-grow gap-3">
                        {/* দাম */}
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                          {isFreeCourse ? (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-black px-3 py-1.5 rounded-xl">
                              <CheckCircle2 className="w-4 h-4" /> সম্পূর্ণ ফ্রি
                            </span>
                          ) : hasOffer ? (
                            <>
                              <span className="text-2xl font-black text-slate-900">{fmtTaka(p.offerPrice!)}</span>
                              <span className="text-sm text-slate-400 line-through font-bold">{fmtTaka(p.price!)}</span>
                              <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                                {toBengaliDigits(Math.round((1 - p.offerPrice! / p.price!) * 100))}% ছাড়
                              </span>
                            </>
                          ) : p?.price ? (
                            <span className="text-2xl font-black text-slate-900">{fmtTaka(p.price)}</span>
                          ) : (
                            <span className="text-sm font-bold text-slate-400">দাম শীঘ্রই প্রকাশ হবে</span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 font-bold">
                          এনরোল্ড অবস্থায় সম্পূর্ণ এক্সেস
                        </p>

                        {/* ফিচার বুলেট */}
                        <ul className="space-y-2 border-t border-slate-100 pt-3">
                          {bullets.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-xs text-slate-700 font-semibold leading-relaxed">
                              <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5" strokeWidth={3} />
                              </span>
                              {b}
                            </li>
                          ))}
                        </ul>

                        <div className="mt-auto pt-2">
                          <button
                            type="button"
                            onClick={onLogin}
                            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm py-3 rounded-2xl shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-[0.98]"
                          >
                            <Lock className="w-4 h-4" /> এনরোল করতে লগইন করুন
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <footer className="text-center text-[10px] text-indigo-300/70 font-semibold pb-1">
          © {new Date().getFullYear()} আরোহণ — দক্ষতা এবং ক্যারিয়ার
        </footer>
      </div>
    </div>
  );
};
