"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { ReviewCard } from "@/components/exam/ReviewCard";
import { fetchAppConfig } from "@/actions/admin-actions";
import { getExamSolutions, getExamCandidateRank } from "@/actions/exam-actions";
import { isAnswerTimeReached } from "@/lib/bangladesh-time";
import { Exam, QuestionSolution } from "@/types/exam";
import { Award, ListChecks, Trophy, Home, Loader2, Clock, X, Lock, Sparkles, AlertTriangle, Printer } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";
import { PrintableMarksheetModal } from "@/components/exam/PrintableMarksheetModal";

import { saveMistakesFromSubmission } from "@/lib/mistake-bookmark-store";

export default function ExamResultPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [solutions, setSolutions] = useState<QuestionSolution[] | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [rankInfo, setRankInfo] = useState<{
    practiceRank: number;
    totalCandidates: number;
    officialCandidates: number;
  } | null>(null);

  useEffect(() => {
    const rawResult = sessionStorage.getItem("last_result");
    if (rawResult) {
      const parsed = JSON.parse(rawResult);
      setResultData(parsed);
      if (typeof parsed.score === "number") {
        getExamCandidateRank(examId, parsed.score, parsed.timeSpent || "").then(setRankInfo);
      }
    }

    fetchAppConfig().then((data) => {
      const ex = data.exams?.[examId];
      if (ex) {
        setExam(ex);
      }
    });
  }, [examId]);

  // যদি পরীক্ষা লাইভ না হয় অথবা লাইভ হলেও রেজাল্ট পাবলিশ করা হয়ে থাকে, তবে স্কোর ও সঠিক/ভুল দেখাবে
  const isPublished = exam 
    ? (isAnswerTimeReached(exam) || !resultData?.isLive)
    : !resultData?.isLive;

  const handleToggleReview = async () => {
    if (!exam) return;

    if (!isPublished) {
      setShowLockedModal(true);
      return;
    }

    if (!solutions) {
      const data = await getExamSolutions(examId);
      setSolutions(data || []);
      if (data && resultData?.studentId) {
        saveMistakesFromSubmission(
          resultData.studentId,
          exam.title,
          exam.questions || [],
          data,
          resultData.answers || [],
          exam.subject
        );
      }
    }
    setShowReview(!showReview);
  };

  if (!resultData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bengali text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        ফলাফল লোড হচ্ছে...
      </div>
    );
  }

  return (
    <>
      <Header />

      <main className="flex-grow max-w-5xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-6">
        <div className="bg-white rounded-3xl p-5 sm:p-8 shadow-xs border border-slate-200/90 space-y-5">
          <div className="text-center bg-white p-6 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Award className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">অভিনন্দন! পরীক্ষা সম্পন্ন হয়েছে</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              শিক্ষার্থী: {resultData.studentName} ({resultData.studentId}) | পরীক্ষা: {resultData.examTitle}
            </p>
          </div>

          {/* Late / Practice Exam Rank Card */}
          {resultData.isLiveSubmission === false && (
            <div className="p-4 bg-white rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3 text-amber-700" /> অনুশীলন পরীক্ষা (লাইভ সমাপ্তির পরে প্রদত্ত)
                </span>
                <p className="text-xs text-slate-600 font-medium">
                  নির্ধারিত শেষ সময় অতিক্রান্ত হওয়ার পর পরীক্ষা দেওয়ায় এটি পাবলিক লাইভ লিডারবোর্ডে যুক্ত হয়নি।
                </p>
              </div>
              {rankInfo && (
                <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-center shrink-0 shadow-2xs">
                  <span className="text-[10px] text-slate-500 block">
                    মোট {toBengaliDigits(rankInfo.totalCandidates)} জন পরীক্ষার্থীর মধ্যে
                  </span>
                  <span className="text-base sm:text-lg font-black text-slate-900">
                    র‍্যাংক: {toBengaliDigits(rankInfo.practiceRank)} তম
                  </span>
                </div>
              )}
            </div>
          )}

          {!isPublished && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center space-y-1">
              <p className="font-bold text-slate-900 text-sm sm:text-base flex items-center justify-center gap-1.5">
                ⚠️ মার্ক্স এখনও প্রকাশিত হয়নি
              </p>
              <p className="text-xs sm:text-sm text-slate-600">
                শিক্ষক ফলাফল প্রকাশ করার পর আপনার চূড়ান্ত স্কোর, সঠিক ও ভুল উত্তর এবং প্রতিটি প্রশ্নের পূর্ণাঙ্গ ব্যাখ্যা দেখতে পাবেন।
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] sm:text-xs text-slate-500 block mb-1">মোট প্রশ্ন</span>
              <span className="text-lg sm:text-xl font-bold text-slate-900">
                {toBengaliDigits(resultData.totalQuestions)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] sm:text-xs text-emerald-600 block mb-1">সঠিক উত্তর</span>
              <span className="text-lg sm:text-xl font-bold text-emerald-700">
                {!isPublished ? "অপ্রকাশিত" : toBengaliDigits(resultData.correct ?? 0)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] sm:text-xs text-rose-600 block mb-1">ভুল উত্তর (-০.৫)</span>
              <span className="text-lg sm:text-xl font-bold text-rose-700">
                {!isPublished ? "অপ্রকাশিত" : toBengaliDigits(resultData.incorrect ?? 0)}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-2xs">
              <span className="text-[11px] sm:text-xs text-indigo-600 block mb-1">চূড়ান্ত স্কোর</span>
              <span className="text-xl sm:text-2xl font-black text-indigo-700">
                {!isPublished ? (
                  <span className="text-xs text-slate-500 block leading-tight font-medium">ফলাফল প্রকাশের অপেক্ষায়</span>
                ) : (
                  toBengaliDigits(resultData.score ?? 0)
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              onClick={handleToggleReview}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <ListChecks className="w-4 h-4" /> উত্তর পর্যালোচনা (Review)
            </button>

            <button
              onClick={async () => {
                if (!isPublished) {
                  setShowLockedModal(true);
                  return;
                }
                if (!solutions) {
                  const data = await getExamSolutions(examId);
                  setSolutions(data || []);
                }
                setShowPrintModal(true);
              }}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-semibold px-5 py-3.5 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4 text-indigo-600" /> মার্কশিট (PDF)
            </button>

            <button
              onClick={() => router.push(`/leaderboard/${examId}`)}
              className="bg-white hover:bg-slate-50 text-slate-800 font-bold border border-slate-200 px-5 py-3.5 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-500" /> লিডারবোর্ড
            </button>

            <button
              onClick={() => router.push("/")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-5 py-3.5 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-4 h-4" /> হোম
            </button>
          </div>

          {/* Printable Marksheet Modal */}
          {exam && (
            <PrintableMarksheetModal
              isOpen={showPrintModal}
              onClose={() => setShowPrintModal(false)}
              examTitle={resultData.examTitle}
              courseName={exam.course}
              subjectName={exam.subject}
              studentName={resultData.studentName}
              studentId={resultData.studentId}
              totalQuestions={resultData.totalQuestions || exam.questions?.length || 0}
              score={resultData.score ?? 0}
              correct={resultData.correct ?? 0}
              incorrect={resultData.incorrect ?? 0}
              timeSpent={resultData.timeSpent || "১০ মিনিট"}
              submittedAt={new Date().toISOString()}
              questions={exam.questions || []}
              solutions={solutions || []}
              studentAnswers={resultData.answers || []}
            />
          )}

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

      {/* Locked Result / Review Popup */}
      {showLockedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-bengali animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setShowLockedModal(false)}
              className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-slate-700 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 p-6 text-white text-center relative overflow-hidden">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-2.5 shadow-inner">
                <Clock className="w-7 h-7 text-white animate-pulse" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold">ফলাফল এখনও প্রকাশিত হয়নি</h3>
              <p className="text-xs text-amber-100 mt-0.5">উত্তর ও পূর্ণাঙ্গ পর্যালোচনা সাময়িকভাবে গোপন</p>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-4 text-center">
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                শিক্ষক কর্তৃক এই পরীক্ষার ফলাফল ও সমাধান এখনও রিলিজ করা হয়নি। শিক্ষক ফলাফল উন্মুক্ত করার সাথে সাথেই আপনি প্রতিটি প্রশ্নের সঠিক উত্তর, আপনার উত্তর এবং বিশদ ব্যাখ্যা দেখতে পাবেন।
              </p>

              {exam?.endTime && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-950 font-medium">
                  ⏰ পরীক্ষা সমাপ্তির সময়:{" "}
                  <strong>{new Date(exam.endTime).toLocaleString("bn-BD")}</strong>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  onClick={() => router.push(`/leaderboard/${examId}`)}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Trophy className="w-4 h-4" /> লিডারবোর্ড দেখুন
                </button>
                <button
                  onClick={() => setShowLockedModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-5 rounded-xl transition text-xs sm:text-sm cursor-pointer"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
