"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { QuestionList } from "@/components/exam/QuestionList";
import { fetchAppConfig } from "@/actions/admin-actions";
import { submitExamAnswers, isExamCurrentlyLive } from "@/actions/exam-actions";
import { parseBangladeshDateTime, getTrueNowMs } from "@/lib/bangladesh-time";
import { Exam } from "@/types/exam";
import { CheckCheck, Loader2 } from "lucide-react";

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<(number | null)[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const rawStudent = sessionStorage.getItem("current_student");
    if (!rawStudent) {
      router.push("/");
      return;
    }
    setStudent(JSON.parse(rawStudent));

    fetchAppConfig().then((data) => {
      const ex = data.exams?.[examId];
      if (!ex) {
        alert("পরীক্ষা পাওয়া যায়নি।");
        router.push("/");
        return;
      }
      setExam(ex);
      setStudentAnswers(new Array(ex.questions?.length || 0).fill(null));

      let initialSecs = ex.timerMinutes * 60;
      if (isExamCurrentlyLive(ex) && ex.startTime) {
        const startTime = parseBangladeshDateTime(ex.startTime);
        if (startTime) {
          const durationMs = ex.timerMinutes * 60 * 1000;
          const endMs = startTime.getTime() + durationMs;
          const nowMs = getTrueNowMs();
          initialSecs = Math.max(0, Math.floor((endMs - nowMs) / 1000));
        }
      }
      setSecondsRemaining(initialSecs);
    });
  }, [examId, router]);

  if (!exam || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bengali text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> পরীক্ষা লোড হচ্ছে...
      </div>
    );
  }

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (studentAnswers[qIdx] !== null) return;
    const next = [...studentAnswers];
    next[qIdx] = optIdx;
    setStudentAnswers(next);
  };

  const handleFinishExam = async () => {
    if (isSubmitting) return;

    const unanswered = studentAnswers.filter((a) => a === null).length;
    if (unanswered > 0) {
      if (!confirm(`আপনার ${unanswered} টি প্রশ্নের উত্তর দেওয়া বাকি আছে। আপনি কি নিশ্চিতভাবে পরীক্ষা জমা দিতে চান?`)) {
        return;
      }
    } else {
      if (!confirm("আপনি কি নিশ্চিতভাবে পরীক্ষা জমা দিতে চান?")) {
        return;
      }
    }

    setIsSubmitting(true);

    const res = await submitExamAnswers({
      studentName: student.name,
      studentId: student.id,
      examKey: examId,
      examTitle: exam.title,
      examTimerMinutes: exam.timerMinutes,
      timeRemaining: secondsRemaining,
      answers: studentAnswers,
      totalQuestions: exam.questions?.length || 0,
    });

    setIsSubmitting(false);

    if (res.success) {
      sessionStorage.setItem(
        "last_result",
        JSON.stringify({
          examKey: examId,
          examTitle: exam.title,
          studentName: student.name,
          studentId: student.id,
          isLive: res.isLive,
          score: res.score,
          correct: res.correct,
          incorrect: res.incorrect,
          totalQuestions: exam.questions?.length || 0,
          answers: studentAnswers,
        })
      );
      router.push(`/exam/${examId}/result`);
    } else {
      alert("উত্তরপত্র জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
  };

  return (
    <>
      <Header />

      <main className="flex-grow max-w-5xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali">
        <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-md border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center pb-3 border-b border-slate-100 gap-2 sticky top-16 bg-white z-30 py-2">
            <div>
              <span className="text-xs sm:text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full uppercase">
                পরীক্ষা চলমান: {exam.title}
              </span>
            </div>

            <ExamTimer
              initialSeconds={secondsRemaining}
              onTimeExpire={handleFinishExam}
              onTimeUpdate={setSecondsRemaining}
            />
          </div>

          <QuestionList
            questions={exam.questions || []}
            studentAnswers={studentAnswers}
            onSelectOption={handleSelectOption}
          />

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleFinishExam}
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCheck className="w-5 h-5" />
              {isSubmitting ? "জমা হচ্ছে..." : "পরীক্ষা জমা দিন (Submit)"}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
