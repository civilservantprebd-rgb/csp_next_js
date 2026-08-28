"use client";

import React from "react";
import { LeaderboardItem } from "@/types/submission";
import { Trophy, Printer } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

interface LeaderboardTableProps {
  title: string;
  items: LeaderboardItem[];
  isLoading?: boolean;
  isLocked?: boolean;
  releaseDateText?: string;
  onPrint?: () => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  title,
  items,
  isLoading = false,
  isLocked = false,
  releaseDateText = "নির্ধারিত সময়ে",
  onPrint,
}) => {
  if (isLocked) {
    return (
      <div className="p-8 text-center bg-amber-50/60 rounded-2xl border border-amber-200 font-bengali">
        <div className="max-w-md mx-auto space-y-2">
          <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-1" />
          <h4 className="font-bold text-slate-800 text-sm sm:text-base">লিডারবোর্ড সাময়িকভাবে বন্ধ আছে</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            লাইভ পরীক্ষা চলমান থাকায় মেধা তালিকা গোপন রাখা হয়েছে। ফলাফল প্রকাশের নির্ধারিত সময়ে (
            <strong>{releaseDateText}</strong>) পূর্ণাঙ্গ লিডারবোর্ড উন্মুক্ত করা হবে।
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-bengali">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <h3 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> {title}
          </h3>
          <p className="text-xs text-slate-500">সর্বোচ্চ স্কোর এবং কম সময়ে পরীক্ষার্থীদের র‍্যাংকিং</p>
        </div>
        {onPrint && (
          <button
            onClick={onPrint}
            className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-4 py-2 rounded-xl text-xs sm:text-sm transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" /> প্রিন্ট করুন
          </button>
        )}
      </div>

      <div id="printable-leaderboard" className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-xs">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <th className="p-3 font-semibold w-12 text-center">#</th>
              <th className="p-3 font-semibold">শিক্ষার্থীর নাম</th>
              <th className="p-3 font-semibold text-center">স্ট্যাটাস</th>
              <th className="p-3 font-semibold text-center">সময়</th>
              <th className="p-3 font-semibold text-right">স্কোর</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  ডেটা লোড হচ্ছে...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  এই পরীক্ষায় এখনো কেউ অংশগ্রহণ করেনি।
                </td>
              </tr>
            ) : (
              items.map((sub, idx) => {
                let rankBadge: React.ReactNode = toBengaliDigits(idx + 1);
                if (idx === 0) {
                  rankBadge = (
                    <span className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full text-xs">
                      ১
                    </span>
                  );
                } else if (idx === 1) {
                  rankBadge = (
                    <span className="bg-slate-300 text-slate-900 font-bold px-2 py-0.5 rounded-full text-xs">
                      ২
                    </span>
                  );
                } else if (idx === 2) {
                  rankBadge = (
                    <span className="bg-amber-600 text-white font-bold px-2 py-0.5 rounded-full text-xs">
                      ৩
                    </span>
                  );
                }

                return (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="p-3 text-center font-bold text-slate-700">{rankBadge}</td>
                    <td className="p-3 font-semibold text-slate-800">{sub.studentName}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          sub.isPassed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {sub.isPassed ? "পাস" : "ফেইল"}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-500 font-mono text-xs">{sub.timeSpent}</td>
                    <td className="p-3 text-right font-black text-indigo-700">{toBengaliDigits(sub.score)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
