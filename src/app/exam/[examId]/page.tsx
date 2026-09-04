"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { ExamTimer } from "@/components/exam/ExamTimer";
import { QuestionList } from "@/components/exam/QuestionList";
import { fetchExamWithQuestions, fetchExamForDemo } from "@/actions/admin-actions";
import { submitExamAnswers } from "@/actions/exam-actions";
import { parseBangladeshDateTime, getTrueNowMs, isExamCurrentlyLive, syncBangladeshNetworkTime } from "@/lib/bangladesh-time";
import { Exam } from "@/types/exam";
import { CheckCheck, Loader2, X, AlertCircle, CheckCircle2, Send, RotateCcw } from "lucide-react";
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
  // ডেমো মোড (শিক্ষক টেস্ট) — কোনো ফলাফল সেভ হয় না
  const [demoMode, setDemoMode] = useState(false);
  const [demoResult, setDemoResult] = useState<{ correct: number; incorrect: number; skipped: number; total: number } | null>(null);
  // প্রশ্ন লোড হলেও টাইমার চালু হয় না — "পরীক্ষা শুরু করুন" ট্যাপে চালু হয়
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";

    // ---- ডেমো মোড: শিক্ষক নিজে পরীক্ষাটি টেস্ট করেন (ফলাফল সেভ হয় না) ----
    if (isDemo) {
      if (!sessionStorage.getItem("teacher_user")) {
        alert("ডেমো পরীক্ষা শুধু শিক্ষক অ্যাকাউন্ট থেকে দেওয়া যায়। আগে শিক্ষক হিসেবে লগইন করুন।");
        router.push("/");
        return;
      }
      (async () => {
        try {
          import("@/lib/bangladesh-time").then(({ syncBangladeshNetworkTime }) => syncBangladeshNetworkTime());
          const ex = await fetchExamForDemo(examId);
          if (!ex) {
            alert("পরীক্ষাটি পাওয়া যায়নি (শিক্ষক-যাচাই ব্যর্থ বা প্রশ্ন নেই)।");
            router.push("/");
            return;
          }
          setDemoMode(true);
          setStudent({ id: "demo-teacher", name: "ডেমো (শিক্ষক)" });
          setExam(ex);
          setStudentAnswers(new Array(ex.questions?.length || 0).fill(null));
          // টাইমার "পরীক্ষা শুরু করুন" ট্যাপে beginExam()-এ চালু হবে
        } catch {
          alert("ডেমো পরীক্ষা শুরু করা যায়নি।");
          router.push("/");
        }
      })();
      return;
    }

    const rawStudent = sessionStorage.getItem("current_student");
    if (!rawStudent) {
      // শেয়ার করা লিংক থেকে এলেও লগইনের পর এই পরীক্ষাতেই ফিরতে ইনটেন্ট সেভ
      try { sessionStorage.setItem("target_exam_intent", examId); } catch { /* ignore */ }
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
      try { sessionStorage.setItem("target_exam_intent", examId); } catch { /* ignore */ }
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
      // (ফাস্ট-পাথ: ব্রাউজার ক্যাশে থাকলে সাথে সাথে ব্লক; নাহলে সার্ভার চেক — লজিক অপরিবর্তিত)
      if (isExamCurrentlyLive(ex)) {
        const { checkAttemptBlocked } = await import("@/lib/exam-attempt-cache");
        const already = await checkAttemptBlocked(examId, parsedStudent.id);
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
      // টাইমার এখনো চালু নয় — "পরীক্ষা শুরু করুন" ট্যাপ করলে beginExam()-এ চালু হবে
    });
  }, [examId, router]);

  const handleSelectOption = (qIdx: number, optIdx: number) => {
    if (studentAnswers[qIdx] !== null) return;
    const next = [...studentAnswers];
    next[qIdx] = optIdx;
    setStudentAnswers(next);
  };

  // ---- "পরীক্ষা শুরু করুন" ট্যাপ: টাইমার এখানেই চালু হয় (প্রশ্ন আগেই লোড) ----
  const beginExam = async () => {
    if (!exam || started || secondsRemaining !== null) return;
    // ডিভাইস ঘড়ি নয় — বাংলাদেশ (নেটওয়ার্ক-সিঙ্কড) সময়ে হিসাব নিশ্চিত করি
    try { await syncBangladeshNetworkTime(); } catch { /* fallback */ }
    let duration = (exam.timerMinutes || 10) * 60;
    if (!demoMode && isExamCurrentlyLive(exam) && exam.endTime) {
      const endTime = parseBangladeshDateTime(exam.endTime);
      if (endTime) {
        const remainingLiveSecs = Math.floor((endTime.getTime() - getTrueNowMs()) / 1000);
        if (remainingLiveSecs > 0) duration = Math.min(duration, remainingLiveSecs);
      }
    }
    setSecondsRemaining(Math.max(1, duration));
    setStarted(true);
  };

  const doSubmit = async (timeRemaining: number) => {
    if (isSubmitting || !exam || !student) return;
    setIsSubmitting(true);

    // ---- ডেমো: লোকালি স্কোর করি — কোথাও সেভ হয় না ----
    if (demoMode) {
      const qs = exam.questions || [];
      let correct = 0;
      let incorrect = 0;
      let skipped = 0;
      studentAnswers.forEach((a, i) => {
        const q = qs[i];
        if (a === null || a === undefined) skipped++;
        else if (q && a === Number((q as { correct?: number }).correct ?? 0)) correct++;
        else incorrect++;
      });
      setDemoResult({ correct, incorrect, skipped, total: qs.length });
      setIsSubmitting(false);
      return;
    }

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
      // একবার সাবমিশন সফল — ক্যাশে চিহ্নিত রাখি যেন পরের চেষ্টায় সাথে সাথে ওয়ার্নিং আসে
      try {
        const { markExamAttempted } = await import("@/lib/exam-attempt-cache");
        markExamAttempted(student.id, examId);
      } catch {
        // cache optional — সার্ভার চেকই চূড়ান্ত
      }
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

  if (!exam || !student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 p-4 font-bengali">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto animate-pulse">
            <Loader2 className="w-9 h-9 animate-spin" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">প্রশ্ন লোড হচ্ছে…</h1>
            <p className="text-xs text-slate-500 font-bold mt-1.5 leading-relaxed">
              আপনার পরীক্ষার প্রশ্নগুলো নিরাপদে সার্ভার থেকে আনা হচ্ছে — এক মুহূর্ত ধৈর্য ধরুন।
            </p>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 space-y-2 text-left">
            {[
              "শিরোনাম, সময় ও প্রশ্ন যাচাই হচ্ছে",
              "আপনার অ্যাকাউন্টের অনুমতি নিশ্চিত হচ্ছে",
              "প্রশ্ন প্রস্তুত হলে টাইমার শুরু হবে"
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center shrink-0">
                  {toBengaliDigits(i + 1)}
                </span>
                {step}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 font-bold">
            🔒 প্রশ্ন সুরক্ষিত — যাচাইকৃত সেশনে প্রশ্ন আসে, অন্যদের কাছে দেখা যায় না
          </p>
        </div>
      </div>
    );
  }

  // ---- প্রশ্ন প্রস্তুত — "পরীক্ষা শুরু করুন" গেট (টাইমার তখনই চালু হয়) ----
  if (!started || secondsRemaining === null) {
    const totalQ = exam.questions?.length || 0;
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 p-4 font-bengali">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{exam.title}</h1>
            <p className="text-[11px] text-slate-500 font-bold">
              {exam.course} | {exam.subject} | {toBengaliDigits(totalQ)} প্রশ্ন | {toBengaliDigits(exam.timerMinutes)} মিনিট
              {exam.isFree ? " | ফ্রি" : ""}
            </p>
          </div>

          {demoMode && (
            <div className="bg-violet-50 border border-violet-200 text-violet-900 text-[11px] font-bold rounded-xl px-3 py-2.5">
              🧪 ডেমো মোড — শিক্ষক টেস্ট: ফলাফল সেভ হবে না
            </div>
          )}

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-left space-y-2">
            {[
              "প্রশ্ন লোড সম্পন্ন হয়েছে ✓",
              "নিচের বাটনে ট্যাপ করলেই টাইমার চালু হবে",
              "প্রস্তুত হয়ে নিন — সময় হলে আর পেছানো যাবে না"
            ].map((line, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-slate-700 font-bold">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center shrink-0">
                  {toBengaliDigits(i + 1)}
                </span>
                {line}
              </div>
            ))}
          </div>

          {totalQ === 0 ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl px-3 py-2.5">
              ⚠️ এই পরীক্ষায় এখনো কোনো প্রশ্ন যোগ করা হয়নি।
            </div>
          ) : (
            <button
              type="button"
              onClick={beginExam}
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm transition shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> পরীক্ষা শুরু করুন
            </button>
          )}

          <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
            🔒 প্রশ্ন নিরাপদে লোড হয়েছে — ট্যাপের পরই টাইমার চলবে
            {!demoMode && isExamCurrentlyLive(exam) && exam.endTime ? " (লাইভ শেষ হওয়া পর্যন্ত সময় সীমিত)" : ""}
          </p>
        </div>
      </main>
    );
  }

  // ---- ডেমো ফলাফল স্ক্রিন (শিক্ষক টেস্ট — সেভ হয় না) ----
  if (demoResult) {
    const pct = demoResult.total > 0 ? Math.round((demoResult.correct / demoResult.total) * 100) : 0;
    const passed = exam.passMark ? demoResult.correct >= exam.passMark : pct >= 40;
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-950 p-4 font-bengali">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 space-y-5">
          <div className="text-center space-y-2">
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${passed ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
              {passed ? <CheckCircle2 className="w-9 h-9" /> : <X className="w-9 h-9" />}
            </div>
            <h1 className="text-xl font-black text-slate-900">🧪 ডেমো ফলাফল</h1>
            <p className="text-xs text-slate-500 font-bold leading-relaxed">{exam.title}</p>
          </div>

          <div className="bg-violet-50 border border-violet-200 text-violet-900 text-[11px] font-bold rounded-xl px-3 py-2.5 leading-relaxed">
            ⚠️ এটি <b>ডেমো (শিক্ষক টেস্ট)</b> — কোনো ফলাফল সেভ হয়নি, লিডারবোর্ডে প্রভাব নেই।
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { l: "সঠিক", v: demoResult.correct, c: "text-emerald-700" },
              { l: "ভুল", v: demoResult.incorrect, c: "text-rose-700" },
              { l: "বাদ", v: demoResult.skipped, c: "text-amber-700" },
              { l: "মোট", v: demoResult.total, c: "text-slate-900" }
            ].map((s) => (
              <div key={s.l} className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5">
                <div className={`text-xl font-black ${s.c}`}>{toBengaliDigits(s.v)}</div>
                <div className="text-[10px] text-slate-500 font-bold mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <div className="text-2xl font-black text-indigo-700">{toBengaliDigits(pct)}%</div>
            <p className="text-[11px] text-slate-500 font-bold">
              {passed ? "✅ উত্তীর্ণ হবে (পাস-মার্কের উপরে)" : "পাস-মার্কের নিচে"}
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setDemoResult(null);
                setStudentAnswers(new Array(exam.questions?.length || 0).fill(null));
                setSecondsRemaining(Math.max(1, (exam.timerMinutes || 10) * 60));
              }}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> আবার ডেমো দিন
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin")}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-sm transition cursor-pointer"
            >
              শিক্ষক প্যানেলে ফিরুন
            </button>
          </div>
        </div>
      </main>
    );
  }

  const totalQuestions = exam.questions?.length || 0;
  const answeredCount = studentAnswers.filter((a) => a !== null).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <>
      <main className="flex-grow max-w-5xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali">
        {demoMode && (
          <div className="mb-3 rounded-2xl bg-violet-100 border border-violet-300 text-violet-900 text-xs sm:text-sm font-black px-4 py-2.5 flex items-center gap-2">
            🧪 ডেমো মোড — শিক্ষক টেস্ট: ফলাফল সেভ হবে না, লিডারবোর্ডে প্রভাব নেই
          </div>
        )}
        <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-md border border-slate-200 space-y-6">
          {/* স্টিকি এক্সাম হেডার — মোবাইল: বামে পরীক্ষার নাম · মাঝে সাবমিট · ডানে সময় */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sticky top-0 bg-white/95 backdrop-blur-sm z-30 border-b border-slate-100 pb-3 pt-1">
            {/* Left: exam title (truncated, এক লাইনে) */}
            <div className="text-left min-w-0 flex items-center overflow-hidden">
              <span className="inline-block text-[13px] sm:text-sm md:text-base font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full truncate max-w-full leading-tight">
                {exam.title}
              </span>
            </div>

            {/* Center: Submit */}
            <div className="text-center shrink-0">
              <button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] sm:text-sm font-bold px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                {isSubmitting ? "জমা হচ্ছে..." : "জমা দিন"}
              </button>
            </div>

            {/* Right: Timer */}
            <div className="flex justify-end min-w-0">
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
