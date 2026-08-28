"use client";

import React from "react";
import { QuestionItem } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";

interface QuestionListProps {
  questions: QuestionItem[];
  studentAnswers: (number | null)[];
  onSelectOption: (questionIndex: number, optionIndex: number) => void;
}

export const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  studentAnswers,
  onSelectOption,
}) => {
  const bengaliOptionLetters = ["ক", "খ", "গ", "ঘ"];

  return (
    <div className="space-y-6 font-bengali">
      {questions.map((q, qIdx) => {
        const hasAnswered = studentAnswers[qIdx] !== null;

        return (
          <div
            key={qIdx}
            className="bg-slate-50 p-6 sm:p-8 rounded-3xl border-2 border-slate-200 space-y-6 shadow-sm"
          >
            <h3 className="font-bold text-slate-900 text-2xl sm:text-3xl leading-snug">
              <span className="text-indigo-600 mr-2">{toBengaliDigits(qIdx + 1)}.</span>
              {q.q}
            </h3>

            <div className="grid grid-cols-1 gap-4">
              {q.opts.map((opt, optIndex) => {
                const isSelected = studentAnswers[qIdx] === optIndex;
                const isOtherLocked = hasAnswered && !isSelected;

                return (
                  <button
                    key={optIndex}
                    onClick={() => onSelectOption(qIdx, optIndex)}
                    disabled={isOtherLocked}
                    className={`p-5 sm:p-6 rounded-2xl text-left border-2 transition flex items-center space-x-4 cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-lg"
                        : "bg-white text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                    } ${isOtherLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg shrink-0 ${
                        isSelected
                          ? "bg-indigo-600 text-white border-white"
                          : "border-slate-300 text-slate-500"
                      }`}
                    >
                      {bengaliOptionLetters[optIndex] || optIndex + 1}
                    </span>
                    <span className="text-xl sm:text-2xl font-semibold">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
