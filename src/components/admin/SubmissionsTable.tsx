"use client";

import React, { useState, useEffect } from "react";
import { Submission } from "@/types/submission";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { clearAllSubmissions } from "@/actions/admin-actions";
import { Trash2, RotateCw } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

export const SubmissionsTable: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSubmissions = async () => {
    setIsLoading(true);
    const q = query(
      collection(db, "submissions"),
      orderBy("timestamp", "desc"),
      limit(200)
    );
    const snap = await getDocs(q);
    const list: Submission[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...(d.data() as Submission) });
    });
    setSubmissions(list);
    setIsLoading(false);
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handleClearAll = async () => {
    if (confirm("আপনি কি নিশ্চিতভাবে সকল পরীক্ষার্থীর ফলাফল মুছে ফেলতে চান?")) {
      await clearAllSubmissions();
      loadSubmissions();
      alert("সকল ফলাফল মুছে ফেলা হয়েছে।");
    }
  };

  return (
    <div className="space-y-4 font-bengali">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
          পরীক্ষার্থীদের জমা দেওয়া ফলাফল তালিকা ({toBengaliDigits(submissions.length)} জন)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={loadSubmissions}
            className="text-xs text-indigo-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCw className="w-3 h-3" /> রিফ্রেশ
          </button>
          <button
            onClick={handleClearAll}
            className="text-[11px] sm:text-xs text-rose-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3 h-3" /> সকল মুছুন
          </button>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200">
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <th className="p-2.5 font-semibold">শিক্ষার্থী</th>
              <th className="p-2.5 font-semibold">পরীক্ষা</th>
              <th className="p-2.5 font-semibold text-center">সময়</th>
              <th className="p-2.5 font-semibold text-right">স্কোর</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-400">
                  ফলাফল লোড হচ্ছে...
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-slate-400">
                  কোনো ফলাফল জমা পড়েনি।
                </td>
              </tr>
            ) : (
              submissions.map((sub, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2.5 font-semibold text-slate-800">
                    {sub.studentName}{" "}
                    <span className="text-slate-400 font-normal text-xs">({sub.studentId || "আইডি নেই"})</span>
                  </td>
                  <td className="p-2.5 text-slate-600">{sub.examTitle}</td>
                  <td className="p-2.5 text-center text-slate-500 font-mono text-xs">{sub.timeSpent || "—"}</td>
                  <td className="p-2.5 text-right font-black text-indigo-700">
                    {toBengaliDigits(sub.score ?? 0)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
