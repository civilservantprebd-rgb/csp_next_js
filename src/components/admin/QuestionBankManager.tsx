"use client";

import React, { useState, useEffect } from "react";
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
import { BulkQuestionImporterModal } from "./BulkQuestionImporterModal";
import { AIQuestionGeneratorModal } from "./AIQuestionGeneratorModal";
import { TopicTreeSelector } from "./TopicTreeSelector";

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
  const [queryText, setQueryText] = useState("");
  const [filterTopic, setFilterTopic] = useState("ALL");
  const [filterSubject, setFilterSubject] = useState("ALL");

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
  const [moveSubtopic, setMoveSubtopic] = useState("");
  const [isMoving, setIsMoving] = useState(false);

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

    setIsMoving(true);
    const { bulkMoveQuestionsToTopic } = await import("@/actions/admin-actions");
    const ok = await bulkMoveQuestionsToTopic(selectedIds, moveTopic, moveSubtopic);
    setIsMoving(false);

    if (ok) {
      alert(`সফলভাবে ${toBengaliDigits(selectedIds.length)}টি প্রশ্নের টপিক পরিবর্তন করা হয়েছে!`);
      setSelectedIds([]);
      fetchBankQuestions();
      onRefresh();
    } else {
      alert("টপিক পরিবর্তন করতে সমস্যা হয়েছে।");
    }
  };

  const fetchBankQuestions = async () => {
    setIsLoading(true);
    const res = await searchQuestionBank(queryText, filterTopic, filterSubject);
    setQuestions(res.questions || []);
    setTotalQuestions(res.total || 0);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchBankQuestions();
  }, [queryText, filterTopic, filterSubject]);

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
      topic: selectedTopic || undefined
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

  return (
    <div className="space-y-6 font-bengali">
      {/* Top Banner with bulk upload */}
      <div className="bg-amber-50 p-4 sm:p-5 rounded-2xl border border-amber-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">অপশন ১ (ক)</label>
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">অপশন ২ (খ)</label>
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">অপশন ৩ (গ)</label>
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">অপশন ৪ (ঘ)</label>
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

        {/* Hierarchical Topic Selector */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <TopicTreeSelector
            selectedTopicPath={selectedTopic}
            onSelectTopicPath={(path) => setSelectedTopic(path)}
            topics={topics}
            onTopicsUpdated={() => {
              onRefresh();
              fetchBankQuestions();
            }}
            label="প্রশ্ন ব্যাংকের টপিক ও সাব-টপিক নির্ধারণ"
            helperText="টপিক নির্বাচন করুন অথবা যেকোনো স্তরে নতুন সাব-টপিক যোগ করুন"
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

            <select
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-white text-slate-700 font-medium"
            >
              <option value="ALL">সকল টপিক</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Action Toolbar if items selected */}
        {selectedIds.length > 0 && (
          <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-indigo-950">
              ✓ {toBengaliDigits(selectedIds.length)}টি প্রশ্ন নির্বাচিত
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={moveTopic}
                onChange={(e) => setMoveTopic(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs font-semibold text-slate-800"
              >
                <option value="">নতুন টপিক নির্বাচন করুন</option>
                {topics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="সাবটপিক (ঐচ্ছিক)"
                value={moveSubtopic}
                onChange={(e) => setMoveSubtopic(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-xs w-36"
              />

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
                        {toBengaliDigits(idx + 1)}. {q.q}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {q.topic && (
                          <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold">
                            {q.topic}
                          </span>
                        )}
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

                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                  {q.opts.map((opt: string, oIdx: number) => (
                    <div key={oIdx} className={`flex items-center gap-1 truncate ${oIdx === q.correct ? "text-emerald-700 font-bold" : ""}`}>
                      <span className="text-slate-400 font-medium">
                        {oIdx === 0 ? "ক)" : oIdx === 1 ? "খ)" : oIdx === 2 ? "গ)" : "ঘ)"}
                      </span>
                      <span className="truncate">{opt}</span>
                    </div>
                  ))}
                </div>

                {q.exp && (
                  <p className="text-[10px] text-slate-500 bg-white p-2 rounded-lg border border-slate-100 leading-relaxed">
                    <strong>ব্যাখ্যা:</strong> {q.exp}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
