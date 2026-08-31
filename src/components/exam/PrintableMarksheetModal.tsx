"use client";

import React, { useRef } from "react";
import {
  X,
  Printer,
  Award,
  CheckCircle2,
  XCircle,
  MinusCircle,
  BookOpen,
  Calendar,
  User,
  ShieldCheck,
  Sparkles,
  Download
} from "lucide-react";
import { QuestionItem, QuestionSolution } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";

interface PrintableMarksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  examTitle: string;
  courseName?: string;
  subjectName?: string;
  studentName: string;
  studentId: string;
  totalQuestions: number;
  score: number;
  correct: number;
  incorrect: number;
  timeSpent?: string;
  submittedAt?: string;
  questions?: QuestionItem[];
  solutions?: QuestionSolution[];
  studentAnswers?: (number | null)[];
}

export const PrintableMarksheetModal: React.FC<PrintableMarksheetModalProps> = ({
  isOpen,
  onClose,
  examTitle,
  courseName = "বিসিএস প্রিলিমিনারি",
  subjectName = "সাধারণ জ্ঞান",
  studentName,
  studentId,
  totalQuestions,
  score,
  correct,
  incorrect,
  timeSpent = "১০ মিনিট",
  submittedAt,
  questions = [],
  solutions = [],
  studentAnswers = [],
}) => {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const unanswered = Math.max(0, totalQuestions - (correct + incorrect));
  const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
  const optLabels = ["ক", "খ", "গ", "ঘ"];
  const reportDate = submittedAt ? new Date(submittedAt).toLocaleDateString("bn-BD") : new Date().toLocaleDateString("bn-BD");
  const reportId = `BCS-${studentId.slice(-4)}-${Date.now().toString().slice(-6)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs font-bengali print:static print:p-0 print:bg-white print:block print:inset-auto">
      {/* Container */}
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:rounded-none print:max-h-none print:overflow-visible print:block">
        
        {/* Action Header - Hidden on Print */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                অফিসিয়াল রেজাল্ট মার্কশিট ও ওএমআর রিপোর্ট
              </h3>
              <p className="text-xs text-slate-500">প্রিন্ট বা PDF হিসেবে সংরক্ষণ করার জন্য প্রস্তুত</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট / PDF ডাউনলোড</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Sheet Area */}
        <div className="overflow-y-auto flex-grow p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          <div
            id="printable-marksheet"
            ref={printContentRef}
            className="bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 max-w-3xl mx-auto space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none text-slate-900"
          >
            {/* Sheet Institutional Header */}
            <div className="border-b-2 border-slate-900 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-base shadow-xs">
                    আ
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      আরোহণ — সিভিল সার্ভিস একাডেমি
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">বিসিএস ও সরকারি চাকরি প্রস্তুতি পোর্টাল</p>
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-slate-600 space-y-0.5">
                <span className="inline-block bg-slate-100 text-slate-800 font-bold px-2.5 py-1 rounded-md border border-slate-200">
                  অফিসিয়াল মার্কশিট
                </span>
                <p className="text-[11px] text-slate-500 pt-1 font-mono">রিপোর্ট আইডি: {reportId}</p>
                <p className="text-[11px] text-slate-500">তারিখ: {reportDate}</p>
              </div>
            </div>

            {/* Exam & Candidate Info Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="space-y-1.5">
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-900">শিক্ষার্থীর নাম:</span> {studentName}
                </p>
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-900">স্টুডেন্ট আইডি/মোবাইল:</span> <span className="font-mono">{studentId}</span>
                </p>
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-900">কোর্স:</span> {courseName}
                </p>
              </div>

              <div className="space-y-1.5 sm:text-right">
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-900">পরীক্ষার শিরোনাম:</span> {examTitle}
                </p>
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-900">বিষয়:</span> {subjectName}
                </p>
                <p className="text-slate-600">
                  <span className="font-semibold text-slate-900">ব্যয়িত সময়:</span> {timeSpent}
                </p>
              </div>
            </div>

            {/* Result Metrics Grid */}
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                ফলাফল ও পারফরম্যান্স সারসংক্ষেপ:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">মোট প্রশ্ন</span>
                  <span className="text-lg font-bold text-slate-900">{toBengaliDigits(totalQuestions)}</span>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 block">সঠিক (+১)</span>
                  <span className="text-lg font-bold text-emerald-800">{toBengaliDigits(correct)}</span>
                </div>

                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-[10px] text-rose-700 block">ভুল (-০.৫)</span>
                  <span className="text-lg font-bold text-rose-800">{toBengaliDigits(incorrect)}</span>
                </div>

                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <span className="text-[10px] text-indigo-700 block">চূড়ান্ত প্রাপ্ত স্কোর</span>
                  <span className="text-xl font-black text-indigo-900">{toBengaliDigits(score)}</span>
                </div>
              </div>
            </div>

            {/* OMR Response Grid Matrix */}
            {questions && questions.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  ওএমআর রেসপন্স ম্যাট্রিক্স (OMR Question Analysis):
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {questions.map((_, qIdx) => {
                    const studentAnsIdx = studentAnswers[qIdx] ?? null;
                    const sol = solutions[qIdx] || { correct: 0, exp: "" };
                    const isAnswered = studentAnsIdx !== null;
                    const isCorrect = isAnswered && studentAnsIdx === sol.correct;

                    return (
                      <div
                        key={qIdx}
                        className={`p-2 rounded-lg border flex items-center justify-between ${
                          !isAnswered
                            ? "bg-slate-50 border-slate-200 text-slate-600"
                            : isCorrect
                            ? "bg-emerald-50/60 border-emerald-200 text-emerald-950 font-medium"
                            : "bg-rose-50/60 border-rose-200 text-rose-950 font-medium"
                        }`}
                      >
                        <span className="font-bold text-slate-800">
                          {toBengaliDigits(qIdx + 1)}.
                        </span>

                        <div className="flex items-center gap-2">
                          <span>
                            আপনার:{" "}
                            <strong>
                              {isAnswered ? optLabels[studentAnsIdx] : "—"}
                            </strong>
                          </span>
                          <span className="text-slate-400">|</span>
                          <span>
                            সঠিক:{" "}
                            <strong className="text-emerald-700">
                              {optLabels[sol.correct]}
                            </strong>
                          </span>
                        </div>

                        <div>
                          {!isAnswered ? (
                            <span className="text-slate-400 font-bold text-[10px]">ফাঁকা</span>
                          ) : isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detailed Question Analysis — question, student answer, correct answer, explanation */}
            {questions && questions.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  প্রশ্ন ও উত্তর বিশ্লেষণ (প্রতিটি প্রশ্নের বিস্তারিত):
                </h4>

                {questions.map((q, qIdx) => {
                  const studentAnsIdx = studentAnswers[qIdx] ?? null;
                  const sol = solutions[qIdx] || { correct: 0, exp: "" };
                  const isAnswered = studentAnsIdx !== null;
                  const isCorrect = isAnswered && studentAnsIdx === sol.correct;

                  return (
                    <div
                      key={qIdx}
                      className={`p-4 rounded-xl border ${
                        isCorrect
                          ? "border-emerald-200 bg-emerald-50/30"
                          : isAnswered
                          ? "border-rose-200 bg-rose-50/30"
                          : "border-slate-200 bg-slate-50/40"
                      }`}
                    >
                      {/* Question */}
                      <p className="font-bold text-slate-900 text-sm leading-relaxed">
                        {toBengaliDigits(qIdx + 1)}. {q.q}
                      </p>

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 text-xs">
                        {q.opts.map((opt, oIdx) => {
                          const isStudent = oIdx === studentAnsIdx;
                          const isAns = oIdx === sol.correct;
                          return (
                            <div
                              key={oIdx}
                              className={`p-2 rounded-lg border flex items-center gap-2 ${
                                isAns
                                  ? "border-emerald-300 bg-emerald-100/60 font-bold text-emerald-950"
                                  : isStudent
                                  ? "border-rose-300 bg-rose-100/60 font-bold text-rose-950"
                                  : "border-slate-200 bg-white text-slate-700"
                              }`}
                            >
                              <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 bg-slate-800 text-white">
                                {optLabels[oIdx]}
                              </span>
                              <span className="truncate">{opt}</span>
                              {isAns && (
                                <span className="ml-auto text-[9px] font-bold text-emerald-700 shrink-0">✓ সঠিক</span>
                              )}
                              {isStudent && !isAns && (
                                <span className="ml-auto text-[9px] font-bold text-rose-700 shrink-0">আপনার</span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Answer summary */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold ${
                            !isAnswered
                              ? "bg-slate-100 text-slate-600"
                              : isCorrect
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {!isAnswered ? "স্কিপ করা হয়েছে" : isCorrect ? "✓ সঠিক উত্তর" : "✗ ভুল উত্তর"}
                        </span>
                        {isAnswered && (
                          <span className="text-slate-600">
                            আপনার উত্তর:{" "}
                            <strong>
                              {optLabels[studentAnsIdx!]} ({q.opts[studentAnsIdx!] || "—"})
                            </strong>
                          </span>
                        )}
                        <span className="text-emerald-700">
                          সঠিক উত্তর:{" "}
                          <strong>
                            {optLabels[sol.correct]} ({q.opts[sol.correct] || "—"})
                          </strong>
                        </span>
                      </div>

                      {/* Explanation */}
                      {sol.exp && (
                        <div className="mt-2 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-slate-700 leading-relaxed">
                          <strong className="text-amber-900 block mb-0.5">ব্যাখ্যা:</strong>
                          {sol.exp}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Institutional Certification Footer */}
            <div className="border-t border-slate-200 pt-5 text-center space-y-1 text-xs text-slate-400">
              <p className="font-semibold text-slate-600">
                এই মূল্যায়ন প্রতিবেদনটি আরোহণ ক্লাউড পোর্টাল দ্বারা স্বয়ংক্রিয়ভাবে প্রস্তুতকৃত।
              </p>
              <p className="text-[10px] text-slate-400">
                কপিরাইট © {new Date().getFullYear()} আরোহণ. সর্বস্বত্ব সংরক্ষিত।
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
