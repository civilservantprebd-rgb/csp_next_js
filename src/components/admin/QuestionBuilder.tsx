"use client";

import React, { useState, useEffect } from "react";
import { Exam, QuestionItem, QuestionSolution } from "@/types/exam";
import {
  addQuestionToExam,
  deleteQuestionFromExam,
  updateQuestionInExam,
  reorderExamQuestion,
  saveAppConfig
} from "@/actions/admin-actions";
import { getExamSolutions } from "@/actions/exam-actions";
import { Plus, Trash2, Edit2, CheckCircle2, Layers, Tag, BookOpen, Upload, FileText, Sparkles, ArrowUp, ArrowDown } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";
import { MathText } from "@/lib/MathText";
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


const SAMPLE_TEXT = "১. বাংলাদেশের রাজধানী কোথায়?\nক) ঢাকা\nখ) চট্টগ্রাম\nগ) রাজশাহী\nঘ) খুলনা\nউত্তর: ক\nব্যাখ্যা: ঢাকা হলো বাংলাদেশের রাজধানী।";

export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({
  activeExamKey,
  exam,
  allExams,
  onSelectExamKey,
  topics = [],
  onRefresh,
}) => {
  const [solutions, setSolutions] = useState<QuestionSolution[]>([]);
  const [rawText, setRawText] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [isAddingNewTopic, setIsAddingNewTopic] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [allTopics, setAllTopics] = useState<string[]>([]);
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
    if (!rawText.trim()) {
      alert("অনুগ্রহ করে প্রশ্ন লিখুন।");
      return;
    }

    setIsLoading(true);
    
    const parsedResult = parseBulkQuestionsText(rawText);
    const parsedBlocks = parsedResult.blocks.filter(b => b.isValid);
    if (parsedBlocks.length === 0) {
      setIsLoading(false);
      alert("কোনো সঠিক প্রশ্ন পাওয়া যায়নি। অনুগ্রহ করে সঠিক ফরম্যাটে লিখুন (যেমন: ১. প্রশ্ন, ক) খ) গ) ঘ), উত্তর: ক)।");
      return;
    }

    try {
      const activeTopic = isAddingNewTopic ? newTopicInput.trim() : selectedTopic;
      
      if (editingIndex !== null) {
        const first = parsedBlocks[0];
        const questionObj = {
          q: first.q,
          opts: first.opts,
          topic: first.topic || activeTopic || "\u09B8\u09BE\u09A7\u09BE\u09B0\u09A3"
        };
        const solutionObj = {
          correct: first.correct,
          exp: first.exp,
        };
        
        const ok = await updateQuestionInExam(activeExamKey, editingIndex, questionObj, solutionObj);
        if (!ok) {
          setIsLoading(false);
          alert("প্রশ্ন আপডেট করতে সমস্যা হয়েছে।");
          return;
        }
        
        if (parsedBlocks.length > 1) {
          const rest = parsedBlocks.slice(1);
          const newQs = rest.map(b => ({ q: b.q, opts: b.opts, topic: b.topic || activeTopic || "\u09B8\u09BE\u09A7\u09BE\u09B0\u09A3" }));
          const newSols = rest.map(b => ({ correct: b.correct, exp: b.exp }));
          await addBulkQuestionsToExam(activeExamKey, newQs, newSols);
        }
        
        setEditingIndex(null);
      } else {
        const newQs = parsedBlocks.map(b => ({ q: b.q, opts: b.opts, topic: b.topic || activeTopic || "\u09B8\u09BE\u09A7\u09BE\u09B0\u09A3" }));
        const newSols = parsedBlocks.map(b => ({ correct: b.correct, exp: b.exp }));
        
        const res = await addBulkQuestionsToExam(activeExamKey, newQs, newSols);
        if (res && res.error) {
           alert("প্রশ্ন যুক্ত করতে সমস্যা হয়েছে: " + res.error);
        }
      }

      setIsLoading(false);
      resetForm();
      await loadSolutions();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
      setIsLoading(false);
    }
  };

  const handleEdit = (idx: number) => {
    const q = exam.questions?.[idx];
    const sol = solutions[idx] || { correct: 0, exp: "" };
    if (!q) return;

    setEditingIndex(idx);
    setSelectedTopic(q.topic || "");
    
    const chars = ["ক", "খ", "গ", "ঘ"];
    let text = (q.topic ? "# " + q.topic + "\n\n" : "") + "১. " + q.q + "\n";
    q.opts.forEach((opt, i) => {
      text += (chars[i] || i) + ") " + opt + "\n";
    });
    text += "উত্তর: " + (chars[sol.correct] || chars[0]) + "\n";
    if (sol.exp) {
      text += "ব্যাখ্যা: " + sol.exp + "\n";
    }
    setRawText(text);
  };

  const handleDelete = async (idx: number) => {
    if (confirm("আপনি কি এই প্রশ্নটি মুছে ফেলতে চান?")) {
      await deleteQuestionFromExam(activeExamKey, idx);
      await loadSolutions();
      onRefresh();
    }
  };

  const handleReorder = async (idx: number, direction: "up" | "down") => {
    setIsLoading(true);
    await reorderExamQuestion(activeExamKey, idx, direction);
    await loadSolutions();
    onRefresh();
    setIsLoading(false);
  };

  const resetForm = () => {
    setRawText("");
    setIsAddingNewTopic(false);
    setNewTopicInput("");
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
              <span>Question Generator</span>
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
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs sm:text-sm font-bold text-slate-700">প্রশ্ন, অপশন ও ব্যাখ্যা (Smart Paste)</label>
              <button type="button" onClick={() => setRawText(SAMPLE_TEXT)} className="text-xs text-indigo-600 hover:underline cursor-pointer">নমুনা দেখুন</button>
            </div>
            <textarea
              required
              rows={8}
              placeholder="১. প্রশ্ন...\nক) অপশন...\nউত্তর: ক\nব্যাখ্যা: ..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-white font-mono"
            />
            <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">
              বাল্ক ইম্পোর্টের মতো একই ফরম্যাটে প্রশ্ন পেস্ট করুন। আপনি চাইলে একসাথে একাধিক প্রশ্নও পেস্ট করতে পারেন।
            </p>
          </div>

          <div>
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

        {/* বিদ্যমান প্রশ্নের তালিকা — আগে `max-h-80` (≈৩২০px) ছিল, তাই অর্ধেক
            প্রশ্ন ঢাকা পড়ত। এখন স্ক্রিন-উচ্চতার ৭০% — সব প্রশ্ন একসাথে (স্ক্রল
            করে) দেখা যায়, তালিকা নিজেই স্ক্রল হয় header/বাটন জায়গায় থাকে। */}
        <div className="space-y-2 overflow-y-auto pr-1 max-h-[70vh]">
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
                          {toBengaliDigits(idx + 1)}. <MathText text={q.q} />
                        </p>
                        {q.topic && (
                          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                            টপিক: {q.topic}
                          </span>
                        )}
                      </div>
                      <p className="text-emerald-700 font-medium">
                        সঠিক উত্তর: <MathText text={q.opts[sol.correct] || "—"} />
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 shrink-0 flex-wrap justify-end max-w-[120px] sm:max-w-none">
                    {idx > 0 && (
                      <button
                        onClick={() => handleReorder(idx, "up")}
                        disabled={isLoading}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded-lg transition cursor-pointer"
                        title="উপরে নিন"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                    )}
                    {idx < (exam.questions?.length || 0) - 1 && (
                      <button
                        onClick={() => handleReorder(idx, "down")}
                        disabled={isLoading}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded-lg transition cursor-pointer"
                        title="নিচে নিন"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    )}
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
