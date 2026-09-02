"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Search, Plus, Check, Loader2, BookOpen, Layers } from "lucide-react";
import { searchQuestionBank, linkQuestionToExam, getTopicTreeData } from "@/actions/admin-actions";
import { toBengaliDigits } from "@/lib/utils";

interface QuestionBankSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  examKey: string;
  existingQuestionTexts: string[];
  topics: string[];
  onSuccess: () => void;
}

interface AddedQ {
  id: string;
  q: string;
  topic?: string;
}

export const QuestionBankSearchModal: React.FC<QuestionBankSearchModalProps> = ({
  isOpen,
  onClose,
  examKey,
  existingQuestionTexts,
  topics,
  onSuccess,
}) => {
  const [queryText, setQueryText] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("ALL"); // বিষয় (স্তর-১)
  const [topicFilter, setTopicFilter] = useState(""); // সাবটপিক (পূর্ণ পাথ)
  const [topicOptions, setTopicOptions] = useState<string[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [linkingIds, setLinkingIds] = useState<Record<string, boolean>>({});
  const [addedList, setAddedList] = useState<AddedQ[]>([]);

  // টপিক-ট্রি নিজে লোড (প্রপ খালি থাকলেও)
  useEffect(() => {
    if (!isOpen) return;
    setAddedList([]);
    setQueryText("");
    getTopicTreeData()
      .then((d) => {
        const merged = Array.from(new Set([...(topics || []), ...(d?.topics || [])])).filter(Boolean);
        setTopicOptions(merged);
      })
      .catch(() => setTopicOptions(topics || []));
  }, [isOpen, topics]);

  // বিষয় / সাবটপিক তালিকা — পাথ থেকে বের করি
  const topicEntries = useMemo(
    () =>
      topicOptions.map((name) => ({
        name,
        segs: String(name)
          .split(/\s*[>›/|]\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      })),
    [topicOptions]
  );

  const subjectList = useMemo(
    () => Array.from(new Set(topicEntries.map((e) => e.segs[0]).filter(Boolean))),
    [topicEntries]
  );

  const subtopicList = useMemo(
    () => (subjectFilter === "ALL" ? topicEntries : topicEntries.filter((e) => e.segs[0] === subjectFilter)),
    [topicEntries, subjectFilter]
  );

  // সার্চ: সাবটপিক সিলেক্ট করলে ওটাই; "পুরো বিষয়" হলে ওই বিষয়ের সব সাবটপিক আলাদা করে খুঁজে মার্জ
  const performSearch = async () => {
    setIsLoading(true);
    try {
      const targets: string[] = [];
      if (subjectFilter === "ALL") {
        targets.push("");
      } else if (topicFilter) {
        targets.push(topicFilter);
      } else {
        const leaves = subtopicList.map((e) => e.name);
        if (!leaves.includes(subjectFilter)) leaves.unshift(subjectFilter);
        targets.push(...leaves);
      }

      const results = await Promise.all(
        targets.map((t) => searchQuestionBank(queryText, t === "" ? "ALL" : t))
      );
      const map = new Map<string, any>();
      results.forEach((r) =>
        (r.questions || []).forEach((q: any) => {
          if (!map.has(q.id)) map.set(q.id, q);
        })
      );
      setQuestions(Array.from(map.values()));
    } catch (err) {
      console.error("Search question bank error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      performSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subjectFilter, topicFilter]);

  if (!isOpen) return null;

  const handleLink = async (q: any) => {
    setLinkingIds((prev) => ({ ...prev, [q.id]: true }));
    const success = await linkQuestionToExam(examKey, q.id);
    setLinkingIds((prev) => ({ ...prev, [q.id]: false }));
    if (success) {
      setAddedList((prev) => {
        if (prev.some((x) => x.id === q.id)) return prev;
        return [...prev, { id: q.id, q: q.q, topic: q.topic }];
      });
      onSuccess();
    } else {
      alert("প্রশ্নটি যুক্ত করতে সমস্যা হয়েছে।");
    }
  };

  const isTextAdded = (text: string) =>
    existingQuestionTexts.some((ext) => ext.trim().toLowerCase() === String(text).trim().toLowerCase()) ||
    addedList.some((x) => x.q.trim().toLowerCase() === String(text).trim().toLowerCase());

  const shortName = (name: string) => {
    const segs = String(name).split(/\s*[>›/|]\s*/).filter(Boolean);
    return segs.length > 1 ? segs.slice(1).join(" › ") : name;
  };

  const selectCls =
    "w-full appearance-none pl-3 pr-9 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500 cursor-pointer";

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6">
        <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col my-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-slate-900">পুরনো প্রশ্ন থেকে যোগ করুন</h3>
                <p className="text-[11px] text-slate-500">বিষয় → সাবটপিক বেছে খুঁজুন — ডান পাশে যুক্ত হওয়া দেখুন</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="p-2 rounded-lg bg-white hover:bg-slate-200 text-slate-600 cursor-pointer border border-slate-200 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Controls */}
          <div className="px-4 sm:px-6 py-3 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-5 relative">
              <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">কীওয়ার্ড</span>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="প্রশ্ন লিখে খুঁজুন..."
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && performSearch()}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs sm:text-sm bg-white"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">বিষয়</span>
              <div className="relative">
                <select
                  value={subjectFilter}
                  onChange={(e) => {
                    setSubjectFilter(e.target.value);
                    setTopicFilter("");
                  }}
                  className={selectCls}
                >
                  <option value="ALL">সব বিষয়</option>
                  {subjectList.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronArrow />
              </div>
            </div>

            <div className="sm:col-span-2">
              <span className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1">সাবটপিক</span>
              <div className="relative">
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  disabled={subjectFilter === "ALL" || subtopicList.length === 0}
                  className={`${selectCls} disabled:bg-slate-100 disabled:text-slate-400`}
                >
                  <option value="">
                    {subjectFilter === "ALL" ? "সব টপিক" : "পুরো বিষয় (সব সাবটপিক)"}
                  </option>
                  {subtopicList.map((e) => (
                    <option key={e.name} value={e.name}>
                      {shortName(e.name)}
                    </option>
                  ))}
                </select>
                <ChevronArrow />
              </div>
            </div>

            <div className="sm:col-span-2">
              <button
                onClick={performSearch}
                disabled={isLoading}
                className="w-full h-[42px] bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold px-4 rounded-xl text-xs sm:text-sm shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                সার্চ
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-2.5">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">খোঁজের ফলাফল ({toBengaliDigits(questions.length)})</p>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-xs gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  <span>প্রশ্ন খোঁজা হচ্ছে...</span>
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">কোনো প্রশ্ন পাওয়া যায়নি।</div>
              ) : (
                questions.map((q) => {
                  const isAdded = isTextAdded(q.q);
                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-2xl border flex items-start gap-3 transition ${
                        isAdded ? "bg-emerald-50/40 border-emerald-200" : "bg-slate-50/50 border-slate-200 hover:border-amber-300"
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-1 text-xs text-slate-700">
                        <p className="font-bold text-slate-900 text-sm leading-relaxed">{q.q}</p>
                        {q.topic && (
                          <span className="inline-block bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-bold">
                            {q.topic}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0">
                        {isAdded ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-xl text-xs font-bold">
                            <Check className="w-3.5 h-3.5" /> যুক্ত
                          </span>
                        ) : (
                          <button
                            onClick={() => handleLink(q)}
                            disabled={linkingIds[q.id]}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            {linkingIds[q.id] ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                            যুক্ত করুন
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="lg:border-l lg:border-slate-100 lg:pl-4 space-y-2.5">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                এই পরীক্ষায় যুক্ত হচ্ছে — নতুন {toBengaliDigits(addedList.length)}টি
              </p>
              {addedList.length === 0 && existingQuestionTexts.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                  এখনো কোনো প্রশ্ন যুক্ত হয়নি। বাঁ পাশ থেকে প্রশ্নে &ldquo;যুক্ত করুন&rdquo; চাপুন।
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {addedList.map((a) => (
                    <div key={a.id} className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 flex items-start gap-2">
                      <span className="mt-0.5 shrink-0"><Plus className="w-3.5 h-3.5 text-emerald-600" /></span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 leading-relaxed">{a.q}</p>
                        {a.topic && <span className="text-[11px] text-amber-700 font-bold">{a.topic}</span>}
                      </div>
                    </div>
                  ))}
                  {existingQuestionTexts.length > 0 && (
                    <>
                      <p className="text-[11px] text-slate-400 font-bold pt-1">
                        আগে থেকেই যুক্ত ({toBengaliDigits(existingQuestionTexts.length)}টি) — ডুপ্লিকেট যুক্ত হবে না
                      </p>
                      {existingQuestionTexts.slice(0, 30).map((t, i) => (
                        <div key={i} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2">
                          <span className="mt-0.5 shrink-0"><Check className="w-3 h-3 text-emerald-600" /></span>
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{t}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-3">
            <p className="text-[11px] text-slate-400">
              {toBengaliDigits(addedList.length)}টি নতুন প্রশ্ন যুক্ত হয়েছে — এডিট-মোডালে তালিকা রিফ্রেশ হবে
            </p>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2 rounded-xl text-xs cursor-pointer"
            >
              শেষ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function ChevronArrow() {
  return <Layers className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />;
}
