"use client";

import React, { useState, useEffect, useRef } from "react";
import { PracticeQuestion } from "@/lib/practice-helper";
import { QuestionList } from "@/components/exam/QuestionList";
import { toBengaliDigits } from "@/lib/utils";
import { CheckCheck, X, AlertCircle, CheckCircle2, Send, RotateCcw, LayoutGrid } from "lucide-react";

interface SelfPracticeExamArenaProps {
  questions: PracticeQuestion[];
  subjectName: string;
  onClose: () => void;
  onRestart: () => void;
}

export const SelfPracticeExamArena: React.FC<SelfPracticeExamArenaProps> = ({
  questions,
  subjectName,
  onClose,
  onRestart,
}) => {
  const [userAnswers, setUserAnswers] = useState<(number | null)[]>(Array(questions.length).fill(null));
  const [isFinished, setIsFinished] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  const totalQuestions = questions.length;
  const answeredCount = userAnswers.filter((a) => a !== null).length;
  const unansweredCount = totalQuestions - answeredCount;

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (isFinished) return;
    setUserAnswers((prev) => {
      const next = [...prev];
      next[qIdx] = optIdx;
      return next;
    });
  };

  const handleConfirmSubmit = () => {
    setIsConfirmModalOpen(false);
    setIsFinished(true);
  };

  if (isFinished) {
    let correctCount = 0;
    let incorrectCount = 0;
    questions.forEach((q, idx) => {
      const ans = userAnswers[idx];
      if (ans !== null) {
        if (ans === q.correct) correctCount++;
        else incorrectCount++;
      }
    });
    const finalUnanswered = totalQuestions - (correctCount + incorrectCount);
    const score = correctCount * 1 - incorrectCount * 0.5;
    const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return (
      <div className="min-h-dvh w-full bg-slate-50 font-bengali pb-12">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <CheckCheck className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <h1 className="text-lg font-black text-slate-900 leading-tight">ফলাফল: {subjectName}</h1>
                <p className="text-xs font-bold text-slate-500 mt-0.5">মক টেস্ট সম্পন্ন হয়েছে</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100">
            <div className="text-center mb-6">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">প্রাপ্ত নম্বর</h2>
              <div className={`text-5xl font-black ${score >= 0 ? "text-indigo-600" : "text-rose-500"}`}>
                {toBengaliDigits(score)}
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-100 p-3 sm:p-4 rounded-2xl text-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 block mb-1">মোট প্রশ্ন</span>
                <span className="text-lg sm:text-xl font-black text-slate-800">{toBengaliDigits(totalQuestions)}</span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 p-3 sm:p-4 rounded-2xl text-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 block mb-1">সঠিক</span>
                <span className="text-lg sm:text-xl font-black text-emerald-700">{toBengaliDigits(correctCount)}</span>
              </div>
              <div className="bg-rose-50 border border-rose-100 p-3 sm:p-4 rounded-2xl text-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-rose-700 block mb-1">ভুল</span>
                <span className="text-lg sm:text-xl font-black text-rose-700">{toBengaliDigits(incorrectCount)}</span>
              </div>
              <div className="bg-amber-50 border border-amber-100 p-3 sm:p-4 rounded-2xl text-center">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 block mb-1">উত্তর দেননি</span>
                <span className="text-lg sm:text-xl font-black text-amber-700">{toBengaliDigits(finalUnanswered)}</span>
              </div>
            </div>
            
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
               <button
                 onClick={onRestart}
                 className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-3 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
               >
                 <RotateCcw className="w-4 h-4" /> আবার পরীক্ষা দিন
               </button>
            </div>
          </div>

          <div className="space-y-4">
             <h3 className="text-lg font-black text-slate-900 px-2 flex items-center gap-2">
               <CheckCheck className="w-5 h-5 text-emerald-600" /> সঠিক উত্তরমালা
             </h3>
             {questions.map((q, qIdx) => {
               const myAns = userAnswers[qIdx];
               const isSkipped = myAns === null;
               const isCorrect = myAns === q.correct;
               
               let stateColor = "border-slate-200 bg-white";
               if (!isSkipped) {
                 stateColor = isCorrect
                   ? "border-emerald-200 bg-emerald-50/30"
                   : "border-rose-200 bg-rose-50/30";
               }

               return (
                 <div key={qIdx} className={`rounded-3xl p-4 sm:p-6 shadow-sm border transition ${stateColor}`}>
                   <div className="flex items-start gap-3">
                     <span className={`shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-2xl flex items-center justify-center text-xs sm:text-sm font-black text-white ${
                       isSkipped ? "bg-slate-400" : isCorrect ? "bg-emerald-500" : "bg-rose-500"
                     }`}>
                       {toBengaliDigits(qIdx + 1)}
                     </span>
                     <div className="flex-1 min-w-0">
                       <h4 className="font-bold text-slate-900 text-[15px] sm:text-base leading-relaxed mb-4">
                         {q.q}
                       </h4>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                         {q.opts.map((opt, optIdx) => {
                           const isThisCorrect = optIdx === q.correct;
                           const isThisSelected = optIdx === myAns;
                           
                           let optClasses = "border-slate-200 bg-slate-50 text-slate-600";
                           let icon = null;
                           
                           if (isThisCorrect) {
                             optClasses = "border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500";
                             icon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                           } else if (isThisSelected && !isThisCorrect) {
                             optClasses = "border-rose-300 bg-rose-50 text-rose-800";
                             icon = <X className="w-4 h-4 text-rose-600" />;
                           }

                           return (
                             <div key={optIdx} className={`p-3 rounded-xl border flex items-center gap-2 ${optClasses}`}>
                               <span className="shrink-0 w-6 h-6 rounded-full bg-white flex items-center justify-center text-[10px] font-black border border-current opacity-80">
                                 {["ক", "খ", "গ", "ঘ"][optIdx] || optIdx + 1}
                               </span>
                               <span className="text-[13px] sm:text-sm font-medium flex-1">{opt}</span>
                               {icon && <span className="shrink-0">{icon}</span>}
                             </div>
                           );
                         })}
                       </div>
                       
                       {q.exp && (
                         <div className="mt-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 text-indigo-900 text-sm leading-relaxed">
                           <strong className="block mb-1 text-[11px] uppercase tracking-wider text-indigo-500">ব্যাখ্যা</strong>
                           {q.exp}
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
               );
             })}
          </div>
        </main>
      </div>
    );
  }

  const formattedQuestions = questions.map(q => ({
    q: q.q,
    opts: q.opts
  }));

  return (
    <div className="min-h-dvh w-full bg-slate-50 font-bengali pb-[100px] sm:pb-[140px]">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex-1 min-w-0 pr-4">
          <h2 className="font-black text-slate-900 truncate text-sm sm:text-base">
            {subjectName}
          </h2>
          <p className="text-[11px] text-slate-500 font-bold">
            মক টেস্ট মোড • {toBengaliDigits(totalQuestions)}টি প্রশ্ন
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          <div className="flex-1 min-w-0 w-full">
            <QuestionList
              questions={formattedQuestions}
              studentAnswers={userAnswers}
              onSelectOption={handleSelectOption}
            />
          </div>
          
          <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-[88px]">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <LayoutGrid className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-sm">প্রশ্ন প্যালেট</h3>
                </div>
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-emerald-600">দাগানো: {toBengaliDigits(answeredCount)}</span>
                  <span className="text-slate-500">বাকি: {toBengaliDigits(unansweredCount)}</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
                  />
                </div>
              </div>
              
              <div className="p-4 grid grid-cols-6 sm:grid-cols-10 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {questions.map((_, i) => {
                  const done = userAnswers[i] !== null;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        document.getElementById(`exam-q-${i}`)?.scrollIntoView({
                          behavior: "smooth",
                          block: "center"
                        });
                      }}
                      className={`aspect-square rounded-xl text-xs font-black transition flex items-center justify-center cursor-pointer ${
                        done
                          ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm hover:brightness-110"
                          : "bg-slate-50 text-slate-500 border border-slate-200 hover:border-indigo-300 hover:text-indigo-700"
                      }`}
                    >
                      {toBengaliDigits(i + 1)}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
          
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200 p-4 animate-in slide-in-from-bottom-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="hidden sm:block">
            <p className="text-[11px] font-bold text-slate-500">
              আপনি {toBengaliDigits(totalQuestions)}টির মধ্যে {toBengaliDigits(answeredCount)}টি প্রশ্নের উত্তর দিয়েছেন।
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white font-bold px-8 py-3.5 sm:py-3 rounded-2xl sm:rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-xl shadow-black/10 cursor-pointer"
          >
            <Send className="w-4 h-4" /> পরীক্ষা জমা দিন
          </button>
        </div>
      </div>

      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 font-bengali">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4 text-white relative">
              <h3 className="text-lg font-black">পরীক্ষা জমা দিতে চান?</h3>
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  unansweredCount > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                }`}>
                  {unansweredCount > 0 ? <AlertCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {unansweredCount > 0 
                      ? `এখনও ${toBengaliDigits(unansweredCount)}টি প্রশ্নের উত্তর দেওয়া বাকি আছে।` 
                      : "সবগুলো প্রশ্নের উত্তর দেওয়া হয়েছে!"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">জমা দিলে আর পরিবর্তন করা যাবে না।</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  নিশ্চিত করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
