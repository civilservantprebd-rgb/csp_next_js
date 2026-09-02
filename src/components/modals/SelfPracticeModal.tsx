"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
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
  AlertCircle,
  ListChecks,
  ChevronDown,
  ChevronUp
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
  const [showReviewAfterExam, setShowReviewAfterExam] = useState(false);
  const examDeadlineRef = useRef<number>(0);
  const [restartTick, setRestartTick] = useState(0);

  // Restart stability key: the session reset below fires when this STABLE key
  // (question ids in order) changes — NOT when the parent merely rebuilds the
  // questions array with identical content — so unrelated prop churn can never
  // wipe in-progress answers mid-quiz. A "আবার দিন" restart feeds in a new
  // (reshuffled) array whose order differs, which changes this key; the
  // restartTick below additionally guarantees the reset even when the new key
  // happens to be unchanged (e.g. a one-question set or a no-op parent).
  const questionsKey = useMemo(
    () => questions.map((q) => q.id || q.q).join("|"),
    [questions]
  );

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setUserAnswers({});
      setIsFinished(false);
      setShowReviewAfterExam(false);
      setSecondsRemaining(questions.length * 60);
      examDeadlineRef.current = Date.now() + questions.length * 60 * 1000;
    }
  }, [isOpen, questionsKey, restartTick]);

  // Exam mode timer — anchored to an absolute deadline (recomputed from the
  // clock every tick) so background-tab interval throttling can never silently
  // extend the mock test.
  useEffect(() => {
    if (!isOpen || isFinished || mode !== "exam") return;

    const timer = setInterval(() => {
      const remainingMs = examDeadlineRef.current - Date.now();
      const remainingSecs = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsRemaining(remainingSecs);
      if (remainingMs <= 0) {
        clearInterval(timer);
        setIsFinished(true);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [isOpen, isFinished, mode]);

  if (!isOpen) return null;

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-bengali">
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

  const optLabels = ["ক", "খ", "গ", "ঘ"];
  const total = questions.length;
  const answeredCount = Object.keys(userAnswers).length;

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

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (mode === "instant" && userAnswers[qIdx] !== undefined) return; // Locked in instant mode
    setUserAnswers((prev) => {
      if (mode === "exam" && prev[qIdx] === optIdx) {
        const next = { ...prev };
        delete next[qIdx];
        return next;
      }
      return { ...prev, [qIdx]: optIdx };
    });
  };

  const handleNextInstant = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  const handlePrevInstant = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleFinishExam = () => {
    if (answeredCount < total) {
      if (!confirm(`আপনি ${toBengaliDigits(total)}টি প্রশ্নের মধ্যে ${toBengaliDigits(answeredCount)}টির উত্তর দিয়েছেন। আপনি কি পরীক্ষা জমা দিতে চান?`)) {
        return;
      }
    }
    setIsFinished(true);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${toBengaliDigits(m)}:${s < 10 ? "০" : ""}${toBengaliDigits(s)}`;
  };

  const currentQ = questions[currentIndex];
  const isCurrentAnswered = userAnswers[currentIndex] !== undefined;

  // "আবার দিন" — genuine restart. Bump restartTick FIRST so the reset effect
  // always fires (answers cleared, isFinished false, timer/deadline restarted),
  // then ask the parent (onRestart) to hand back the next round's questions —
  // typically a reshuffled copy of the same set (see StudentDashboardModal).
  const handleRestart = () => {
    setRestartTick((t) => t + 1);
    onRestart();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm font-bengali animate-in fade-in duration-200">
      <div className={`bg-white rounded-3xl w-full flex flex-col shadow-2xl border border-slate-100 overflow-hidden ${
        mode === "exam" && !isFinished ? "max-w-4xl max-h-[95vh]" : "max-w-2xl max-h-[92vh]"
      }`}>
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded">
                  {subjectName}
                </span>
                <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                  {mode === "instant" ? "ইনস্ট্যান্ট প্র্যাকটিস" : "মক টেস্ট (লিস্ট ভিউ)"}
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 mt-0.5">
                সেলফ-প্র্যাকটিস সেশন
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mode === "exam" && !isFinished && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1 text-xs text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-xl font-medium">
                  <span>উত্তর:</span>
                  <strong className="text-teal-700">{toBengaliDigits(answeredCount)}</strong>/<span>{toBengaliDigits(total)}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-xs text-amber-900 font-mono font-bold">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>{formatTimer(secondsRemaining)}</span>
                </div>
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
          mode === "instant" ? (
            /* ================= 1. INSTANT ONE-BY-ONE MODE ================= */
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
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wider block mb-1">
                  {currentQ.topic ? `টপিক: ${currentQ.topic}` : "প্রশ্ন"}
                </span>
                <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                  {toBengaliDigits(currentIndex + 1)}. {currentQ.q}
                </h4>
              </div>

              {/* Options List */}
              <div className="space-y-2.5">
                {currentQ.opts.map((opt, optIdx) => {
                  const isSelected = userAnswers[currentIndex] === optIdx;
                  const isCorrect = optIdx === currentQ.correct;

                  let optStyle = "bg-white border-slate-200 hover:border-teal-400 text-slate-800 hover:bg-slate-50";

                  if (isCurrentAnswered) {
                    if (isCorrect) {
                      optStyle = "bg-emerald-50 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400";
                    } else if (isSelected) {
                      optStyle = "bg-rose-50 border-rose-400 text-rose-950 font-bold ring-1 ring-rose-400";
                    } else {
                      optStyle = "bg-slate-50/50 border-slate-200 text-slate-400 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectOption(currentIndex, optIdx)}
                      className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm transition flex items-center justify-between gap-3 cursor-pointer shadow-sm ${optStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {optLabels[optIdx]}
                        </span>
                        <span>{opt}</span>
                      </div>

                      {isCurrentAnswered && (
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
              {isCurrentAnswered && (
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
            /* ================= 2. MOCK TEST FULL LIST VIEW ================= */
            <div className="p-4 sm:p-6 overflow-y-auto flex-grow space-y-6">
              <div className="bg-teal-50/60 p-3.5 rounded-2xl border border-teal-100 flex items-center justify-between text-xs text-teal-900">
                <span className="font-semibold flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-teal-600" /> সকল প্রশ্নের উত্তর নির্বাচন করে নিচে &ldquo;পরীক্ষা জমা দিন&rdquo; বাটনে ক্লিক করুন।
                </span>
                <span className="bg-white border border-teal-200 px-2.5 py-1 rounded-lg font-bold text-teal-800">
                  {toBengaliDigits(answeredCount)} / {toBengaliDigits(total)} সম্পন্ন
                </span>
              </div>

              {/* Question List */}
              <div className="space-y-6">
                {questions.map((q, qIdx) => {
                  const selectedOpt = userAnswers[qIdx];
                  const hasAnswered = selectedOpt !== undefined;

                  return (
                    <div
                      key={q.id || qIdx}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                        hasAnswered
                          ? "bg-teal-50/20 border-teal-200 shadow-sm"
                          : "bg-white border-slate-200/90"
                      }`}
                    >
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-3 mb-3.5">
                        <div>
                          {q.topic && (
                            <span className="text-xs text-teal-700 font-bold bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md mb-1.5 inline-block">
                              {q.topic}
                            </span>
                          )}
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed">
                            {toBengaliDigits(qIdx + 1)}. {q.q}
                          </h4>
                        </div>

                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          hasAnswered
                            ? "bg-teal-100 text-teal-800"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {hasAnswered ? `উত্তর: ${optLabels[selectedOpt]}` : "ফাঁকা"}
                        </span>
                      </div>

                      {/* Options Grid (2x2 or 1 column) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                        {q.opts.map((opt, optIdx) => {
                          const isSelected = selectedOpt === optIdx;

                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => handleSelectOption(qIdx, optIdx)}
                              className={`p-3 rounded-xl border text-left transition flex items-center gap-2.5 cursor-pointer ${
                                isSelected
                                  ? "bg-teal-600 border-teal-600 text-white font-bold shadow-sm"
                                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                                isSelected
                                  ? "bg-white text-teal-700"
                                  : "bg-white text-slate-700 border border-slate-200"
                              }`}>
                                {optLabels[optIdx]}
                              </span>
                              <span className="truncate">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          /* ================= 3. FINISHED SCORECARD & REVIEW ================= */
          <div className="p-5 sm:p-8 overflow-y-auto flex-grow text-center space-y-6">
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
                <span className="text-xs text-slate-500 block">মোট প্রশ্ন</span>
                <span className="text-base font-bold text-slate-900">{toBengaliDigits(total)}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-xs text-emerald-700 block">সঠিক (+১)</span>
                <span className="text-base font-bold text-emerald-800">{toBengaliDigits(correctCount)}</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="text-xs text-rose-700 block">ভুল (-০.৫)</span>
                <span className="text-base font-bold text-rose-800">{toBengaliDigits(incorrectCount)}</span>
              </div>
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200">
                <span className="text-xs text-teal-700 block">মোট স্কোর</span>
                <span className="text-lg font-black text-teal-900">{toBengaliDigits(score)}</span>
              </div>
            </div>

            {/* Accuracy Badge & Review Toggle Button */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="bg-slate-100 px-4 py-1.5 rounded-full text-xs font-semibold text-slate-700 border border-slate-200">
                অ্যাকুরেসি: <strong className="text-teal-700">{toBengaliDigits(accuracy)}%</strong>
              </span>

              <button
                type="button"
                onClick={() => setShowReviewAfterExam((prev) => !prev)}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-semibold px-4 py-1.5 rounded-full text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>{showReviewAfterExam ? "উত্তরপত্র লুকান" : "উত্তরপত্র ও সমাধান দেখুন"}</span>
                {showReviewAfterExam ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Full Questions Review with Solutions */}
            {showReviewAfterExam && (
              <div className="text-left space-y-4 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  সকল প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা:
                </h4>

                <div className="space-y-4">
                  {questions.map((q, qIdx) => {
                    const studentAns = userAnswers[qIdx];
                    const isAnswered = studentAns !== undefined;
                    const isCorrect = isAnswered && studentAns === q.correct;

                    return (
                      <div
                        key={qIdx}
                        className={`p-4 rounded-2xl border text-xs space-y-3 ${
                          !isAnswered
                            ? "bg-slate-50/80 border-slate-200"
                            : isCorrect
                            ? "bg-emerald-50/40 border-emerald-200"
                            : "bg-rose-50/40 border-rose-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm leading-relaxed">
                            {toBengaliDigits(qIdx + 1)}. {q.q}
                          </span>
                          {isCorrect ? (
                            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                              <CheckCircle2 className="w-3 h-3" /> সঠিক
                            </span>
                          ) : isAnswered ? (
                            <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                              <XCircle className="w-3 h-3" /> ভুল
                            </span>
                          ) : (
                            <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5 rounded shrink-0">
                              ফাঁকা
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                          {q.opts.map((opt, optIdx) => {
                            const isOptCorrect = optIdx === q.correct;
                            const isOptChosen = studentAns === optIdx;

                            return (
                              <div
                                key={optIdx}
                                className={`p-2 rounded-lg border ${
                                  isOptCorrect
                                    ? "bg-emerald-100 border-emerald-300 text-emerald-950 font-bold"
                                    : isOptChosen
                                    ? "bg-rose-100 border-rose-300 text-rose-950 font-bold"
                                    : "bg-white border-slate-200/80 text-slate-700"
                                }`}
                              >
                                ({optLabels[optIdx]}) {opt}
                              </div>
                            );
                          })}
                        </div>

                        {q.exp && (
                          <div className="p-3 bg-white/80 rounded-xl border border-slate-200 text-sm text-slate-600 leading-relaxed">
                            <strong>ব্যাখ্যা:</strong> {q.exp}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          {!isFinished ? (
            mode === "instant" ? (
              <>
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={handlePrevInstant}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    currentIndex === 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>পূর্ববর্তী</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextInstant}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
                >
                  <span>{currentIndex === total - 1 ? "ফলাফল দেখুন" : "পরবর্তী"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              /* Mock Exam Footer */
              <div className="flex items-center justify-between w-full gap-3">
                <div className="text-xs text-slate-500">
                  উত্তর দিয়েছেন: <strong className="text-teal-800">{toBengaliDigits(answeredCount)}</strong> / {toBengaliDigits(total)}টি প্রশ্ন
                </div>

                <button
                  type="button"
                  onClick={handleFinishExam}
                  className="bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>পরীক্ষা জমা দিন (Submit)</span>
                </button>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={handleRestart}
                className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>আবার দিন</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition cursor-pointer"
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
