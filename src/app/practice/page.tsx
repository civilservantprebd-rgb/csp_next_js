"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import {
  Sparkles,
  PlayCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Loader2,
  Lock,
  LogIn,
  BookOpen,
  ShoppingCart
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { getPracticeTopics, getPracticeQuestions } from "@/actions/practice-actions";
import { getLocalStudentUser, loginWithGoogle } from "@/lib/student-auth";
import { toBengaliDigits, shuffleArray } from "@/lib/utils";

interface PracticeQ {
  id: string;
  q: string;
  opts: string[];
  correct: number;
  exp?: string;
  subject?: string;
  topic?: string;
}

export default function PracticePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string; name: string; email?: string } | null>(null);
  const [topics, setTopics] = useState<{ name: string; count: number }[]>([]);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");

  const [selectedTopic, setSelectedTopic] = useState(searchParams?.get("topic") || "");
  const [questions, setQuestions] = useState<PracticeQ[]>([]);
  const [phase, setPhase] = useState<"topics" | "quiz" | "done">("topics");
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = getLocalStudentUser();
    setUser(u);
    if (!u) return;

    (async () => {
      try {
        const { verifyStudentAccess } = await import("@/actions/student-actions");
        const access = await verifyStudentAccess(u.uid, "ALL", u.email);
        setEnrolled(access.allowed);
        if (!access.allowed) return;
        const t = await getPracticeTopics();
        setTopics(t || []);
      } catch {
        setLoadError("সার্ভার থেকে তথ্য লোড করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      }
    })();
  }, []);

  const startTopic = async (topic: string) => {
    if (!user) return;
    setBusy(true);
    setLoadError("");
    try {
      const qs = await getPracticeQuestions(topic, 20, user.uid, user.email);
      if (!qs || qs.length === 0) {
        setLoadError("এই টপিকে বর্তমানে দেখানোর মতো প্রশ্ন পাওয়া যায়নি — নির্ধারিত (লাইভ) পরীক্ষার প্রশ্ন ফলাফল প্রকাশের আগে এখানে দেখানো হয় না। অন্য টপিক বেছে নিন।");
        setBusy(false);
        return;
      }
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(undefined));
      setQIdx(0);
      setSelectedTopic(topic);
      setPhase("quiz");
      window.scrollTo({ top: 0 });
    } catch {
      setLoadError("প্রশ্ন লোড করা যায়নি। আবার চেষ্টা করুন।");
    }
    setBusy(false);
  };

  const finishQuiz = () => setPhase("done");

  const restartQuiz = () => {
    const shuffled = shuffleArray([...questions]);
    setQuestions(shuffled);
    setAnswers(new Array(shuffled.length).fill(undefined));
    setQIdx(0);
    setPhase("quiz");
  };

  const optLabels = ["ক", "খ", "গ", "ঘ"];
  const total = questions.length;
  const answeredCount = answers.filter((a) => a !== undefined).length;
  const scoreData = questions.map((q, i) => ({
    q,
    isCorrect: answers[i] !== undefined && answers[i] === q.correct
  }));
  const correctCount = scoreData.filter((s) => s.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  return (
    <>
      <Header />

      <main className="flex-grow max-w-4xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-5">
        {/* Page header */}
        <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 text-white rounded-3xl p-5 sm:p-7 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black leading-tight">সেলফ প্র্যাকটিস</h1>
              <p className="text-xs sm:text-sm text-teal-100">
                নিজের পছন্দের বিষয়/টপিকে খেলার মতো অনুশীলন — সাথে সঙ্গে উত্তর ও ব্যাখ্যা
              </p>
            </div>
          </div>
        </div>

        {!user && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
              <LogIn className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">প্র্যাকটিস করতে Google লগইন করুন</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                এনরোল্ড শিক্ষার্থীরাই সেলফ প্র্যাকটিস করতে পারেন। Google দিয়ে লগইন করলেই টপিকের
                তালিকা খুলে যাবে।
              </p>
            </div>
            <button
              type="button"
              onClick={() => loginWithGoogle(undefined, "/practice")}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-3 rounded-2xl text-sm cursor-pointer"
            >
              Google দিয়ে লগইন করুন
            </button>
          </div>
        )}

        {user && enrolled === false && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800">প্র্যাকটিস শুধু এনরোল্ড স্টুডেন্টদের জন্য</p>
            <p className="text-xs text-slate-500">
              যেকোনো একটি কোর্সে এনরোল করে শিক্ষকের অনুমোদন পেলে এই সেকশন খুলে যাবে।
            </p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem("open_enroll", "1");
                router.push("/");
              }}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-sm cursor-pointer transition shadow-sm"
            >
              <ShoppingCart className="w-4 h-4" /> কোর্স এনরোল করুন
            </button>
          </div>
        )}

        {user && enrolled === null && (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> এক্সেস যাচাই হচ্ছে...
          </div>
        )}

        {loadError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-2xl">{loadError}</div>
        )}

        {user && enrolled === true && phase === "topics" && (
          <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-teal-600" /> টপিক বেছে নিন ({toBengaliDigits(topics.length)})
            </h2>
            {topics.length === 0 && !loadError ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> টপিক লোড হচ্ছে...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {topics.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    disabled={busy}
                    onClick={() => startTopic(t.name)}
                    className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/40 transition text-left cursor-pointer disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800 truncate">{t.name}</span>
                      <span className="text-xs text-slate-400 font-semibold">
                        {toBengaliDigits(t.count)}টি প্রশ্ন
                      </span>
                    </span>
                    <span className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 group-hover:bg-teal-600 group-hover:text-white flex items-center justify-center shrink-0 transition">
                      <PlayCircle className="w-4 h-4" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {phase === "quiz" && questions.length > 0 && (
          <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-black text-slate-900 text-sm sm:text-base truncate">{selectedTopic}</h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {toBengaliDigits(qIdx + 1)} / {toBengaliDigits(total)}
              </span>
            </div>

            {/* progress */}
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
                style={{ width: `${(answeredCount / total) * 100}%` }}
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-base font-bold text-slate-900 leading-relaxed">
                {toBengaliDigits(qIdx + 1)}. {questions[qIdx].q}
              </p>
              <div className="grid grid-cols-1 gap-2 mt-3">
                {questions[qIdx].opts.map((opt, oIdx) => {
                  const chosen = answers[qIdx] === oIdx;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => {
                        if (answers[qIdx] !== undefined) return;
                        const next = [...answers];
                        next[qIdx] = oIdx;
                        setAnswers(next);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition cursor-pointer ${
                        chosen
                          ? "border-teal-500 bg-teal-50 text-teal-950 font-bold"
                          : answers[qIdx] !== undefined
                          ? "border-slate-200 bg-white text-slate-400"
                          : "border-slate-200 bg-white hover:border-teal-400"
                      }`}
                    >
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                        {optLabels[oIdx]}
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setQIdx((i) => Math.max(0, i - 1))}
                disabled={qIdx === 0}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" /> আগের
              </button>
              <span className="text-xs text-slate-400 font-semibold">
                উত্তর দেওয়া: {toBengaliDigits(answeredCount)}/{toBengaliDigits(total)}
              </span>
              {qIdx < total - 1 ? (
                <button
                  type="button"
                  onClick={() => setQIdx((i) => Math.min(total - 1, i + 1))}
                  disabled={answers[qIdx] === undefined}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                >
                  পরের <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finishQuiz}
                  disabled={answeredCount < total}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40 transition"
                >
                  <Trophy className="w-4 h-4" /> ফলাফল দেখুন
                </button>
              )}
            </div>
          </section>
        )}

        {phase === "done" && (
          <section className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 border border-teal-200 mx-auto flex items-center justify-center">
                <Trophy className="w-7 h-7" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">অনুশীলন সম্পন্ন! 🎉</h2>
              <p className="text-xs text-slate-500">
                টপিক: {selectedTopic} · মোট {toBengaliDigits(total)}টি প্রশ্ন
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <span className="text-xs text-emerald-700 block font-semibold">সঠিক</span>
                <span className="text-lg font-black text-emerald-800">{toBengaliDigits(correctCount)}</span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <span className="text-xs text-rose-700 block font-semibold">ভুল</span>
                <span className="text-lg font-black text-rose-800">{toBengaliDigits(total - correctCount)}</span>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
                <span className="text-xs text-indigo-700 block font-semibold">সঠিকতার হার</span>
                <span className="text-lg font-black text-indigo-800">{toBengaliDigits(accuracy)}%</span>
              </div>
            </div>

            <button
              type="button"
              onClick={restartQuiz}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <RotateCcw className="w-4 h-4" /> আবার অনুশীলন করুন
            </button>

            <div className="space-y-2.5 pt-1">
              {questions.map((q, i) => {
                const correct = answers[i] !== undefined && answers[i] === q.correct;
                return (
                  <div
                    key={q.id || i}
                    className={`p-3.5 rounded-2xl border ${
                      correct ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900 leading-relaxed">
                      {toBengaliDigits(i + 1)}. {q.q}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${
                          correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {correct ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {correct ? "সঠিক" : `ভুল (আপনার: ${answers[i] !== undefined ? optLabels[answers[i]!] : "দেওয়া হয়নি"})`}
                      </span>
                      <span className="text-emerald-700 font-semibold">
                        সঠিক উত্তর: {optLabels[q.correct]} ({q.opts[q.correct]})
                      </span>
                    </div>
                    {q.exp && (
                      <p className="mt-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700 leading-relaxed">
                        <strong className="text-amber-900">ব্যাখ্যা:</strong> {q.exp}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  );
}
