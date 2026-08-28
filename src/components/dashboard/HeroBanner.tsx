"use client";

import React from "react";
import { GraduationCap } from "lucide-react";

export const HeroBanner: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-6 sm:p-9 text-white shadow-xl relative overflow-hidden border border-indigo-700/50 font-bengali">
      {/* Decorative background blurs */}
      <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-amber-400/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-6 top-6 opacity-10 hidden md:block pointer-events-none">
        <GraduationCap className="w-52 h-52 text-white" />
      </div>

      <div className="relative z-10 max-w-2xl space-y-3">
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-indigo-100 backdrop-blur-md shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>BCS & Job Preparation Portal 2026</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black leading-tight text-white">
          আপনার বিসিএস ও চাকরির প্রস্তুতিকে করুন{" "}
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
            সহজ, পরিকল্পিত ও নিখুঁত
          </span>
        </h2>

        <p className="text-indigo-100/90 text-xs sm:text-base leading-relaxed">
          কোর্স অনুযায়ী বিষয়ভিত্তিক মডেল টেস্ট দিন, রিয়েল-টাইম মেধা তালিকায় নিজের অবস্থান জানুন এবং
          প্রতিটি প্রশ্নের সঠিক ব্যাখ্যা সহ সর্বোচ্চ প্রস্তুতি নিশ্চিত করুন।
        </p>
      </div>
    </div>
  );
};
