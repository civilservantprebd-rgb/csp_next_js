"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { QuestionList } from "@/components/exam/QuestionList";
import { fetchExamWithQuestions } from "@/actions/admin-actions";
import { submitExamAnswers } from "@/actions/exam-actions";
import { parseBangladeshDateTime, getTrueNowMs, isExamCurrentlyLive } from "@/lib/bangladesh-time";
import { Exam } from "@/types/exam";
import { CheckCheck, Loader2, X, AlertCircle, CheckCircle2, Send } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<(number | null)[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    const rawStudent = sessionStorage.getItem("current_student");
    if (!rawStudent) {
      router.push("/");
      return;
    }
    let parsedStudent: { id: string; name: string } | null = null;
    try {
      parsedStudent = JSON.parse(rawStudent);
    } catch {
      // corrupted session data — restart the flow
    }
    if (!parsedStudent || typeof parsedStudent.id !== "string" || !parsedStudent.id) {
      router.push("/");
      return;
    }
    setStudent(parsedStudent);

    // Deep links skip the home page where time sync normally runs — sync here
    // too so the countdown never silently falls back to the tamperable device
    // clock.
    import("@/lib/bangladesh-time").then(({ syncBangladeshNetworkTime }) => {
      syncBangladeshNetworkTime();
    });

    fetchExamWithQuestions(examId).then(async (ex) => {
      if (!ex) {
        // fetchExamWithQuestions returns null when there is no verified session
        // (or, for paid exams, no enrollment). Tell the student which case it is
        // instead of a generic "not found".
        try {
          const { ensureExamSession } = await import("@/actions/exam-actions");
          const sess = await ensureExamSession();
          if (!sess.session) {
            alert("পরীক্ষা দেওয়ার জন্য Google লগইন প্রয়োজন। অনুগ্রহ করে হোম পেজ থেকে লগইন করুন।");
          } else {
            alert("এই পরীক্ষাটিতে অংশগ্রহণের অনুমতি নেই (এনরোলমেন্ট যাচাই করা যায়নি)।");
          }
        } catch {
          alert("পরীক্ষা পাওয়া যায়নি।");
        }
        router.push("/");
        return;
      }

      // Pre-check if already submitted during live period
      if (isExamCurrentlyLive(ex)) {
        const { checkStudentAlreadySubmitted } = await import("@/actions/exam-actions");
        const already = await checkStudentAlreadySubmitted(examId, parsedStudent.id);
        if (already) {
          alert("আপনি ইতিমধ্যে এই লাইভ পরীক্ষায় অংশগ্রহণ করেছেন! লাইভ চলাকালীন এক অ্যাকাউন্ট দিয়ে কেবল একবারই পরীক্ষা দেওয়া যাবে।");
          router.push("/");
          return;
        }
      }

      // Block starting a SCHEDULED exam before its start time — the exam hall
      // opens only during the live window (post-window "practice" attempts are
      // still allowed by design).
      if (ex.startTime) {
        const startTime = parseBangladeshDateTime(ex.startTime);
        if (startTime && getTrueNowMs() < startTime.getTime()) {
          alert("এই পরীক্ষাটি এখনো শুরু হয়নি। নির্ধারিত সময়ে আবার চেষ্টা করুন।");
          router.push("/");
          return;
        }
      }

      setExam(ex);
      setStudentAnswers(new Array(ex.questions?.length || 0).fill(null));

      let examDurationSecs = (ex.timerMinutes || 10) * 60;

      // If exam is currently live and has a specified endTime, limit duration to remaining live time
      if (isExamCurrentlyLive(ex) && ex.endTime) {
        const endTime = parseBangladeshDateTime(ex.endTime);
        if (endTime) {
          const remainingLiveSecs = Math.floor((endTime.getTime() - getTrueNowMs()) / 1000);
          if (remainingLiveSecs > 0) {
            examDurationSecs = Math.min(examDurationSecs, remainingLiveSecs);
          }
        }
      }

      setSecondsRemaining(Math.max(1, examDurationSecs));
    });
  }, [examId, router]);

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (studentAnswers[qIdx] !== null) return;
    const next = [...studentAnswers];
    next[qIdx] = optIdx;
    setStudentAnswers(next);
  };

  const doSubmit = async (timeRemaining: number) => {
    if (isSubmitting || !exam || !student) return;
    setIsSubmitting(true);

    const res = await submitExamAnswers({
      studentName: student.name,
      studentId: student.id,
      examKey: examId,
      examTitle: exam.title,
      examTimerMinutes: exam.timerMinutes,
      timeRemaining: timeRemaining,
      answers: studentAnswers,
      totalQuestions: exam.questions?.length || 0,
    });

    setIsSubmitting(false);

    const timeSpentSecs = (exam.timerMinutes || 10) * 60 - timeRemaining;
    const mins = Math.floor(timeSpentSecs / 60);
    const secs = timeSpentSecs % 60;
    const timeFormatted = `${mins} মি. ${secs} সে.`;

    if (res.success) {
      sessionStorage.setItem(
        "last_result",
        JSON.stringify({
          examKey: examId,
          examTitle: exam.title,
          studentName: student.name,
          studentId: student.id,
          isLive: res.isLive,
          isLiveSubmission: res.isLiveSubmission,
          score: res.score,
          correct: res.correct,
          incorrect: res.incorrect,
          timeSpent: timeFormatted,
          totalQuestions: exam.questions?.length || 0,
          answers: studentAnswers,
        })
      );
      router.push(`/exam/${examId}/result`);
    } else {
      alert(res.message || "উত্তরপত্র জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };

  const handleManualSubmit = () => {
    if (isSubmitting) return;
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSubmit = () => {
    setIsConfirmModalOpen(false);
    doSubmit(secondsRemaining ?? 0);
  };

  const handleAutoSubmit = () => {
    if (isSubmitting) return;
    setIsConfirmModalOpen(false);
    alert("পরীক্ষার নির্ধারিত সময় সমাপ্ত হয়েছে! আপনার উত্তরপত্র জমা দেওয়া হচ্ছে।");
    doSubmit(0);
  };

  if (!exam || !student || secondsRemaining === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bengali text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> পরীক্ষা লোড হচ্ছে...
      </div>
    );
  }

  const totalQuestions = exam.questions?.length || 0;
  const answeredCount = studentAnswers.filter((a) => a !== null).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <>
      <main className="flex-grow max-w-5xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali">
        <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-md border border-slate-200 space-y-6">
          <div className="flex flex-row justify-between items-center pb-3 border-b border-slate-100 gap-2 sticky top-0 bg-white z-30 py-0 px-1">
            {/* Left: Title */}
            <div className="flex-1 text-left min-w-0 py-3">
              <span className="inline-block text-xs sm:text-sm md:text-base font-bold text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-full uppercase truncate max-w-full">
                {exam.title}
              </span>
            </div>

            {/* Center: Submit Button (Sticky to top) */}
            <div className="flex-shrink-0 text-center self-start">
              <button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-6 sm:px-10 py-3.5 rounded-t-none rounded-b-2xl transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isSubmitting ? "জমা হচ্ছে..." : "জমা দিন (Submit)"}
              </button>
            </div>

            {/* Right: Timer */}
            <div className="flex-1 flex justify-end py-3">
              <ExamTimer
                initialSeconds={secondsRemaining}
                onTimeExpire={handleAutoSubmit}
                onTimeUpdate={(s) => setSecondsRemaining(s)}
              />
            </div>
          </div>

          <QuestionList
            questions={exam.questions || []}
            studentAnswers={studentAnswers}
            onSelectOption={handleSelectOption}
          />

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="w-5 h-5" />
              {isSubmitting ? "জমা হচ্ছে..." : "পরীক্ষা জমা দিন (Submit)"}
            </button>
          </div>
        </div>
      </main>

      {/* Beautiful & Simple Submit Confirmation Popup */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 font-bengali animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 text-center space-y-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
                  unansweredCount > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {unansweredCount > 0 ? (
                  <AlertCircle className="w-7 h-7" />
                ) : (
                  <CheckCircle2 className="w-7 h-7" />
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">পরীক্ষা জমা দিতে চান?</h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  {unansweredCount > 0
                    ? `আপনার এখনও ${toBengaliDigits(unansweredCount)} টি প্রশ্নের উত্তর দেওয়া বাকি আছে।`
                    : "আপনি সকল প্রশ্নের উত্তর দিয়েছেন।"}
                </p>
              </div>

              {/* Status Summary Pills */}
              <div className="grid grid-cols-3 gap-2 py-1">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2 text-center">
                  <span className="text-xs text-slate-500 block">মোট প্রশ্ন</span>
                  <span className="text-sm font-bold text-slate-800">
                    {toBengaliDigits(totalQuestions)}
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2 text-center">
                  <span className="text-xs text-emerald-700 block">উত্তর দেওয়া</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {toBengaliDigits(answeredCount)}
                  </span>
                </div>
                <div
                  className={`rounded-xl p-2 text-center border ${
                    unansweredCount > 0
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-slate-50 border-slate-100 text-slate-400"
                  }`}
                >
                  <span className="text-xs block">বাকি আছে</span>
                  <span className="text-sm font-bold">
                    {toBengaliDigits(unansweredCount)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "জমা হচ্ছে..." : "হ্যাঁ, জমা দিন"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl transition text-xs sm:text-sm cursor-pointer"
                >
                  পরীক্ষায় ফিরে যান
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
