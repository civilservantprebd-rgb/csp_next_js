"use client";

import React, { useState, useEffect } from "react";
import { X, Clock, Loader2 } from "lucide-react";
import { Submission } from "@/types/submission";
import { Exam, QuestionItem, QuestionSolution } from "@/types/exam";
import { getExamSolutions } from "@/actions/exam-actions";
import { fetchExamWithQuestions } from "@/actions/admin-actions";
import { isAnswerTimeReached } from "@/lib/bangladesh-time";
import { formatBangladeshClock, toBengaliDigits } from "@/lib/utils";

import { BookmarkButton } from "@/components/shared/BookmarkButton";
import { saveMistakesFromSubmission } from "@/lib/mistake-bookmark-store";

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
  const [examQuestions, setExamQuestions] = useState<QuestionItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);


  useEffect(() => {
    if (isOpen && submission) {
      setIsLoading(true);
      Promise.all([
        fetchExamWithQuestions(submission.examKey),
        getExamSolutions(submission.examKey)
      ])
        .then(([ex, sols]) => {
          setExamQuestions(ex?.questions || null);
          setSolutions(sols);
          setIsLoading(false);
          const qs =
            ex?.questions && ex.questions.length > 0
              ? ex.questions
              : exam?.questions || [];
          if (sols && qs.length > 0 && submission.studentId) {
            saveMistakesFromSubmission(
              submission.studentId,
              submission.examTitle,
              qs,
              sols,
              submission.answers || [],
              ex?.subject || exam?.subject || ""
            );
          }
        })
        .catch((err) => {
          // A rejected solutions fetch must never leave the modal stuck on
          // "সমাধান লোড হচ্ছে..." — stop the spinner and log the failure.
          console.error("Failed to load exam solutions:", err);
          setIsLoading(false);
        });
    }
  }, [isOpen, submission, exam]);

  if (!isOpen || !submission) return null;

  const canShowAnswers = exam ? isAnswerTimeReached(exam) : true;

  // Use the freshly fetched questions; fall back to the prop only if it has real content
  const displayQuestions =
    examQuestions && examQuestions.length > 0
      ? examQuestions
      : exam?.questions?.[0]?.q
        ? exam.questions || []
        : [];

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
          <div className="flex items-center gap-2">

            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>


        <div className="overflow-y-auto flex-grow pr-1 space-y-3">
          {!canShowAnswers ? (
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-3xl border border-amber-200 text-center space-y-3 my-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto shadow-inner">
                <Clock className="w-7 h-7 text-amber-600 animate-pulse" />
              </div>
              <h4 className="font-bold text-amber-950 text-base">ফলাফল ও মার্ক্স এখনও অপ্রকাশিত</h4>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                শিক্ষক কর্তৃক ফলাফল রিলিজ করার পর প্রতিটি প্রশ্নের সঠিক উত্তর, আপনার উত্তর এবং পূর্ণাঙ্গ ব্যাখ্যা দেখতে পাবেন।
              </p>
              {exam?.endTime && (
                <div className="inline-block bg-white border border-amber-200 px-3.5 py-1.5 rounded-xl text-xs text-amber-900 font-medium shadow-sm">
                  ⏰ পরীক্ষা সমাপ্তির সময়:{" "}
                  <strong>{formatBangladeshClock(exam.endTime)}</strong>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> সমাধান লোড হচ্ছে...
            </div>
          ) : displayQuestions.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">এই পরীক্ষার প্রশ্নাবলি আর উপলব্ধ নেই।</p>
          ) : (
            displayQuestions.map((q, qIdx) => {
              const studentAnsIdx = submission.answers?.[qIdx] ?? null;
              const sol = solutions?.[qIdx] || { correct: 0, exp: "" };
              const isCorrect = studentAnsIdx === sol.correct;
              const isSkipped = studentAnsIdx === null;

              const statusBadge = isSkipped ? (
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-bold">
                  স্কিপড
                </span>
              ) : isCorrect ? (
                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded font-bold">
                  সঠিক
                </span>
              ) : (
                <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded font-bold">
                  ভুল
                </span>
              );

              return (
                <div key={qIdx} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-800">
                      {toBengaliDigits(qIdx + 1)}. {q.q}
                    </h4>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <BookmarkButton
                        size="sm"
                        studentId={submission.studentId}
                        question={{
                          q: q.q,
                          opts: q.opts,
                          correct: sol.correct,
                          exp: sol.exp,
                          userAns: studentAnsIdx,
                          examTitle: submission.examTitle,
                          topic: q.topic,
                          subject: exam?.subject || ""
                        }}
                      />
                      {statusBadge}
                    </div>
                  </div>
                  <p className="text-sm sm:text-xs text-slate-600">
                    <strong>আপনার উত্তর:</strong>{" "}
                    {studentAnsIdx !== null && q.opts[studentAnsIdx] ? q.opts[studentAnsIdx] : "দেওয়া হয়নি"}
                  </p>
                  <p className="text-sm sm:text-xs text-emerald-700">
                    <strong>সঠিক উত্তর:</strong> {q.opts[sol.correct] || "—"}
                  </p>
                  {sol.exp && (
                    <p className="text-sm sm:text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100 mt-1">
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
