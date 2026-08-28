"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { ReviewCard } from "@/components/exam/ReviewCard";
import { fetchAppConfig } from "@/actions/admin-actions";
import { getExamSolutions, isAnswerTimeReached } from "@/actions/exam-actions";
import { Exam, QuestionSolution } from "@/types/exam";
import { Award, ListChecks, Trophy, Home, Loader2 } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

export default function ExamResultPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [solutions, setSolutions] = useState<QuestionSolution[] | null>(null);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    const rawResult = sessionStorage.getItem("last_result");
    if (rawResult) {
      setResultData(JSON.parse(rawResult));
    }

    fetchAppConfig().then((data) => {
      const ex = data.exams?.[examId];
      if (ex) {
        setExam(ex);
      }
    });
  }, [examId]);

  const handleToggleReview = async () => {
    if (!exam) return;

    if (!isAnswerTimeReached(exam)) {
      alert("উত্তর ও মার্ক্স প্রকাশের নির্ধারিত সময় অতিক্রান্ত হওয়ার পর সকল উত্তর ও ব্যাখ্যা দেখা যাবে।");
      return;
    }

    if (!solutions) {
      const data = await getExamSolutions(examId);
      setSolutions(data || []);
    }
    setShowReview(!showReview);
  };

  if (!resultData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bengali text-slate-500">
        ফলাফল পাওয়া যায়নি।
      </div>
    );
  }

  const isLive = resultData.isLive;

  return (
    <>
      <Header />

      <main className="flex-grow max-w-5xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-6">
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-md border border-slate-200 space-y-5">
          <div className="text-center bg-gradient-to-br from-indigo-50 to-violet-50 p-6 rounded-2xl border border-indigo-100 space-y-2">
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto text-3xl shadow">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">অভিনন্দন! পরীক্ষা সম্পন্ন হয়েছে</h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              শিক্ষার্থী: {resultData.studentName} ({resultData.studentId}) | পরীক্ষা: {resultData.examTitle}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
              <span className="text-[11px] sm:text-xs text-slate-500 block mb-1">মোট প্রশ্ন</span>
              <span className="text-lg sm:text-xl font-bold text-slate-800">
                {toBengaliDigits(resultData.totalQuestions)}
              </span>
            </div>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[11px] sm:text-xs text-emerald-600 block mb-1">সঠিক উত্তর</span>
              <span className="text-lg sm:text-xl font-bold text-emerald-700">
                {isLive ? "গোপন" : toBengaliDigits(resultData.correct ?? 0)}
              </span>
            </div>

            <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 text-center">
              <span className="text-[11px] sm:text-xs text-rose-600 block mb-1">ভুল উত্তর (-০.৫)</span>
              <span className="text-lg sm:text-xl font-bold text-rose-700">
                {isLive ? "গোপন" : toBengaliDigits(resultData.incorrect ?? 0)}
              </span>
            </div>

            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 text-center">
              <span className="text-[11px] sm:text-xs text-indigo-600 block mb-1">চূড়ান্ত স্কোর</span>
              <span className="text-xl sm:text-2xl font-black text-indigo-700">
                {isLive ? (
                  <span className="text-xs text-amber-600 block leading-tight font-medium">লাইভ শেষে প্রকাশ</span>
                ) : (
                  toBengaliDigits(resultData.score ?? 0)
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={handleToggleReview}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-2 shadow cursor-pointer"
            >
              <ListChecks className="w-4 h-4" /> উত্তর পর্যালোচনা (Review)
            </button>

            <button
              onClick={() => router.push(`/leaderboard/${examId}`)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3.5 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-2 shadow cursor-pointer"
            >
              <Trophy className="w-4 h-4" /> লিডারবোর্ড
            </button>

            <button
              onClick={() => router.push("/")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-3.5 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" /> হোম
            </button>
          </div>

          {showReview && exam && solutions && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">সকল প্রশ্নের সঠিক উত্তর ও ব্যাখ্যা:</h3>
              <ReviewCard
                questions={exam.questions || []}
                solutions={solutions}
                studentAnswers={resultData.answers || []}
              />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
