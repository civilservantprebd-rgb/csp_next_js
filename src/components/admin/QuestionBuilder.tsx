"use client";

import React, { useState, useEffect } from "react";
import { Exam, QuestionItem, QuestionSolution } from "@/types/exam";
import {
  addQuestionToExam,
  updateQuestionInExam,
  deleteQuestionFromExam,
  saveAppConfig
} from "@/actions/admin-actions";
import { getExamSolutions } from "@/actions/exam-actions";
import { Plus, Trash2, Edit2, CheckCircle2, Layers, Tag, BookOpen, Upload, FileText, Sparkles } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";
import { BulkQuestionImporterModal } from "./BulkQuestionImporterModal";
import { AIQuestionGeneratorModal } from "./AIQuestionGeneratorModal";
import { QuestionBankSearchModal } from "./QuestionBankSearchModal";
import { TopicTreeSelector } from "./TopicTreeSelector";

interface QuestionBuilderProps {
  activeExamKey: string;
  exam: Exam;
  allExams?: Record<string, Exam>;
  onSelectExamKey?: (key: string) => void;
  topics?: string[];
  onRefresh: () => void;
}

export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({
  activeExamKey,
  exam,
  allExams,
  onSelectExamKey,
  topics = [],
  onRefresh,
}) => {
  const [solutions, setSolutions] = useState<QuestionSolution[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [isAddingNewTopic, setIsAddingNewTopic] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [allTopics, setAllTopics] = useState<string[]>([]);
  const [opt0, setOpt0] = useState("");
  const [opt1, setOpt1] = useState("");
  const [opt2, setOpt2] = useState("");
  const [opt3, setOpt3] = useState("");
  const [correctIdx, setCorrectIdx] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const loadSolutions = async () => {
    try {
      const data = await getExamSolutions(activeExamKey);
      setSolutions(data || []);
    } catch (err) {
      console.error("Load solutions error:", err);
    }
  };

  useEffect(() => {
    loadSolutions();
    setSelectedQuestionIndices([]);
  }, [activeExamKey]);

  // Load the complete topic structure (from every source) into the tree picker
  useEffect(() => {
    import("@/actions/admin-actions")
      .then(({ getTopicTreeData }) => getTopicTreeData())
      .then((d) => setAllTopics(d.topics))
      .catch(() => {
        // tree picker simply falls back to the props-provided topics
      });
  }, []);

  const mergedTopics = Array.from(new Set([...topics, ...allTopics]));

  const toggleSelectQuestion = (idx: number) => {
    setSelectedQuestionIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleSelectAllQuestions = () => {
    const total = exam.questions?.length || 0;
    if (selectedQuestionIndices.length === total) {
      setSelectedQuestionIndices([]);
    } else {
      setSelectedQuestionIndices(Array.from({ length: total }, (_, i) => i));
    }
  };

  const handleBulkDeleteFromExam = async () => {
    if (selectedQuestionIndices.length === 0) return;
    if (
      !confirm(
        `আপনি কি নির্বাচিত ${toBengaliDigits(selectedQuestionIndices.length)}টি প্রশ্ন মুছে আর্কাইভে পাঠাতে চান?`
      )
    )
      return;

    setIsBulkDeleting(true);
    const { bulkDeleteQuestionsFromExam } = await import("@/actions/admin-actions");
    const ok = await bulkDeleteQuestionsFromExam(activeExamKey, selectedQuestionIndices);
    setIsBulkDeleting(false);

    if (ok) {
      alert("নির্বাচিত প্রশ্নগুলো সফলভাবে মুছে আর্কাইভে পাঠানো হয়েছে!");
      setSelectedQuestionIndices([]);
      await loadSolutions();
      onRefresh();
    } else {
      alert("প্রশ্নগুলো মুছে ফেলতে সমস্যা হয়েছে।");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || !opt0.trim() || !opt1.trim() || !opt2.trim() || !opt3.trim()) {
      alert("দয়া করে প্রশ্ন ও ৪টি অপশন সঠিকভাবে পূরণ করুন।");
      return;
    }

    setIsLoading(true);
    const questionObj: QuestionItem = {
      q: questionText.trim(),
      opts: [opt0.trim(), opt1.trim(), opt2.trim(), opt3.trim()],
      topic: selectedTopic.trim() || "সাধারণ"
    };
    const solutionObj: QuestionSolution = {
      correct: Number(correctIdx),
      exp: explanation.trim(),
    };

    if (editingIndex !== null) {
      const ok = await updateQuestionInExam(activeExamKey, editingIndex, questionObj, solutionObj);
      if (!ok) {
        setIsLoading(false);
        alert("প্রশ্ন আপডেট করতে সমস্যা হয়েছে।");
        return;
      }
      setEditingIndex(null);
    } else {
      const ok = await addQuestionToExam(activeExamKey, questionObj, solutionObj);
      if (!ok) {
        setIsLoading(false);
        alert("প্রশ্ন যুক্ত করতে সমস্যা হয়েছে।");
        return;
      }
    }

    setIsLoading(false);
    resetForm();
    await loadSolutions();
    onRefresh();
  };

  const handleEdit = (idx: number) => {
    const q = exam.questions?.[idx];
    const sol = solutions[idx] || { correct: 0, exp: "" };
    if (!q) return;

    setEditingIndex(idx);
    setQuestionText(q.q);
    setSelectedTopic(q.topic || "");
    setOpt0(q.opts[0] || "");
    setOpt1(q.opts[1] || "");
    setOpt2(q.opts[2] || "");
    setOpt3(q.opts[3] || "");
    setCorrectIdx(sol.correct);
    setExplanation(sol.exp);
  };

  const handleDelete = async (idx: number) => {
    if (confirm("আপনি কি এই প্রশ্নটি মুছে ফেলতে চান?")) {
      await deleteQuestionFromExam(activeExamKey, idx);
      await loadSolutions();
      onRefresh();
    }
  };

  const resetForm = () => {
    setQuestionText("");
    // Keep selectedTopic persistent across question submissions as requested
    setIsAddingNewTopic(false);
    setNewTopicInput("");
    setOpt0("");
    setOpt1("");
    setOpt2("");
    setOpt3("");
    setCorrectIdx(0);
    setExplanation("");
    setEditingIndex(null);
  };

  return (
    <div className="space-y-6 font-bengali">
      <div className="bg-amber-50 p-4 sm:p-5 rounded-2xl border border-amber-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <span className="text-xs bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
            {exam.course} • {exam.subject}
          </span>
          <h3 className="font-bold text-amber-900 text-sm sm:text-base mt-1">{exam.title}</h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
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
            <span>বাল্ক প্রশ্ন ইম্পোর্ট (Smart Paste)</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBankModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            title="আগের পরীক্ষা/প্রশ্নব্যাংকের পুরনো প্রশ্ন এই পরীক্ষায় যুক্ত করুন"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>পুরনো প্রশ্ন থেকে যোগ</span>
          </button>

          {allExams && onSelectExamKey && Object.keys(allExams).length > 1 && (
            <div className="flex items-center gap-2">
              <select
                value={activeExamKey}
                onChange={(e) => onSelectExamKey(e.target.value)}
                className="px-3 py-2 rounded-xl border border-amber-300 text-xs bg-white font-medium text-slate-800"
              >
                {Object.entries(allExams).map(([k, ex]) => (
                  <option key={k} value={k}>
                    {ex.title} ({ex.course})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <AIQuestionGeneratorModal
        isOpen={isAIModalOpen}
        activeExamKey={activeExamKey}
        examTitle={exam.title}
        defaultTopic={exam.subject || ""}
        topics={topics}
        onClose={() => setIsAIModalOpen(false)}
        onSuccess={async () => {
          await loadSolutions();
          onRefresh();
        }}
      />

      <BulkQuestionImporterModal
        isOpen={isBulkModalOpen}
        activeExamKey={activeExamKey}
        examTitle={exam.title}
        topics={topics}
        onClose={() => setIsBulkModalOpen(false)}
        onSuccess={async () => {
          await loadSolutions();
          onRefresh();
        }}
      />

      <QuestionBankSearchModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        examKey={activeExamKey}
        existingQuestionTexts={(exam.questions || []).map((q) => q.q)}
        topics={topics}
        onSuccess={async () => {
          await loadSolutions();
          onRefresh();
        }}
      />

      <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
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
              placeholder="দ্বিতীয় অপশন"
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
              placeholder="তৃতীয় অপশন"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">সঠিক উত্তর নির্বাচন</label>
            <select
              value={correctIdx}
              onChange={(e) => setCorrectIdx(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white cursor-pointer"
            >
              <option value={0}>অপশন ১ (ক)</option>
              <option value={1}>অপশন ২ (খ)</option>
              <option value={2}>অপশন ৩ (গ)</option>
              <option value={3}>অপশন ৪ (ঘ)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">ব্যাখ্যা (Explanation)</label>
            <input
              type="text"
              required
              placeholder="সঠিক উত্তরের ব্যাখ্যা..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
        </div>

        {/* Topic Tree Selector */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <TopicTreeSelector
            selectedTopicPath={selectedTopic}
            onSelectTopicPath={(path) => setSelectedTopic(path)}
            topics={mergedTopics}
            onTopicsUpdated={() => onRefresh()}
            label="প্রশ্নের টপিক ও সাব-টপিক নির্ধারণ"
            helperText="টপিক নির্বাচন করুন অথবা যেকোনো স্তরে সাব-টপিক তৈরি করুন (পরবর্তী প্রশ্নে বজায় থাকবে)"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer disabled:opacity-50"
          >
            {editingIndex !== null ? "প্রশ্ন আপডেট করুন" : "প্রশ্ন যোগ করুন"}
          </button>
          {editingIndex !== null && (
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
            >
              বাতিল
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
            এই এক্সামের বিদ্যমান প্রশ্নসমূহ ({toBengaliDigits(exam.questions?.length || 0)} টি):
          </h4>

          {exam.questions && exam.questions.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllQuestions}
                className="text-xs text-slate-600 hover:text-indigo-600 font-bold flex items-center gap-1 cursor-pointer"
              >
                {selectedQuestionIndices.length === exam.questions.length ? (
                  <span className="text-indigo-600">সব আনসিলেক্ট</span>
                ) : (
                  <span>সব সিলেক্ট ({toBengaliDigits(selectedQuestionIndices.length)})</span>
                )}
              </button>

              {selectedQuestionIndices.length > 0 && (
                <button
                  type="button"
                  disabled={isBulkDeleting}
                  onClick={handleBulkDeleteFromExam}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>সিলেক্টেড মুছুন ({toBengaliDigits(selectedQuestionIndices.length)})</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {!exam.questions || exam.questions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">এই এক্সামে কোনো প্রশ্ন নেই।</p>
          ) : (
            exam.questions.map((q, idx) => {
              const sol = solutions[idx] || { correct: 0, exp: "" };
              const isSelected = selectedQuestionIndices.includes(idx);
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition flex justify-between items-start gap-3 text-xs ${
                    isSelected ? "bg-amber-50/60 border-amber-300" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelectQuestion(idx)}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </button>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800">
                          {toBengaliDigits(idx + 1)}. {q.q}
                        </p>
                        {q.topic && (
                          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                            টপিক: {q.topic}
                          </span>
                        )}
                      </div>
                      <p className="text-emerald-700 font-medium">
                        সঠিক উত্তর: {q.opts[sol.correct] || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleEdit(idx)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" /> এডিট
                    </button>
                    <button
                      onClick={() => handleDelete(idx)}
                      className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="মুছে আর্কাইভে পাঠান"
                    >
                      <Trash2 className="w-3 h-3" /> মুছুন
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
