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
    <div className="space-y-4 font-bengali">
      {questions.map((q, qIdx) => {
        const hasAnswered = studentAnswers[qIdx] !== null;

        return (
          <div
            key={qIdx}
            className="py-4 space-y-3.5 border-b border-slate-100 last:border-b-0"
          >
            <h3 className="font-bold text-slate-900 text-lg sm:text-xl leading-snug">
              <span className="text-indigo-600 mr-1.5">{toBengaliDigits(qIdx + 1)}.</span>
              {q.q}
            </h3>

            <div className="grid grid-cols-1 gap-2">
              {q.opts.map((opt, optIndex) => {
                const isSelected = studentAnswers[qIdx] === optIndex;
                const isOtherLocked = hasAnswered && !isSelected;

                return (
                  <button
                    key={optIndex}
                    onClick={() => onSelectOption(qIdx, optIndex)}
                    disabled={isOtherLocked}
                    className={`p-2.5 sm:p-3 rounded-xl text-left border transition flex items-center space-x-3 cursor-pointer ${
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs"
                        : "bg-white text-slate-800 border-slate-100 hover:bg-slate-50"
                    } ${isOtherLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <span
                      className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs shrink-0 ${
                        isSelected
                          ? "bg-indigo-600 text-white border-white"
                          : "border-slate-200 text-slate-500"
                      }`}
                    >
                      {bengaliOptionLetters[optIndex] || optIndex + 1}
                    </span>
                    <span className="text-sm sm:text-base font-medium">{opt}</span>
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
