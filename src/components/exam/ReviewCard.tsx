"use client";

import React from "react";
import { QuestionItem, QuestionSolution } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";
import { BookmarkButton } from "@/components/shared/BookmarkButton";

interface ReviewCardProps {
  questions: QuestionItem[];
  solutions: QuestionSolution[];
  studentAnswers: (number | null)[];
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  questions,
  solutions,
  studentAnswers,
}) => {
  return (
    <div className="space-y-4 font-bengali">
      {questions.map((q, idx) => {
        const ans = studentAnswers[idx];
        const sol = solutions[idx] || { correct: 0, exp: "" };
        const isCorrect = ans === sol.correct;
        const isSkipped = ans === null;

        const badgeClass = isSkipped
          ? "bg-slate-200 text-slate-700"
          : isCorrect
          ? "bg-emerald-100 text-emerald-800"
          : "bg-rose-100 text-rose-800";

        const badgeText = isSkipped ? "স্কিপড" : isCorrect ? "সঠিক" : "ভুল";

        return (
          <div
            key={idx}
            className="p-5 sm:p-6 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-sm"
          >
            <div className="flex justify-between items-start gap-3 flex-wrap sm:flex-nowrap">
              <div className="space-y-1 flex-grow">
                <h4 className="font-bold text-base sm:text-lg text-slate-900 leading-relaxed">
                  {toBengaliDigits(idx + 1)}. {q.q}
                </h4>
                {q.topic && (
                  <span className="inline-block text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-md border border-indigo-100">
                    টপিক: {q.topic}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <BookmarkButton
                  size="sm"
                  question={{
                    q: q.q,
                    opts: q.opts,
                    correct: sol.correct,
                    exp: sol.exp,
                    userAns: ans,
                    topic: q.topic
                  }}
                />
                <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase shrink-0 ${badgeClass}`}>
                  {badgeText}
                </span>
              </div>
            </div>

            <div className="space-y-2 p-4 bg-slate-50 rounded-2xl">
              <p className="text-lg sm:text-xl text-slate-700">
                <strong>আপনার উত্তর:</strong>{" "}
                <span className={ans !== sol.correct ? "text-rose-600 font-bold" : ""}>
                  {ans !== null && q.opts[ans] ? q.opts[ans] : "দেওয়া হয়নি"}
                </span>
              </p>
              <p className="text-lg sm:text-xl text-emerald-700 font-bold">
                <strong>সঠিক উত্তর:</strong> {q.opts[sol.correct] || "—"}
              </p>
            </div>

            {sol.exp && (
              <div className="text-lg sm:text-xl text-slate-600 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 leading-relaxed">
                <strong className="text-indigo-800 block mb-1">ব্যাখ্যা:</strong> {sol.exp}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
