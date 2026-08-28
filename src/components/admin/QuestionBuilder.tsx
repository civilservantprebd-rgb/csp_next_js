"use client";

import React, { useState, useEffect } from "react";
import { Exam, QuestionItem, QuestionSolution } from "@/types/exam";
import {
  addQuestionToExam,
  updateQuestionInExam,
  deleteQuestionFromExam
} from "@/actions/admin-actions";
import { getExamSolutions } from "@/actions/exam-actions";
import { Plus, Trash2, Edit2, CheckCircle2 } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

interface QuestionBuilderProps {
  activeExamKey: string;
  exam: Exam;
  onRefresh: () => void;
}

export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({
  activeExamKey,
  exam,
  onRefresh,
}) => {
  const [solutions, setSolutions] = useState<QuestionSolution[]>([]);
  const [questionText, setQuestionText] = useState("");
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
      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex justify-between items-center">
        <div>
          <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
            {exam.course} • {exam.subject}
          </span>
          <h3 className="font-bold text-amber-900 text-sm sm:text-base mt-1">{exam.title}</h3>
        </div>
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

        <div className="flex gap-2">
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
                  <div>
                    <p className="font-bold text-slate-800">
                      {toBengaliDigits(idx + 1)}. {q.q}
                    </p>
                    <p className="text-emerald-700 mt-0.5 font-medium">
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
