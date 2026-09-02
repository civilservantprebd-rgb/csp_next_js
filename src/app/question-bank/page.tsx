"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import {
  Layers,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  BookOpen,
  Lightbulb,
  ShoppingCart,
  SearchCheck
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

const optLabels = ["ক", "খ", "গ", "ঘ"];

export default function QuestionBankPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ uid: string; name: string; email?: string } | null>(null);
  const [entries, setEntries] = useState<TopicEntry[]>([]);
  const [enrolled, setEnrolled] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessId, setAccessId] = useState("");
  const [accessEmail, setAccessEmail] = useState("");

  // ড্রপডাউন স্টেট
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");

  // রিডিং স্টেট
  const [questions, setQuestions] = useState<BankQ[]>([]);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const u = getLocalStudentUser();
    setUser(u);
    if (!u) return;

    (async () => {
      try {
        const teacher = await verifyTeacherSession();
        // কার্যকর পরিচয়: Google uid/email-ই প্রথম। এতে এনরোলমেন্ট না মিললে
        // আগে যাচাই-কৃত (ফোন/ম্যানুয়াল) পরিচয় দিয়ে চেষ্টা — পুরনো
        // ইমেইলবিহীন ফোন-এনরোলমেন্টের শিক্ষার্থীরাও যেন প্রশ্ন পড়তে পারেন।
        let effId = u.uid;
        let effEmail = u.email;
        if (!teacher.ok) {
          const { verifyStudentAccess } = await import("@/actions/student-actions");
          let access = await verifyStudentAccess(u.uid, "ALL", u.email);
          if (!access.allowed) {
            const { getVerifiedStudent } = await import("@/lib/student-identity");
            const verified = getVerifiedStudent();
            if (verified && verified.id && verified.id !== u.uid) {
              const alt = await verifyStudentAccess(verified.id, "ALL", verified.email);
              if (alt.allowed) {
                access = alt;
                effId = verified.id;
                effEmail = verified.email || "";
              }
            }
          }
          setEnrolled(access.allowed);
          if (!access.allowed) return;
        } else {
          setEnrolled(true);
        }
        setAccessId(effId);
        setAccessEmail(effEmail || "");
        const t = await getPracticeTopics(effId, effEmail);
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

  // বিষয় (স্তর-১) অপশন
  const subjectOptions = useMemo(() => {
    if (!hasHierarchy) return [];
    const map = new Map<string, number>();
    entries.forEach((e) => map.set(e.segs[0], (map.get(e.segs[0]) || 0) + e.count));
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "bn"));
  }, [entries, hasHierarchy]);

  // নির্বাচিত বিষয়ের অধীনে টপিক অপশন (পূর্ণ পাথ) + "সব টপিক"
  const topicOptions = useMemo(() => {
    if (!hasHierarchy) {
      return entries
        .map((e) => ({ name: e.name, count: e.count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "bn"));
    }
    const list = subject ? entries.filter((e) => e.segs[0] === subject) : entries;
    return list
      .map((e) => ({ name: e.name, count: e.count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "bn"));
  }, [entries, subject, hasHierarchy]);

  // "প্রশ্ন দেখুন" কী দিয়ে খুলবে
  const fetchValue = useMemo(() => {
    if (hasHierarchy) {
      // টপিক বাছাই করা থাকলে সেটা (পূর্ণ পাথ), নইলে পুরো বিষয় (সাবটপিকসহ)
      return topic || subject || "";
    }
    return topic || entries[0]?.name || "";
  }, [hasHierarchy, subject, topic, entries]);

  const subjectTotal = useMemo(() => {
    if (!hasHierarchy) return entries.reduce((s, e) => s + e.count, 0);
    if (!subject) return entries.reduce((s, e) => s + e.count, 0);
    return entries.filter((e) => e.segs[0] === subject).reduce((s, e) => s + e.count, 0);
  }, [entries, subject, hasHierarchy]);

  // সাবজেক্ট বদলালে পুরনো টপিক রিসেট
  useEffect(() => {
    setTopic("");
  }, [subject]);

  // "সব বিষয়" অপশন নেই — প্রথম বিষয়টিই ডিফল্ট
  useEffect(() => {
    if (hasHierarchy && subject === "" && subjectOptions.length > 0) {
      setSubject(subjectOptions[0].name);
    }
  }, [hasHierarchy, subject, subjectOptions]);

  const openTopic = async (value: string, label: string) => {
    if (!user || !value) return;
    setBusy(true);
    setLoadError("");
    setRevealed(new Set());
    try {
      const qs = await getPracticeQuestions(value, 50, accessId || user.uid, accessEmail || user.email);
      if (!qs || qs.length === 0) {
        setLoadError(
          "এই নির্বাচনে বর্তমানে দেখানোর মতো প্রশ্ন পাওয়া যায়নি — নির্ধারিত (লাইভ) পরীক্ষার প্রশ্ন ফলাফল প্রকাশের আগে প্রশ্নব্যাংকে দেখানো হয় না। অন্য বিষয়/টপিক বেছে নিন।"
        );
        setBusy(false);
        return;
      }
      setQuestions(qs);
      setSelectedLabel(label);
      window.scrollTo({ top: 0 });
    } catch {
      setLoadError("প্রশ্ন লোড করা যায়নি। আবার চেষ্টা করুন।");
    }
    setBusy(false);
  };

  const handleBrowse = () => {
    const value = fetchValue;
    if (!value) {
      setLoadError("একটি বিষয়/টপিক নির্বাচন করুন।");
      return;
    }
    const label = hasHierarchy
      ? topic
        ? topic
        : subject
        ? `${subject} (সব সাবটপিক)`
        : "সব বিষয়"
      : topic;
    openTopic(value, label);
  };

  const backToBank = () => {
    setQuestions([]);
    setLoadError("");
    setRevealed(new Set());
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

  const selectCls =
    "w-full appearance-none pl-3.5 pr-9 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm";

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
                বিষয় ও টপিক বেছে নিন — সঠিক উত্তর ও ব্যাখ্যাসহ বিস্তারিত পড়ুন
              </p>
            </div>
          </div>
        </div>

        {/* gates */}
        {!user && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center">
              <LogIn className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">প্রশ্নব্যাংক দেখতে Google লগইন করুন</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                এনরোল্ড শিক্ষার্থীরাই চ্যাপ্টারভিত্তিক প্রশ্নব্যাংক পড়তে পারেন।
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

        {/* ============ প্রফেশনাল ড্রপডাউন ব্যার ============ */}
        {user && enrolled === true && questions.length === 0 && (
          <section className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                <SearchCheck className="w-5 h-5 text-indigo-600" /> প্রশ্ন খুঁজুন
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                মোট {toBengaliDigits(subjectTotal)}টি প্রশ্ন
              </span>
            </div>

            {entries.length === 0 && !loadError ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-xs font-bold">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> লোড হচ্ছে...
              </div>
            ) : (
              <>
                {/* Selector bar */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_auto] gap-3 items-end">
                  {hasHierarchy && (
                    <label className="block">
                      <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                        বিষয় (Subject)
                      </span>
                      <span className="relative block">
                        <select value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls}>
                          {subjectOptions.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name} ({toBengaliDigits(s.count)}টি)
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </span>
                    </label>
                  )}

                  <label className="block">
                    <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
                      টপিক (Topic)
                    </span>
                    <span className="relative block">
                      <select
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className={selectCls}
                        disabled={topicOptions.length === 0}
                      >
                        {hasHierarchy ? (
                          <option value="">{subject ? `${subject} — সব টপিক` : "সব বিষয় — সব টপিক"}</option>
                        ) : (
                          <option value="">সব টপিক</option>
                        )}
                        {topicOptions.map((t) => (
                          <option key={t.name} value={t.name}>
                            {hasHierarchy && subject ? t.name.replace(`${subject} > `, "") : t.name} (
                            {toBengaliDigits(t.count)}টি)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={busy || entries.length === 0}
                    onClick={handleBrowse}
                    className="h-[42px] w-full sm:w-auto px-7 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl text-sm shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4" /> প্রশ্ন দেখুন
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  💡 বিষয় বাছাই করলে সেই বিষয়ের সব সাবটপিকের প্রশ্ন দেখা যাবে; টপিক বাছাই করলে শুধু ওই টপিকের।
                </p>
              </>
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
                  onClick={backToBank}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                >
                  ← প্রশ্নব্যাংকে ফিরে যান
                </button>
                <h2 className="font-black text-slate-900 text-sm sm:text-base truncate mt-1">{selectedLabel}</h2>
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
