"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import {
  Layers,
  ChevronRight,
  ChevronLeft,
  Search,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  BookOpen,
  Lightbulb,
  ShoppingCart
} from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { getPracticeTopics, getPracticeQuestions } from "@/actions/practice-actions";
import { getLocalStudentUser, loginWithGoogle } from "@/lib/student-auth";
import { toBengaliDigits } from "@/lib/utils";

interface BankQ {
  id: string;
  q: string;
  opts: string[];
  correct: number;
  exp?: string;
  subject?: string;
  topic?: string;
}

export default function QuestionBankPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string; name: string; email?: string } | null>(null);
  const [topics, setTopics] = useState<{ name: string; count: number }[]>([]);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");

  const [selectedTopic, setSelectedTopic] = useState(searchParams?.get("topic") || "");
  const [questions, setQuestions] = useState<BankQ[]>([]);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");

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

  const openTopic = async (topic: string) => {
    if (!user) return;
    setBusy(true);
    setLoadError("");
    setRevealed(new Set());
    try {
      const qs = await getPracticeQuestions(topic, 50, user.uid, user.email);
      if (!qs || qs.length === 0) {
        setLoadError("এই টপিকে এখনো কোনো প্রশ্ন যোগ হয়নি। অন্য টপিক বেছে নিন।");
        setBusy(false);
        return;
      }
      setQuestions(qs);
      setSelectedTopic(topic);
      window.scrollTo({ top: 0 });
    } catch {
      setLoadError("প্রশ্ন লোড করা যায়নি। আবার চেষ্টা করুন।");
    }
    setBusy(false);
  };

  const toggleReveal = (idx: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const revealAll = () => {
    setRevealed(new Set(questions.map((_, i) => i)));
  };

  const optLabels = ["ক", "খ", "গ", "ঘ"];
  const filteredTopics = topics.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <>
      <Header />

      <main className="flex-grow max-w-4xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-5">
        {/* Page header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-700 to-violet-800 text-white rounded-3xl p-5 sm:p-7 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black leading-tight">প্রশ্নব্যাংক</h1>
              <p className="text-xs sm:text-sm text-indigo-100">
                টপিক ও চ্যাপ্টারভিত্তিক প্রশ্ন — প্রতিটি প্রশ্নের সঠিক উত্তর ও ব্যাখ্যাসহ বিস্তারিত পড়ুন
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
              <h3 className="text-base font-black text-slate-900">প্রশ্নব্যাংক দেখতে Google লগইন করুন</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                এনরোল্ড শিক্ষার্থীরাই চ্যাপ্টারভিত্তিক প্রশ্নব্যাংক পড়তে পারেন। লগইন করলেই টপিকের
                তালিকা খুলে যাবে।
              </p>
            </div>
            <button
              type="button"
              onClick={() => loginWithGoogle(undefined, "/question-bank")}
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
            <p className="text-sm font-bold text-slate-800">প্রশ্নব্যাংক শুধু এনরোল্ড স্টুডেন্টদের জন্য</p>
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

        {/* Topic list */}
        {user && enrolled === true && questions.length === 0 && (
          <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" /> টপিক/চ্যাপ্টার বেছে নিন ({toBengaliDigits(topics.length)})
            </h2>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="টপিক খুঁজুন..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {topics.length === 0 && !loadError ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> টপিক লোড হচ্ছে...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredTopics.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    disabled={busy}
                    onClick={() => openTopic(t.name)}
                    className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition text-left cursor-pointer disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-800 truncate">{t.name}</span>
                      <span className="text-xs text-slate-400 font-semibold">
                        {toBengaliDigits(t.count)}টি প্রশ্ন
                      </span>
                    </span>
                    <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center shrink-0 transition">
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  </button>
                ))}
                {filteredTopics.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-6 col-span-full">কোনো টপিক পাওয়া যায়নি</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Reading detail */}
        {questions.length > 0 && (
          <section className="space-y-4">
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setQuestions([]);
                    setSelectedTopic("");
                  }}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> সব টপিক
                </button>
                <h2 className="font-black text-slate-900 text-sm sm:text-base truncate mt-1">{selectedTopic}</h2>
                <p className="text-xs text-slate-400 font-semibold">{toBengaliDigits(questions.length)}টি প্রশ্ন</p>
              </div>
              <button
                type="button"
                onClick={revealAll}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <Eye className="w-4 h-4" /> সব উত্তর দেখুন
              </button>
            </div>

            <div className="space-y-3">
              {questions.map((q, idx) => {
                const isOpen = revealed.has(idx);
                return (
                  <div key={q.id || idx} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                    <p className="text-sm font-bold text-slate-900 leading-relaxed">
                      {toBengaliDigits(idx + 1)}. {q.q}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">
                      {q.opts.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                            isOpen && oIdx === q.correct
                              ? "border-emerald-300 bg-emerald-50 text-emerald-950 font-bold"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 bg-slate-800 text-white">
                            {optLabels[oIdx]}
                          </span>
                          <span>{opt}</span>
                          {isOpen && oIdx === q.correct && (
                            <span className="ml-auto text-emerald-700 font-bold shrink-0">✓ সঠিক</span>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleReveal(idx)}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      {isOpen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {isOpen ? "উত্তর লুকান" : "সঠিক উত্তর ও ব্যাখ্যা দেখুন"}
                    </button>

                    {isOpen && q.exp && (
                      <div className="mt-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-slate-700 leading-relaxed flex gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-amber-900">ব্যাখ্যা:</strong> {q.exp}
                        </span>
                      </div>
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
