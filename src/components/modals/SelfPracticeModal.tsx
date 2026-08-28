"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Trophy,
  BookOpen,
  Clock,
  Zap,
  Check,
  AlertCircle
} from "lucide-react";
import { PracticeQuestion } from "@/lib/practice-helper";
import { toBengaliDigits } from "@/lib/utils";

interface SelfPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: PracticeQuestion[];
  subjectName: string;
  mode: "instant" | "exam";
  onRestart: () => void;
}

export const SelfPracticeModal: React.FC<SelfPracticeModalProps> = ({
  isOpen,
  onClose,
  questions,
  subjectName,
  mode,
  onRestart,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(questions.length * 60);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setUserAnswers({});
      setIsFinished(false);
      setSecondsRemaining(questions.length * 60);
    }
  }, [isOpen, questions]);

  // Exam mode timer
  useEffect(() => {
    if (!isOpen || isFinished || mode !== "exam") return;
    if (secondsRemaining <= 0) {
      setIsFinished(true);
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isFinished, mode, secondsRemaining]);

  if (!isOpen) return null;

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-bengali">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">প্রশ্ন পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            এই বিষয়ে বর্তমানে কোনো প্রশ্ন যুক্ত নেই। অনুগ্রহ করে অন্য কোনো বিষয় নির্বাচন করুন।
          </p>
          <button
            onClick={onClose}
            className="w-full bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const optLabels = ["ক", "খ", "গ", "ঘ"];
  const total = questions.length;
  const currentAnswer = userAnswers[currentIndex];
  const isAnswered = currentAnswer !== undefined;

  // Calculate results
  let correctCount = 0;
  let incorrectCount = 0;
  questions.forEach((q, idx) => {
    const ans = userAnswers[idx];
    if (ans !== undefined) {
      if (ans === q.correct) correctCount++;
      else incorrectCount++;
    }
  });
  const unansweredCount = total - (correctCount + incorrectCount);
  const score = correctCount * 1 - incorrectCount * 0.5;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const handleSelectOption = (optIdx: number) => {
    if (mode === "instant" && isAnswered) return; // Locked once answered in instant mode
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: optIdx }));
  };

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${toBengaliDigits(m)}:${s < 10 ? "০" : ""}${toBengaliDigits(s)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-xs font-bengali animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded">
                {subjectName} • {mode === "instant" ? "ইনস্ট্যান্ট মোড" : "মক টেস্ট"}
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
                সেলফ-প্র্যাকটিস সেশন
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mode === "exam" && !isFinished && (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl text-xs text-amber-900 font-mono font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>{formatTimer(secondsRemaining)}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!isFinished ? (
          <div className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-5">
            {/* Progress Bar & Question Counter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>
                  প্রশ্ন: <strong className="text-slate-900">{toBengaliDigits(currentIndex + 1)}</strong> / {toBengaliDigits(total)}
                </span>
                <span>অগ্রগতি: {toBengaliDigits(Math.round(((currentIndex + 1) / total) * 100))}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-teal-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Box */}
            <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
              <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block mb-1">
                {currentQ.topic ? `টপিক: ${currentQ.topic}` : "প্রশ্ন"}
              </span>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                {toBengaliDigits(currentIndex + 1)}. {currentQ.q}
              </h4>
            </div>

            {/* Options List */}
            <div className="space-y-2.5">
              {currentQ.opts.map((opt, optIdx) => {
                const isSelected = currentAnswer === optIdx;
                const isCorrect = optIdx === currentQ.correct;

                let optStyle = "bg-white border-slate-200 hover:border-teal-400 text-slate-800 hover:bg-slate-50";

                if (mode === "instant" && isAnswered) {
                  if (isCorrect) {
                    optStyle = "bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400";
                  } else if (isSelected) {
                    optStyle = "bg-rose-50 border-rose-400 text-rose-950 font-bold ring-1 ring-rose-400";
                  } else {
                    optStyle = "bg-slate-50/50 border-slate-200 text-slate-400 opacity-60";
                  }
                } else if (mode === "exam" && isSelected) {
                  optStyle = "bg-teal-50 border-teal-500 text-teal-950 font-bold ring-2 ring-teal-400";
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm transition flex items-center justify-between gap-3 cursor-pointer shadow-2xs ${optStyle}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {optLabels[optIdx]}
                      </span>
                      <span>{opt}</span>
                    </div>

                    {mode === "instant" && isAnswered && (
                      <div>
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : isSelected ? (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : null}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Instant Mode: Explanation Reveal */}
            {mode === "instant" && isAnswered && (
              <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>সঠিক উত্তর: ({optLabels[currentQ.correct]}) {currentQ.opts[currentQ.correct]}</span>
                </div>
                {currentQ.exp && (
                  <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
                    <strong>ব্যাখ্যা:</strong> {currentQ.exp}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Finished Scorecard View */
          <div className="p-6 sm:p-8 overflow-y-auto flex-grow text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-teal-100 flex items-center justify-center mx-auto text-teal-700 shadow-inner">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-black text-slate-900">
                অনুশীলন সমাপ্ত হয়েছে! 🎉
              </h3>
              <p className="text-xs text-slate-500">
                বিষয়: <strong>{subjectName}</strong> • মোট প্রশ্ন: {toBengaliDigits(total)}টি
              </p>
            </div>

            {/* Score Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-lg mx-auto text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] text-slate-500 block">মোট প্রশ্ন</span>
                <span className="text-base font-bold text-slate-900">{toBengaliDigits(total)}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-[10px] text-emerald-700 block">সঠিক (+১)</span>
                <span className="text-base font-bold text-emerald-800">{toBengaliDigits(correctCount)}</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-[10px] text-rose-700 block">ভুল (-০.৫)</span>
                <span className="text-base font-bold text-rose-800">{toBengaliDigits(incorrectCount)}</span>
              </div>
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                <span className="text-[10px] text-teal-700 block">মোট স্কোর</span>
                <span className="text-lg font-black text-teal-900">{toBengaliDigits(score)}</span>
              </div>
            </div>

            {/* Accuracy Badge */}
            <div className="inline-block bg-slate-100 px-4 py-1.5 rounded-full text-xs font-semibold text-slate-700">
              অ্যাকুরেসি রেট: <strong className="text-teal-700">{toBengaliDigits(accuracy)}%</strong>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          {!isFinished ? (
            <>
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={handlePrev}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  currentIndex === 0
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>পূর্ববর্তী</span>
              </button>

              <div className="flex items-center gap-2">
                {mode === "exam" && (
                  <button
                    type="button"
                    onClick={() => setIsFinished(true)}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-4 py-2.5 rounded-xl text-xs border border-rose-200 transition cursor-pointer"
                  >
                    জমা দিন
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <span>{currentIndex === total - 1 ? "ফলাফল দেখুন" : "পরবর্তী"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={onRestart}
                className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>আবার দিন</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                সম্পন্ন
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
