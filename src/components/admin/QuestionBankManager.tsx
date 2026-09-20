"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Exam, QuestionItem, QuestionSolution, SubjectItem } from "@/types/exam";
import {
  addQuestionToBank,
  updateQuestionInBank,
  deleteQuestionFromBank,
  searchQuestionBank,
  saveAppConfig
} from "@/actions/admin-actions";
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Layers,
  Tag,
  Upload,
  BookOpen,
  Search,
  Loader2,
  X,
  Sparkles
} from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";
import { MathText } from "@/lib/MathText";
import { BulkQuestionImporterModal } from "./BulkQuestionImporterModal";
import { AIQuestionGeneratorModal } from "./AIQuestionGeneratorModal";
import { TopicTreeSelector } from "./TopicTreeSelector";

/** প্রশ্নব্যাংকের এক পেজে কতটি প্রশ্ন — ছোট পেজ = কম ডাউনলোড, দ্রুত রেন্ডার */
const BANK_PAGE_SIZE = 25;

interface QuestionBankManagerProps {
  topics: string[];
  subjects: SubjectItem[];
  onRefresh: () => void;
}

export const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({
  topics = [],
  subjects = [],
  onRefresh,
}) => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  // পেজিনেশন — এক পেজে কেবল এতগুলো সারি ডাউনলোড হয় (আগে সার্ভার ১০০-এ কেটে
  // দিত, ব্যবহারকারী জানতেনই না আরও প্রশ্ন আছে)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [queryText, setQueryText] = useState("");
  // টপিক ফিল্টার এখন দুই ধাপে: রুট টপিক → সাব-টপিক (আগে একটাই ড্রপডাউনে পুরো
  // পাথ থাকত, তাই "বাংলা"-র সব প্রশ্ন দেখতে প্রতিটি সাব-টপিক আলাদা করে বাছতে হত)।
  const [filterTopic, setFilterTopic] = useState("ALL");
  const [filterSubtopic, setFilterSubtopic] = useState("ALL");
  const [filterSubject, setFilterSubject] = useState("ALL");
  // সাম্প্রতিক টগল — সবচেয়ে নতুন যোগ হওয়া প্রশ্ন আগে দেখায়
  const [recentOnly, setRecentOnly] = useState(false);

  const [questionText, setQuestionText] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [isAddingNewTopic, setIsAddingNewTopic] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [opt0, setOpt0] = useState("");
  const [opt1, setOpt1] = useState("");
  const [opt2, setOpt2] = useState("");
  const [opt3, setOpt3] = useState("");
  const [correctIdx, setCorrectIdx] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveTopic, setMoveTopic] = useState("");
  // সাব-টপিক এখন ড্রপডাউন থেকে (আগে ফ্রি-টেক্সট ইনপুট ছিল, তাই আগের টপিকের
  // ভুল বানান/ভিন্ন পাথ সহজেই ঢুকে পড়ত)। তবু নতুন সাব-টপিক বসানোর সুযোগ রাখা
  // হয়েছে — ড্রপডাউনে "নতুন সাব-টপিক লিখুন" বাছলে টেক্সট ইনপুট খোলে।
  const [moveSubtopic, setMoveSubtopic] = useState("");
  const [moveSubtopicNew, setMoveSubtopicNew] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  /** মুভ করার সময় সত্যিই যে সাব-টপিক বসবে (নতুন লিখলে সেটাই) */
  const effectiveMoveSubtopic = moveSubtopic === "__new__" ? moveSubtopicNew : moveSubtopic;

  const [allTopics, setAllTopics] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === questions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(questions.map((q) => q.id));
    }
  };

  const handleBulkMove = async () => {
    if (!moveTopic.trim()) {
      alert("অনুগ্রহ করে একটি টপিক নির্বাচন করুন।");
      return;
    }
    if (selectedIds.length === 0) {
      alert("কোনো প্রশ্ন সিলেক্ট করা হয়নি।");
      return;
    }
    if (moveSubtopic === "__new__" && !moveSubtopicNew.trim()) {
      alert("নতুন সাব-টপিকের নাম লিখুন, অথবা ড্রপডাউন থেকে একটি সাব-টপিক বাছুন।");
      return;
    }

    const subToApply = effectiveMoveSubtopic.trim();
    if (
      !confirm(
        `নির্বাচিত ${toBengaliDigits(selectedIds.length)}টি প্রশ্ন ` +
          `"${subToApply ? `${moveTopic} > ${subToApply}` : moveTopic}" টপিকে সরানো হবে। ঠিক আছে?`
      )
    )
      return;

    setIsMoving(true);
    const { bulkMoveQuestionsToTopic } = await import("@/actions/admin-actions");
    const ok = await bulkMoveQuestionsToTopic(selectedIds, moveTopic, subToApply);
    setIsMoving(false);

    if (ok) {
      alert(`সফলভাবে ${toBengaliDigits(selectedIds.length)}টি প্রশ্নের টপিক পরিবর্তন করা হয়েছে!`);
      setSelectedIds([]);
      setMoveSubtopic("");
      setMoveSubtopicNew("");
      fetchBankQuestions();
      onRefresh();
    } else {
      alert("টপিক পরিবর্তন করতে সমস্যা হয়েছে।");
    }
  };

  const searchSeqRef = useRef(0);

  /** সার্ভারে যে টপিক পাঠানো হবে: সাব-টপিক বাছা থাকলে সেটাই, নাহলে রুট টপিক */
  const effectiveTopic = filterSubtopic !== "ALL" ? filterSubtopic : filterTopic;

  const fetchBankQuestions = async (debouncedQuery = queryText, pageArg = page) => {
    const seq = ++searchSeqRef.current;
    setIsLoading(true);
    try {
      // সার্ভার-সাইড সার্চ + ফিল্টার + পেজিনেশন — কেবল ওই পেজের সারি আসে
      const res = await searchQuestionBank(
        debouncedQuery,
        effectiveTopic,
        filterSubject,
        recentOnly,
        pageArg,
        BANK_PAGE_SIZE
      );
      // Only apply the result if it belongs to the LATEST request — a slow
      // response for an older keystroke must not overwrite a newer one.
      if (seq === searchSeqRef.current) {
        const list = res.questions || [];
        // শেষ পেজের সব প্রশ্ন মুছে ফেললে আগের পেজে ফিরি (নাহলে খালি পেজ আটকে থাকত)
        if (list.length === 0 && pageArg > 1 && res.total > 0) {
          void fetchBankQuestions(debouncedQuery, Math.min(pageArg - 1, res.totalPages || 1));
          return;
        }
        setQuestions(list);
        setTotalQuestions(res.total || 0);
        setTotalPages(res.totalPages || 1);
        setPage(pageArg);
      }
    } catch (err) {
      // No inline error state exists in this component (other flows alert), so
      // log the failure and keep the previous results; the finally below still
      // resets the loading spinner so the search UI never hangs.
      console.error("Question bank search failed:", err);
    } finally {
      if (seq === searchSeqRef.current) setIsLoading(false);
    }
  };

  /** পেজ বদলানো — সিলেকশন মুছে যায়, যাতে এক পেজের "সব সিলেক্ট" অন্য পেজে গিয়ে ভুল না করে */
  const goToPage = (target: number) => {
    const next = Math.min(Math.max(1, target), Math.max(1, totalPages));
    if (next === page) return;
    setSelectedIds([]);
    void fetchBankQuestions(queryText, next);
  };

  // Debounce the search so every keystroke doesn't fire a full ilike scan.
  // সার্চ/ফিল্টার বদলালে সবসময় প্রথম পেজে ফিরে যাই।
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchBankQuestions(queryText, 1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryText, filterTopic, filterSubtopic, filterSubject, recentOnly]);

  // Load the complete topic structure (from every source) into the tree picker
  const refreshTreeData = () => {
    import("@/actions/admin-actions")
      .then(({ getTopicTreeData }) => getTopicTreeData())
      .then((d) => setAllTopics(d.topics))
      .catch(() => {
        // tree picker simply falls back to the props-provided topics
      });
  };

  useEffect(() => {
    refreshTreeData();
  }, []);

  const mergedTopics = Array.from(new Set([...topics, ...allTopics]));

  /**
   * টপিক-হায়ারার্কি (রুট → সাব-টপিক) — ক্যাসকেড ফিল্টারের জন্য।
   *
   * প্রতিটি রেজিস্টার্ড টপিক-পাথ ("বাংলা > প্রাচীন যুগ > চর্যাপদ") ভেঙে
   * প্রথম অংশ = রুট টপিক, প্রথম দুই অংশ = সাব-টপিক। গভীর পাথ (৩ স্তরের) তার
   * ২-স্তরের প্যারেন্টের নিচেই দেখানো হয় — আর সার্ভার-ফিল্টার উপ-টপিকসহ ম্যাচ
   * করে, তাই প্যারেন্ট বাছলেই ভেতরের সব প্রশ্ন চলে আসে।
   */
  const { topicRoots, subtopicsByRoot } = useMemo(() => {
    const roots = new Set<string>();
    const subMap = new Map<string, Set<string>>();

    mergedTopics.forEach((raw) => {
      const segs = String(raw || "")
        .split(/\s*[>›/|]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs.length === 0) return;
      const root = segs[0];
      roots.add(root);
      if (segs.length >= 2) {
        const sub = `${segs[0]} > ${segs[1]}`;
        if (!subMap.has(root)) subMap.set(root, new Set());
        subMap.get(root)!.add(sub);
      }
    });

    const sortedRoots = Array.from(roots).sort((a, b) => a.localeCompare(b, "bn"));
    return { topicRoots: sortedRoots, subtopicsByRoot: subMap };
  }, [mergedTopics]);

  /** বাছা রুট টপিকের সাব-টপিক তালিকা (কিছু না থাকলে খালি) */
  const subtopicOptions = useMemo(() => {
    if (filterTopic === "ALL" || filterTopic === "সাধারণ") return [];
    const set = subtopicsByRoot.get(filterTopic);
    return set ? Array.from(set).sort((a, b) => a.localeCompare(b, "bn")) : [];
  }, [filterTopic, subtopicsByRoot]);

  /**
   * প্রশ্ন **মুভ** করার সময় ব্যবহারের জন্য: রুট টপিক → তার সব নিচের স্তরের
   * sub-path ("পরিবেশ", "পরিবেশ > চুক্তি", …)। সার্ভার-অ্যাকশন টপিক আর
   * সাব-টপিক জুড়ে দেয় (`root > sub`), তাই গভীর স্তরও এভাবেই ঠিকঠাক বসে।
   */
  const descendantsByRoot = useMemo(() => {
    const map = new Map<string, Set<string>>();
    mergedTopics.forEach((raw) => {
      const segs = String(raw || "")
        .split(/\s*[>›/|]\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segs.length < 2) return;
      const root = segs[0];
      if (!map.has(root)) map.set(root, new Set());
      map.get(root)!.add(segs.slice(1).join(" > "));
    });
    return map;
  }, [mergedTopics]);

  /** মুভ-ড্রপডাউনে দেখানো সাব-টপিক (বাছা নতুন টপিক অনুযায়ী) */
  const moveSubtopicOptions = useMemo(() => {
    const set = descendantsByRoot.get(moveTopic);
    return set ? Array.from(set).sort((a, b) => a.localeCompare(b, "bn")) : [];
  }, [moveTopic, descendantsByRoot]);

  const handleQuickAddTopic = async () => {
    const val = newTopicInput.trim();
    if (!val) return;

    if (topics.includes(val)) {
      setSelectedTopic(val);
      setNewTopicInput("");
      setIsAddingNewTopic(false);
      return;
    }

    const nextTopics = [...topics, val];
    await saveAppConfig({ topics: nextTopics });
    setSelectedTopic(val);
    setNewTopicInput("");
    setIsAddingNewTopic(false);
    onRefresh();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    const qItem: Omit<QuestionItem, "id"> = {
      q: questionText.trim(),
      opts: [opt0.trim(), opt1.trim(), opt2.trim(), opt3.trim()],
      topic: selectedTopic || "সাধারণ"
    };

    const sol: QuestionSolution = {
      correct: correctIdx,
      exp: explanation.trim()
    };

    setIsLoading(true);
    let success = false;
    if (editingId) {
      success = await updateQuestionInBank(editingId, { ...qItem, id: editingId }, sol);
    } else {
      success = await addQuestionToBank(qItem, sol);
    }
    setIsLoading(false);

    if (success) {
      // Clear form
      setQuestionText("");
      setOpt0("");
      setOpt1("");
      setOpt2("");
      setOpt3("");
      setCorrectIdx(0);
      setExplanation("");
      setSelectedTopic("");
      setEditingId(null);
      
      fetchBankQuestions();
      onRefresh();
    } else {
      alert("সংরক্ষণ করতে সমস্যা হয়েছে।");
    }
  };

  const startEdit = (q: any) => {
    setEditingId(q.id);
    setQuestionText(q.q);
    setOpt0(q.opts[0] || "");
    setOpt1(q.opts[1] || "");
    setOpt2(q.opts[2] || "");
    setOpt3(q.opts[3] || "");
    setCorrectIdx(Number(q.correct || 0));
    setExplanation(q.exp || "");
    setSelectedTopic(q.topic || "");
  };

  const handleDelete = async (id: string) => {
    if (confirm("আপনি কি নিশ্চিতভাবে এই প্রশ্নটি ডিলিট করতে চান? এটি ডিলিট করলে এটি যেসব পরীক্ষায় রয়েছে সেখান থেকেও রিমুভ হয়ে যেতে পারে।")) {
      setIsLoading(true);
      const success = await deleteQuestionFromBank(id);
      setIsLoading(false);
      if (success) {
        fetchBankQuestions();
        onRefresh();
      } else {
        alert("ডিলিট করতে সমস্যা হয়েছে।");
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setQuestionText("");
    setOpt0("");
    setOpt1("");
    setOpt2("");
    setOpt3("");
    setCorrectIdx(0);
    setExplanation("");
    setSelectedTopic("");
  };

  // Delete a topic node — its questions move to "সাধারণ" (nothing is deleted)
  const handleDeleteTopicNode = async (path: string) => {
    if (path === "সাধারণ") {
      alert("সাধারণ টপিক ডিলিট করা যাবে না — এটা টপিকছাড়া প্রশ্নের ডিফল্ট গন্তব্য।");
      return;
    }
    if (!confirm(`"${path}" টপিকটি ডিলিট করবেন?\n\nএই টপিকের (ও এর সাব-টপিকের) প্রশ্নগুলো ডিলিট হবে না — "সাধারণ" টপিকে চলে যাবে, সেখান থেকে আবার টপিক দেওয়া যাবে।`)) return;
    setIsLoading(true);
    const { deleteTopicNode } = await import("@/actions/admin-actions");
    const res = await deleteTopicNode(path);
    setIsLoading(false);
    if (res.success) {
      alert(`✅ ডিলিট সম্পন্ন! ${res.moved ?? 0}টি প্রশ্ন "সাধারণ" টপিকে স্থানান্তরিত হয়েছে।`);
      fetchBankQuestions();
      refreshTreeData();
      onRefresh();
    } else {
      alert(res.message || "ডিলিট করতে সমস্যা হয়েছে।");
    }
  };

  // Rename a topic node — descendants keep their relative depth
  const handleRenameTopicNode = async (path: string) => {
    if (path === "সাধারণ") {
      alert("সাধারণ টপিক রিনেম করা যাবে না।");
      return;
    }
    const segments = path.split(">").map((s) => s.trim()).filter(Boolean);
    const nodeName = segments[segments.length - 1] || path;
    const newName = prompt(`"${nodeName}" টপিকের নতুন নাম দিন:`, nodeName);
    if (!newName || !newName.trim()) return;
    if (newName.trim() === nodeName) return;
    const parentPath = segments.slice(0, -1).join(" > ");
    const newPath = parentPath ? `${parentPath} > ${newName.trim()}` : newName.trim();
    if (newPath === path) return;
    setIsLoading(true);
    const { renameTopicNode } = await import("@/actions/admin-actions");
    const res = await renameTopicNode(path, newPath);
    setIsLoading(false);
    if (res.success) {
      alert(`✅ রিনেম সম্পন্ন! ${res.renamed ?? 0}টি প্রশ্ন আপডেট হয়েছে।`);
      fetchBankQuestions();
      refreshTreeData();
      onRefresh();
    } else {
      alert(res.message || "রিনেম করতে সমস্যা হয়েছে।");
    }
  };

  return (
    <div className="space-y-6 font-bengali">
      {/* Top Banner with bulk upload */}
      <div className="bg-amber-50 p-4 sm:p-5 rounded-2xl border border-amber-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
            সেন্ট্রাল ডাটাবেজ
          </span>
          <h3 className="font-bold text-amber-900 text-sm sm:text-base mt-1">সেন্ট্রাল প্রশ্ন ব্যাংক ভাণ্ডার</h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap md:ml-auto">
          <button
            type="button"
            onClick={() => setIsAIModalOpen(true)}
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
            <span>AI দিয়ে প্রশ্ন তৈরি</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBulkModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>প্রশ্ন ব্যাংকে বাল্ক আপলোড</span>
          </button>
        </div>
      </div>

      <AIQuestionGeneratorModal
        isOpen={isAIModalOpen}
        topics={topics}
        onClose={() => setIsAIModalOpen(false)}
        onSuccess={async () => {
          fetchBankQuestions();
          onRefresh();
        }}
      />

      <BulkQuestionImporterModal
        isOpen={isBulkModalOpen}
        topics={topics}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={async () => {
          fetchBankQuestions();
          onRefresh();
        }}
      />

      {/* Add / Edit Form */}
      <form onSubmit={handleSave} className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2 border-b pb-2">
          <BookOpen className="w-4 h-4 text-amber-600" />
          {editingId ? "প্রশ্ন এডিট করুন" : "প্রশ্ন ব্যাংকে সরাসরি নতুন প্রশ্ন যোগ করুন"}
        </h4>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">প্রশ্নের বিবরণ</label>
          <textarea
            required
            rows={2}
            placeholder="প্রশ্ন এখানে লিখুন..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">অপশন ১ (ক)</label>
            <input
              type="text"
              required
              placeholder="প্রথম অপশন"
              value={opt0}
              onChange={(e) => setOpt0(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">অপশন ২ (খ)</label>
            <input
              type="text"
              required
              placeholder="দ্বিতীয় অপশন"
              value={opt1}
              onChange={(e) => setOpt1(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">অপশন ৩ (গ)</label>
            <input
              type="text"
              required
              placeholder="তৃতীয় অপশন"
              value={opt2}
              onChange={(e) => setOpt2(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">অপশন ৪ (ঘ)</label>
            <input
              type="text"
              required
              placeholder="চতুর্থ অপশন"
              value={opt3}
              onChange={(e) => setOpt3(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">সঠিক উত্তর</label>
            <select
              value={correctIdx}
              onChange={(e) => setCorrectIdx(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white font-medium text-slate-800"
            >
              <option value={0}>অপশন ১ (ক)</option>
              <option value={1}>অপশন ২ (খ)</option>
              <option value={2}>অপশন ৩ (গ)</option>
              <option value={3}>অপশন ৪ (ঘ)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1">ব্যাখ্যা (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="প্রশ্নের বিস্তারিত ব্যাখ্যা বা নোট এখানে লিখুন..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
        </div>

        {/* Hierarchical Topic Selector — কোনো বাক্স নেই; সব টপিক একসাথে দেখা যায় */}
        <div>
          <TopicTreeSelector
            selectedTopicPath={selectedTopic}
            onSelectTopicPath={(path) => setSelectedTopic(path)}
            topics={mergedTopics}
            onTopicsUpdated={() => {
              refreshTreeData();
              onRefresh();
              fetchBankQuestions();
            }}
            onDeleteNode={handleDeleteTopicNode}
            onRenameNode={handleRenameTopicNode}
            label="প্রশ্ন ব্যাংকের টপিক ও সাব-টপিক নির্ধারণ"
            helperText="টপিক নির্বাচন করুন, নতুন সাব-টপিক যোগ করুন, অথবা ✏️/🗑 দিয়ে নাম বদলান/ডিলিট করুন (প্রশ্ন 'সাধারণ'-এ যাবে)"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {editingId ? "প্রশ্নটি আপডেট করুন" : "প্রশ্ন ব্যাংকে সংরক্ষণ করুন"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
            >
              বাতিল
            </button>
          )}
        </div>
      </form>

      {/* Filters & Question list from bank */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
            প্রশ্ন ব্যাংক ভাণ্ডার ({toBengaliDigits(totalQuestions)} টি প্রশ্ন):
            {recentOnly && (
              <span className="ml-2 text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full align-middle">
                🕒 সাম্প্রতিক — নতুন যোগ হওয়া আগে
              </span>
            )}
          </h4>

          {/* Filters Area */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="প্রশ্ন খুঁজুন..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50"
              />
            </div>

            {/* টপিক → সাব-টপিক: আলাদা দুটি ড্রপডাউন (ক্যাসকেড)।
                রুট টপিক বাছলেই তার সব উপ-টপিকের প্রশ্ন আসে; নির্দিষ্ট সাব-টপিক
                বাছলে কেবল সেটির (ও তার ভেতরের) প্রশ্ন। */}
            <select
              value={filterTopic}
              onChange={(e) => {
                setFilterTopic(e.target.value);
                setFilterSubtopic("ALL");
              }}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium max-w-[190px]"
              title="মূল টপিক বাছুন"
            >
              <option value="ALL">সকল টপিক</option>
              <option value="সাধারণ">সাধারণ (টপিকছাড়া)</option>
              {topicRoots.map((t) => (
                <option key={t} value={t}>
                  📂 {t}
                </option>
              ))}
            </select>

            <select
              value={filterSubtopic}
              onChange={(e) => setFilterSubtopic(e.target.value)}
              disabled={subtopicOptions.length === 0}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium max-w-[230px] disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                subtopicOptions.length === 0
                  ? "সাব-টপিক নেই — আগে একটি মূল টপিক বাছুন"
                  : "নির্দিষ্ট সাব-টপিক বাছুন"
              }
            >
              <option value="ALL">
                {filterTopic === "ALL"
                  ? "সাব-টপিক (আগে টপিক বাছুন)"
                  : subtopicOptions.length === 0
                    ? "সাব-টপিক নেই"
                    : "সব সাব-টপিক"}
              </option>
              {subtopicOptions.map((s) => (
                <option key={s} value={s}>
                  ↳ {s.split(" > ").slice(1).join(" > ")}
                </option>
              ))}
            </select>

            {/* সাম্প্রতিক টগল — নতুন যোগ হওয়া প্রশ্ন আগে */}
            <button
              type="button"
              onClick={() => setRecentOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition cursor-pointer shadow-sm ${
                recentOnly
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
              title={recentOnly ? "সাধারণ ক্রমে ফিরুন" : "সবচেয়ে নতুন যোগ হওয়া প্রশ্নগুলো আগে দেখুন"}
            >
              🕒 সাম্প্রতিক
            </button>
          </div>
        </div>

        {/* Bulk Action Toolbar if items selected */}
        {selectedIds.length > 0 && (
          <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-indigo-950">
              ✓ {toBengaliDigits(selectedIds.length)}টি প্রশ্ন নির্বাচিত
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {/* নতুন টপিক → তারপর সাব-টপিক: আলাদা দুটি ড্রপডাউন (আগে একটাই
                  ফুল-পাথ লিস্ট + একটা ফ্রি-টেক্সট বক্স ছিল, তাই ভুল পাথ সহজেই
                  ঢুকে পড়ত)। সাব-টপিক খালি রাখলে প্রশ্ন শুধু মূল টপিকে যাবে। */}
              <select
                value={moveTopic}
                onChange={(e) => {
                  const nextTopic = e.target.value;
                  // টপিক বদলালে সাব-টপিক রিসেট — নইলে আগের টপিকের সাব-টপিক
                  // নতুন টপিকের সাথে জোড়া লেগে ভুল পাথ তৈরি করত
                  setMoveTopic(nextTopic);
                  setMoveSubtopic("");
                  setMoveSubtopicNew("");
                }}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-semibold text-slate-800 max-w-[200px]"
                title="প্রশ্নগুলো যে টপিকে যাবে"
              >
                <option value="">নতুন টপিক নির্বাচন করুন</option>
                <option value="সাধারণ">সাধারণ (টপিকছাড়া)</option>
                {topicRoots.map((t) => (
                  <option key={t} value={t}>
                    📂 {t}
                  </option>
                ))}
              </select>

              <select
                value={moveSubtopic}
                onChange={(e) => {
                  setMoveSubtopic(e.target.value);
                  if (e.target.value !== "__new__") setMoveSubtopicNew("");
                }}
                disabled={!moveTopic || moveTopic === "সাধারণ"}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-semibold text-slate-800 max-w-[230px] disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  !moveTopic || moveTopic === "সাধারণ"
                    ? "সাব-টপিকের জন্য আগে একটি মূল টপিক বাছুন"
                    : "সাব-টপিক (খালি রাখলে শুধু মূল টপিকে যাবে)"
                }
              >
                <option value="">— সাব-টপিক ছাড়া —</option>
                {moveSubtopicOptions.map((s) => (
                  <option key={s} value={s}>
                    ↳ {s}
                  </option>
                ))}
                <option value="__new__">✏️ নতুন সাব-টপিক লিখুন…</option>
              </select>

              {moveSubtopic === "__new__" && (
                <input
                  type="text"
                  autoFocus
                  placeholder="নতুন সাব-টপিকের নাম"
                  value={moveSubtopicNew}
                  onChange={(e) => setMoveSubtopicNew(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs w-44"
                />
              )}

              {/* কোথায় যাবে — এক নজরে, ভুল টপিক যেন চোখে পড়ে */}
              {moveTopic && (
                <span className="text-[11px] font-bold text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-xl max-w-[260px] truncate">
                  → {effectiveMoveSubtopic.trim() ? `${moveTopic} > ${effectiveMoveSubtopic.trim()}` : moveTopic}
                </span>
              )}

              <button
                type="button"
                onClick={handleBulkMove}
                disabled={isMoving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer"
              >
                {isMoving ? "পরিবর্তন হচ্ছে..." : "মুভ করুন"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (
                    !confirm(
                      `আপনি কি নির্বাচিত ${toBengaliDigits(selectedIds.length)}টি প্রশ্ন মুছে আর্কাইভে পাঠাতে চান?`
                    )
                  )
                    return;
                  setIsMoving(true);
                  const { bulkDeleteQuestionsFromBank } = await import("@/actions/admin-actions");
                  const ok = await bulkDeleteQuestionsFromBank(selectedIds);
                  setIsMoving(false);
                  if (ok) {
                    alert("নির্বাচিত প্রশ্নগুলো সফলভাবে মুছে আর্কাইভে পাঠানো হয়েছে!");
                    setSelectedIds([]);
                    fetchBankQuestions();
                    onRefresh();
                  } else {
                    alert("মুছে ফেলতে সমস্যা হয়েছে।");
                  }
                }}
                disabled={isMoving}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>সিলেক্টেড মুছুন ({toBengaliDigits(selectedIds.length)})</span>
              </button>
            </div>
          </div>
        )}

        {/* Question Cards list */}
        <div className="space-y-3">
          {questions.length > 0 && (
            <div className="flex items-center gap-2 pb-1">
              <input
                type="checkbox"
                id="select_all_q"
                checked={selectedIds.length === questions.length && questions.length > 0}
                onChange={handleSelectAll}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="select_all_q" className="text-xs text-slate-600 font-bold cursor-pointer select-none">
                সবগুলো সিলেক্ট করুন ({toBengaliDigits(questions.length)}টি)
              </label>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-12 text-slate-400 text-xs gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
              <span>লোড হচ্ছে...</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              প্রশ্ন ব্যাংকে কোনো প্রশ্ন পাওয়া যায়নি।
            </div>
          ) : (
            questions.map((q, idx) => (
              <div
                key={q.id || idx}
                className={`p-4 rounded-2xl border transition space-y-2 ${
                  selectedIds.includes(q.id)
                    ? "border-indigo-400 bg-indigo-50/40"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 text-xs sm:text-sm leading-relaxed">
                        {toBengaliDigits(idx + 1)}. <MathText text={q.q} />
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className="text-xs bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                          {q.topic || "সাধারণ"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => startEdit(q)}
                      className="bg-white hover:bg-amber-50 text-amber-600 border border-amber-200 p-1.5 rounded-lg text-xs transition cursor-pointer"
                      title="সম্পাদনা করুন"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 p-1.5 rounded-lg text-xs transition cursor-pointer"
                      title="ডিলিট করুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1 text-sm text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                  {q.opts.map((opt: string, oIdx: number) => (
                    <div key={oIdx} className={`flex items-center gap-1 truncate ${oIdx === q.correct ? "text-emerald-700 font-bold" : ""}`}>
                      <span className="text-slate-400 font-medium">
                        {oIdx === 0 ? "ক)" : oIdx === 1 ? "খ)" : oIdx === 2 ? "গ)" : "ঘ)"}
                      </span>
                      <span className="truncate"><MathText text={opt} /></span>
                    </div>
                  ))}
                </div>

                {q.exp && (
                  <p className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-100 leading-relaxed whitespace-pre-wrap">
                    <strong>ব্যাখ্যা:</strong> <MathText text={q.exp} />
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* পেজিনেশন — সার্ভার-সাইড, তাই ১০ হাজার প্রশ্নেও পেজ বদলানো 순식간 */}
        {questions.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">
              {toBengaliDigits((page - 1) * BANK_PAGE_SIZE + 1)}–
              {toBengaliDigits(Math.min(page * BANK_PAGE_SIZE, totalQuestions))} দেখানো হচ্ছে,
              মোট {toBengaliDigits(totalQuestions)}টি
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => goToPage(1)}
                  disabled={page <= 1 || isLoading}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  প্রথম
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || isLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  ← পূর্ববর্তী
                </button>
                <span className="px-2 text-xs font-black text-slate-700">
                  পৃষ্ঠা {toBengaliDigits(page)} / {toBengaliDigits(totalPages)}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || isLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  পরবর্তী →
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(totalPages)}
                  disabled={page >= totalPages || isLoading}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  শেষ
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
