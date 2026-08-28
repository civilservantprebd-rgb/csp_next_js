"use client";

import React, { useState, useEffect } from "react";
import { X, Clock, Loader2 } from "lucide-react";
import { Submission } from "@/types/submission";
import { Exam, QuestionSolution } from "@/types/exam";
import { getExamSolutions, isAnswerTimeReached } from "@/actions/exam-actions";
import { toBengaliDigits } from "@/lib/utils";

interface ExamDetailPopupProps {
  isOpen: boolean;
  submission: Submission | null;
  exam: Exam | null;
  onClose: () => void;
}

export const ExamDetailPopup: React.FC<ExamDetailPopupProps> = ({
  isOpen,
  submission,
  exam,
  onClose,
}) => {
  const [solutions, setSolutions] = useState<QuestionSolution[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && submission) {
      setIsLoading(true);
      getExamSolutions(submission.examKey).then((data) => {
        setSolutions(data);
        setIsLoading(false);
      });
    }
  }, [isOpen, submission]);

  if (!isOpen || !submission) return null;

  const canShowAnswers = exam ? isAnswerTimeReached(exam) : true;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-3 sm:p-4 font-bengali">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col relative">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">{submission.examTitle}</h3>
            <p className="text-xs text-slate-500">
              {canShowAnswers
                ? `স্কোর: ${toBengaliDigits(submission.score)} | সঠিক: ${toBengaliDigits(
                    submission.correct
                  )} | ভুল: ${toBengaliDigits(submission.incorrect)}`
                : "স্কোর ও উত্তর গোপন"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow pr-1 space-y-3">
          {!canShowAnswers ? (
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-center space-y-2 my-4">
              <Clock className="w-10 h-10 text-amber-600 mx-auto mb-1" />
              <h4 className="font-bold text-amber-900 text-sm">উত্তর ও মার্ক্স প্রকাশের সময় হয়নি</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                নির্ধারিত প্রকাশের তারিখ ও সময় অতিক্রান্ত হওয়ার পর এখানে পূর্ণ সমাধান দেখা যাবে।
              </p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> সমাধান লোড হচ্ছে...
            </div>
          ) : !exam?.questions || exam.questions.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">এই পরীক্ষার প্রশ্নাবলি আর উপলব্ধ নেই।</p>
          ) : (
            exam.questions.map((q, qIdx) => {
              const studentAnsIdx = submission.answers?.[qIdx] ?? null;
              const sol = solutions?.[qIdx] || { correct: 0, exp: "" };
              const isCorrect = studentAnsIdx === sol.correct;
              const isSkipped = studentAnsIdx === null;

              const statusBadge = isSkipped ? (
                <span className="bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded font-bold">
                  স্কিপড
                </span>
              ) : isCorrect ? (
                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded font-bold">
                  সঠিক
                </span>
              ) : (
                <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded font-bold">
                  ভুল
                </span>
              );

              return (
                <div key={qIdx} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                      {toBengaliDigits(qIdx + 1)}. {q.q}
                    </h4>
                    {statusBadge}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600">
                    <strong>আপনার উত্তর:</strong>{" "}
                    {studentAnsIdx !== null && q.opts[studentAnsIdx] ? q.opts[studentAnsIdx] : "দেওয়া হয়নি"}
                  </p>
                  <p className="text-[11px] sm:text-xs text-emerald-700">
                    <strong>সঠিক উত্তর:</strong> {q.opts[sol.correct] || "—"}
                  </p>
                  {sol.exp && (
                    <p className="text-[11px] sm:text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100 mt-1">
                      <strong>ব্যাখ্যা:</strong> {sol.exp}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 mt-3 text-right">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
