"use client";

import React, { useState } from "react";
import { UserCheck, Bolt, ArrowRight, X } from "lucide-react";
import { verifyStudentAccess } from "@/actions/student-actions";
import { Exam } from "@/types/exam";

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
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (exam.isFree) {
      onVerified({
        name: name.trim() || "ফ্রি পরীক্ষার্থী",
        id: studentId.trim() || "FREE_USER",
      });
      return;
    }

    setIsLoading(true);
    const res = await verifyStudentAccess(studentId, exam.course);
    setIsLoading(false);

    if (res.allowed) {
      onVerified({
        name: name.trim() || res.studentName || "পরীক্ষার্থী",
        id: res.normalizedId || studentId.trim(),
      });
    } else {
      setErrorMsg(res.message || "অনুমতি নেই।");
    }
  };

  const handleFreeExamDirect = () => {
    const phone = prompt("ফ্রি পরীক্ষা শুরু করতে আপনার মোবাইল নাম্বারটি দিন:");
    if (phone === null) return;
    if (!phone.trim()) {
      alert("দয়া করে একটি সচল ফোন নাম্বার প্রদান করুন।");
      return;
    }
    onVerified({
      name: name.trim() || "ফ্রি পরীক্ষার্থী",
      id: phone.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 font-bengali">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="bg-indigo-50 text-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl shadow-inner">
            <UserCheck className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{exam.title}</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {exam.isFree
              ? "পরীক্ষায় অংশ নিতে আপনার নাম ও ফোন/আইডি দিন (ফ্রি পরীক্ষা)"
              : "পরীক্ষায় অংশ নিতে আপনার অনুমোদিত স্টুডেন্ট আইডি/মোবাইল দিন"}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleStartExam} className="space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              আপনার পূর্ণ নাম <span className="text-slate-400 text-xs font-normal">(ঐচ্ছিক)</span>
            </label>
            <input
              type="text"
              placeholder="যেমন: আব্দুর রহিম (ঐচ্ছিক)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              স্টুডেন্ট আইডি / মোবাইল {!exam.isFree && <span className="text-indigo-600">*</span>}
            </label>
            <input
              type="text"
              required={!exam.isFree}
              placeholder="যেমন: 01700000000 বা রোল"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm font-mono"
            />
            {!exam.isFree && (
              <p className="text-[11px] text-slate-400 mt-1">লগইনের জন্য অনুমোদিত স্টুডেন্ট আইডি প্রদান বাধ্যতামূলক।</p>
            )}
          </div>

          {exam.isFree && (
            <button
              type="button"
              onClick={handleFreeExamDirect}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <Bolt className="w-4 h-4" /> ফ্রী পরীক্ষা দিন
            </button>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
          >
            <ArrowRight className="w-4 h-4" /> {isLoading ? "যাচাই করা হচ্ছে..." : "পরীক্ষা শুরু করুন"}
          </button>
        </form>
      </div>
    </div>
  );
};
