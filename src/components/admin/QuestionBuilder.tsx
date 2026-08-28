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
import { Plus, Trash2, Edit2, CheckCircle2, Layers, Tag } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

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
  const [opt0, setOpt0] = useState("");
  const [opt1, setOpt1] = useState("");
  const [opt2, setOpt2] = useState("");
  const [opt3, setOpt3] = useState("");
  const [correctIdx, setCorrectIdx] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSolutions = async () => {
    const data = await getExamSolutions(activeExamKey);
    setSolutions(data || []);
  };

  useEffect(() => {
    loadSolutions();
  }, [activeExamKey]);

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
      ...(selectedTopic.trim() ? { topic: selectedTopic.trim() } : {})
    };
    const solutionObj: QuestionSolution = {
      correct: Number(correctIdx),
      exp: explanation.trim(),
    };

    if (editingIndex !== null) {
      await updateQuestionInExam(activeExamKey, editingIndex, questionObj, solutionObj);
      setEditingIndex(null);
    } else {
      await addQuestionToExam(activeExamKey, questionObj, solutionObj);
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
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
            {exam.course} • {exam.subject}
          </span>
          <h3 className="font-bold text-amber-900 text-sm sm:text-base mt-1">{exam.title}</h3>
        </div>

        {allExams && onSelectExamKey && Object.keys(allExams).length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-amber-900 shrink-0">অন্য এক্সাম সেট:</label>
            <select
              value={activeExamKey}
              onChange={(e) => onSelectExamKey(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-amber-300 text-xs sm:text-sm bg-white font-medium text-slate-800"
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
              placeholder="দ্বিতীয় অপশন"
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
              placeholder="তৃতীয় অপশন"
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

        {/* Topic dropdown positioned directly above submit button */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" /> টপিক নির্বাচন
              <span className="text-[11px] font-normal text-slate-500">(একবার সিলেক্ট করলে পরবর্তী সকল প্রশ্নে যুক্ত থাকবে)</span>
            </label>
            {!isAddingNewTopic && (
              <button
                type="button"
                onClick={() => setIsAddingNewTopic(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
              >
                + নতুন টপিক
              </button>
            )}
          </div>

          {isAddingNewTopic ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="নতুন টপিকের নাম লিখুন..."
                value={newTopicInput}
                onChange={(e) => setNewTopicInput(e.target.value)}
                className="flex-grow px-3 py-2 rounded-xl border border-indigo-300 text-xs sm:text-sm bg-indigo-50/20"
              />
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleQuickAddTopic}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  যুক্ত করুন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewTopic(false);
                    setNewTopicInput("");
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50 cursor-pointer"
              >
                <option value="">-- কোনো টপিক নেই (ঐচ্ছিক) --</option>
                {topics.map((t, idx) => (
                  <option key={idx} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {selectedTopic ? (
                <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-xl font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  বর্তমান সিলেক্টেড টপিক: <strong>{selectedTopic}</strong>
                </span>
              ) : (
                <span className="text-xs text-slate-400">টপিক সিলেক্ট করা হয়নি</span>
              )}
            </div>
          )}
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

      <div>
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">
          এই এক্সামের বিদ্যমান প্রশ্নসমূহ ({toBengaliDigits(exam.questions?.length || 0)} টি):
        </h4>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {!exam.questions || exam.questions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">এই এক্সামে কোনো প্রশ্ন নেই।</p>
          ) : (
            exam.questions.map((q, idx) => {
              const sol = solutions[idx] || { correct: 0, exp: "" };
              return (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-start gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800">
                        {toBengaliDigits(idx + 1)}. {q.q}
                      </p>
                      {q.topic && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-semibold border border-indigo-200">
                          টপিক: {q.topic}
                        </span>
                      )}
                    </div>
                    <p className="text-emerald-700 font-medium">
                      সঠিক উত্তর: {q.opts[sol.correct] || "—"}
                    </p>
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
