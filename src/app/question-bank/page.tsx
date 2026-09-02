"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  ShoppingCart,
  ArrowUpDown,
  FolderTree
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getPracticeTopics, getPracticeQuestions } from "@/actions/practice-actions";
import { verifyTeacherSession } from "@/actions/admin-actions";
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

interface TopicEntry {
  name: string;
  count: number;
  segs: string[];
}

export default function QuestionBankPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string; name: string; email?: string } | null>(null);
  const [entries, setEntries] = useState<TopicEntry[]>([]);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  const [questions, setQuestions] = useState<BankQ[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [sortBy, setSortBy] = useState<"count" | "name">("count");
  const [prefix, setPrefix] = useState<string[]>([]); // টপিক পাথ (যেমন ['বাংলা', 'ব্যাকরণ'])

  useEffect(() => {
    const u = getLocalStudentUser();
    setUser(u);
    if (!u) return;

    (async () => {
      try {
        // শিক্ষক/অ্যাডমিন — এনরোলমেন্ট ছাড়াই পুরো প্রশ্নব্যাংকে প্রবেশ
        const teacher = await verifyTeacherSession();
        if (!teacher.ok) {
          const { verifyStudentAccess } = await import("@/actions/student-actions");
          const access = await verifyStudentAccess(u.uid, "ALL", u.email);
          setEnrolled(access.allowed);
          if (!access.allowed) return;
        } else {
          setEnrolled(true);
        }
        const t = await getPracticeTopics(u.uid, u.email);
        setEntries(
          (t || []).map((x: { name: string; count: number }) => ({
            name: x.name,
            count: x.count,
            segs: String(x.name || "")
              .split(/\s*[>›/|]\s*/)
              .map((s) => s.trim())
              .filter(Boolean)
          }))
        );
      } catch {
        setLoadError("সার্ভার থেকে তথ্য লোড করা যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      }
    })();
  }, []);

  const hasHierarchy = useMemo(() => entries.some((e) => e.segs.length > 1), [entries]);
  const prefixPath = prefix.join(" > ");

  // বর্তমান স্তরের (বা prefix-এর) নিচের টপিক/সাবটপিক
  const levelNodes = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const map = new Map<string, number>();
    const add = (label: string, count: number) => map.set(label, (map.get(label) || 0) + count);

    if (!hasHierarchy) {
      entries
        .filter((e) => !q || e.name.toLowerCase().includes(q))
        .forEach((e) => add(e.name, e.count));
    } else if (prefix.length === 0) {
      entries
        .filter((e) => !q || e.segs[0].toLowerCase().includes(q))
        .forEach((e) => add(e.segs[0], e.count));
    } else {
      const pl = prefix.length;
      entries
        .filter((e) => {
          if (e.segs.length <= pl) return false;
          for (let i = 0; i < pl; i++) if (e.segs[i] !== prefix[i]) return false;
          return !q || e.segs[pl].toLowerCase().includes(q);
        })
        .forEach((e) => add(e.segs[pl], e.count));
    }

    const nodes = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
    if (sortBy === "count") nodes.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "bn"));
    else nodes.sort((a, b) => a.name.localeCompare(b.name, "bn") || b.count - a.count);
    return nodes;
  }, [entries, prefix, filter, sortBy, hasHierarchy]);

  // prefix-এর অধীনে মোট প্রশ্ন সংখ্যা (সাবটপিকসহ)
  const prefixTotal = useMemo(() => {
    if (!hasHierarchy || prefix.length === 0) return 0;
    const pl = prefix.length;
    return entries
      .filter((e) => e.segs.length >= pl && e.segs.slice(0, pl).every((s, i) => s === prefix[i]))
      .reduce((sum, e) => sum + e.count, 0);
  }, [entries, prefix, hasHierarchy]);

  const openTopic = async (topic: string) => {
    if (!user) return;
    setBusy(true);
    setLoadError("");
    setRevealed(new Set());
    try {
      const qs = await getPracticeQuestions(topic, 50, user.uid, user.email);
      if (!qs || qs.length === 0) {
        setLoadError(
          "এই টপিকে বর্তমানে দেখানোর মতো প্রশ্ন পাওয়া যায়নি। নির্ধারিত (লাইভ) পরীক্ষার প্রশ্ন ফলাফল প্রকাশের আগে প্রশ্নব্যাংকে দেখানো হয় না — অন্য টপিক দেখুন।"
        );
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

  const backToList = () => {
    setQuestions([]);
    setSelectedTopic("");
    setPrefix([]);
    setFilter("");
    setLoadError("");
  };

  const toggleReveal = (idx: number) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const revealAll = () => setRevealed(new Set(questions.map((_, i) => i)));

  const optLabels = ["ক", "খ", "গ", "ঘ"];

  return (
    <>
      <Header />

      <main className="flex-grow max-w-4xl w-full mx-auto p-3 sm:p-5 md:p-6 font-bengali space-y-5">
        {/* Page header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black leading-tight tracking-tight">প্রশ্নব্যাংক</h1>
              <p className="text-xs sm:text-sm text-slate-400">
                টপিক ও চ্যাপ্টারভিত্তিক প্রশ্ন — সঠিক উত্তর ও ব্যাখ্যাসহ বিস্তারিত পড়ুন
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

        {/* ============ Topic / subtopic browsing ============ */}
        {user && enrolled === true && questions.length === 0 && (
          <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-600" />
                {hasHierarchy && prefix.length > 0
                  ? prefixPath
                  : "টপিক / চ্যাপ্টার নির্বাচন করুন"}
              </h2>

              {/* Sort control */}
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
                <button
                  type="button"
                  onClick={() => setSortBy("count")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    sortBy === "count" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                  }`}
                >
                  বেশি প্রশ্ন আগে
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("name")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    sortBy === "name" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
                  }`}
                >
                  নাম অনুযায়ী
                </button>
              </div>
            </div>

            {/* Breadcrumb / back */}
            {hasHierarchy && prefix.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={backToList}
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> সব টপিক
                </button>
                <button
                  type="button"
                  onClick={() => setPrefix((p) => p.slice(0, -1))}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded-lg cursor-pointer"
                >
                  ← এক ধাপ পেছনে
                </button>
                {prefixTotal > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => openTopic(prefixPath)}
                    className="ml-auto inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-lg cursor-pointer disabled:opacity-60"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> এই টপিকসহ সব প্রশ্ন ({toBengaliDigits(prefixTotal)})
                  </button>
                )}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="টপিক/সাবটপিক খুঁজুন..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {entries.length === 0 && !loadError ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> টপিক লোড হচ্ছে...
              </div>
            ) : levelNodes.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">কোনো টপিক পাওয়া যায়নি</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {levelNodes.map((n) => {
                  const isLeaf = hasHierarchy && prefix.length + 1 >= (entries.find((e) => e.segs[prefix.length] === n.name)?.segs.length ?? 2);
                  return (
                    <button
                      key={n.name}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!hasHierarchy || prefix.length + 1 >= Math.max(...entries.filter((e) => e.segs[prefix.length] === n.name).map((e) => e.segs.length))) {
                          // লিফ (সর্বশেষ স্তর) বা ফ্ল্যাট — সরাসরি প্রশ্ন খুলি
                          openTopic(hasHierarchy ? [...prefix, n.name].join(" > ") : n.name);
                        } else {
                          setPrefix((p) => [...p, n.name]);
                          setFilter("");
                          setLoadError("");
                        }
                      }}
                      className="group flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition text-left cursor-pointer disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-800 truncate">{n.name}</span>
                        <span className="text-xs text-slate-400 font-semibold">
                          {toBengaliDigits(n.count)}টি প্রশ্ন
                          {hasHierarchy && !isLeaf && " (সাবটপিক আছে)"}
                        </span>
                      </span>
                      <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center shrink-0 transition">
                        {hasHierarchy && !isLeaf ? <ChevronRight className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {!hasHierarchy && (
              <p className="text-xs text-slate-400">
                💡 টপিক নির্বাচন করলে সেই টপিকের সব প্রশ্ন উত্তর/ব্যাখ্যাসহ দেখাবে
              </p>
            )}
          </section>
        )}

        {/* ============ Reading detail ============ */}
        {questions.length > 0 && (
          <section className="space-y-4">
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={backToList}
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
