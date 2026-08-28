"use client";

import React, { useState } from "react";
import { Exam, SubjectItem } from "@/types/exam";
import { createExam, updateExam, deleteExam } from "@/actions/admin-actions";
import { Plus, Trash2, Edit3, Share2, Copy, Bolt, X, Settings } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

interface ExamManagerProps {
  exams: Record<string, Exam>;
  courses: string[];
  subjects: SubjectItem[];
  activeExamKey: string;
  onSelectExamForQuestions: (examKey: string) => void;
  onRefresh: () => void;
}

export const ExamManager: React.FC<ExamManagerProps> = ({
  exams,
  courses,
  subjects,
  activeExamKey,
  onSelectExamForQuestions,
  onRefresh,
}) => {
  const [course, setCourse] = useState(courses[0] || "সাধারণ কোর্স");
  const [subject, setSubject] = useState(subjects[0]?.name || "বাংলা");
  const [title, setTitle] = useState("");
  const [timerMinutes, setTimerMinutes] = useState(10);
  const [passMark, setPassMark] = useState(1);
  const [startTime, setStartTime] = useState("");
  const [answerReleaseTime, setAnswerReleaseTime] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Edit form states
  const [editingExamKey, setEditingExamKey] = useState<string | null>(null);
  const [editCourse, setEditCourse] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editTimerMinutes, setEditTimerMinutes] = useState(10);
  const [editPassMark, setEditPassMark] = useState(1);
  const [editStartTime, setEditStartTime] = useState("");
  const [editAnswerReleaseTime, setEditAnswerReleaseTime] = useState("");
  const [editIsFree, setEditIsFree] = useState(false);

  const filteredSubjects = subjects.filter((s) => s.course === course);
  const editFilteredSubjects = subjects.filter((s) => s.course === editCourse);

  const startEdit = (key: string, ex: Exam) => {
    setEditingExamKey(key);
    setEditCourse(ex.course);
    setEditSubject(ex.subject);
    setEditTitle(ex.title);
    setEditTimerMinutes(ex.timerMinutes);
    setEditPassMark(ex.passMark || 1);
    setEditStartTime(ex.startTime || "");
    setEditAnswerReleaseTime(ex.answerReleaseTime || "");
    setEditIsFree(!!ex.isFree);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExamKey || !editTitle.trim()) return;

    setIsLoading(true);
    const success = await updateExam(editingExamKey, {
      course: editCourse,
      subject: editSubject,
      title: editTitle.trim(),
      timerMinutes: Number(editTimerMinutes) || 10,
      passMark: Number(editPassMark) || 1,
      startTime: editStartTime,
      answerReleaseTime: editAnswerReleaseTime,
      isFree: editIsFree
    });
    setIsLoading(false);

    if (success) {
      setEditingExamKey(null);
      onRefresh();
      alert("এক্সাম সেট সফলভাবে আপডেট করা হয়েছে।");
    } else {
      alert("এক্সাম সেট আপডেট করতে সমস্যা হয়েছে।");
    }
  };

  const applyPreset = (type: "now" | "evening" | "night" | "clear") => {
    if (type === "clear") {
      setStartTime("");
      setAnswerReleaseTime("");
      return;
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const toLocalISO = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
        d.getMinutes()
      )}`;

    if (type === "now") {
      setStartTime(toLocalISO(now));
      const end = new Date(now.getTime() + 60 * 60 * 1000);
      setAnswerReleaseTime(toLocalISO(end));
    } else if (type === "evening") {
      const start = new Date(now);
      start.setHours(17, 0, 0, 0);
      const end = new Date(now);
      end.setHours(18, 15, 0, 0);
      setStartTime(toLocalISO(start));
      setAnswerReleaseTime(toLocalISO(end));
    } else if (type === "night") {
      const start = new Date(now);
      start.setHours(20, 0, 0, 0);
      const end = new Date(now);
      end.setHours(21, 0, 0, 0);
      setStartTime(toLocalISO(start));
      setAnswerReleaseTime(toLocalISO(end));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    const newKey = await createExam({
      course,
      subject,
      title: title.trim(),
      timerMinutes: Number(timerMinutes) || 10,
      passMark: Number(passMark) || 1,
      startTime,
      answerReleaseTime,
      isFree,
      questions: []
    });
    setIsLoading(false);

    if (newKey) {
      setTitle("");
      onRefresh();
      alert("নতুন এক্সাম সেট সফলভাবে তৈরি করা হয়েছে।");
    }
  };

  const handleDelete = async (key: string) => {
    if (Object.keys(exams).length <= 1) {
      alert("কমপক্ষে একটি এক্সাম সেট থাকা আবশ্যক।");
      return;
    }
    if (confirm("আপনি কি এই এক্সাম সেটটি মুছে ফেলতে চান?")) {
      await deleteExam(key);
      onRefresh();
    }
  };

  const copyShareLink = (key: string) => {
    const url = typeof window !== "undefined" ? `${window.location.origin}/exam/${key}` : "";
    navigator.clipboard.writeText(url);
    alert("পরীক্ষার লিংক কপি করা হয়েছে: " + url);
  };

  return (
    <div className="space-y-6 font-bengali">
      {/* Create New Exam Box */}
      <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3">
        <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-indigo-600" /> নতুন এক্সাম বা সেট তৈরি করুন
        </h3>

        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">কোর্স</label>
            <select
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                const matched = subjects.filter((s) => s.course === e.target.value);
                if (matched.length > 0) setSubject(matched[0].name);
              }}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            >
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">সাবজেক্ট</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            >
              {filteredSubjects.map((s, idx) => (
                <option key={`${s.name}_${idx}`} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">এক্সামের নাম</label>
            <input
              type="text"
              required
              placeholder="যেমন: Exam 02 - সাধারণ জ্ঞান"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">সময় (মিনিট)</label>
            <input
              type="number"
              min={1}
              max={180}
              required
              value={timerMinutes}
              onChange={(e) => setTimerMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">পাস মার্কস</label>
            <input
              type="number"
              step={0.5}
              required
              value={passMark}
              onChange={(e) => setPassMark(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          {/* Quick Schedule Preset Buttons */}
          <div className="sm:col-span-3 p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700">⚡ দ্রুত লাইভ সময়সূচি প্রিসেট:</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset("now")}
                className="bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Bolt className="w-3.5 h-3.5" /> এখনই লাইভ (১ ঘণ্টা)
              </button>
              <button
                type="button"
                onClick={() => applyPreset("evening")}
                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[11px] font-medium px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                আজ বিকাল ৫:০০ - ৬:১৫
              </button>
              <button
                type="button"
                onClick={() => applyPreset("night")}
                className="bg-violet-100 hover:bg-violet-200 text-violet-700 text-[11px] font-medium px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                আজ রাত ৮:০০ - ৯:০০
              </button>
              <button
                type="button"
                onClick={() => applyPreset("clear")}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                মুছে উন্মুক্ত রাখুন
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              পরীক্ষা শুরুর সময় <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              উত্তর প্রকাশের সময় <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
            </label>
            <input
              type="datetime-local"
              value={answerReleaseTime}
              onChange={(e) => setAnswerReleaseTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              id="admin-exam-is-free"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
            />
            <label htmlFor="admin-exam-is-free" className="text-xs font-medium text-slate-700 cursor-pointer">
              ফ্রি পরীক্ষা (আইডি ছাড়াই)
            </label>
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer disabled:opacity-50"
            >
              {isLoading ? "তৈরি হচ্ছে..." : "এক্সাম তৈরি করুন"}
            </button>
          </div>
        </form>
      </div>

      {/* List of Existing Exams */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">সকল এক্সাম সেটসমূহ:</h4>
        <div className="space-y-2.5">
          {Object.entries(exams).map(([k, ex]) => {
            const isActive = activeExamKey === k;
            return (
              <div
                key={k}
                className={`p-3.5 rounded-2xl border ${
                  isActive ? "border-indigo-500 bg-indigo-50/40" : "border-slate-200 bg-slate-50"
                } flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{ex.title}</span>
                    {isActive && (
                      <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">
                        সক্রিয়
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    কোর্স: {ex.course} | সাবজেক্ট: {ex.subject} | প্রশ্ন: {toBengaliDigits(ex.questions?.length || 0)} |
                    সময়: {toBengaliDigits(ex.timerMinutes)} মিনিট
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => startEdit(k, ex)}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" /> এডিট
                  </button>
                  <button
                    onClick={() => onSelectExamForQuestions(k)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> প্রশ্ন যোগ/এডিট
                  </button>
                  <button
                    onClick={() => copyShareLink(k)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-medium px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> লিংক
                  </button>
                  <button
                    onClick={() => handleDelete(k)}
                    className="bg-rose-100 hover:bg-rose-200 text-rose-700 text-[11px] font-medium px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> মুছুন
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editingExamKey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-bengali">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4 relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingExamKey(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-1.5">
                <Edit3 className="w-5 h-5 text-indigo-600" /> এক্সাম সেট এডিট করুন
              </h3>
              <p className="text-xs text-slate-500">পরীক্ষার নাম, কোর্স, সাবজেক্ট এবং সময়সীমা পরিবর্তন করুন</p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">কোর্স</label>
                  <select
                    value={editCourse}
                    onChange={(e) => {
                      const newCourseName = e.target.value;
                      setEditCourse(newCourseName);
                      const matchedSubjects = subjects.filter((s) => s.course === newCourseName);
                      if (matchedSubjects.length > 0) {
                        setEditSubject(matchedSubjects[0].name);
                      } else {
                        setEditSubject("");
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  >
                    {editCourse && !courses.includes(editCourse) && (
                      <option value={editCourse}>
                        {editCourse} (মুছে ফেলা কোর্স)
                      </option>
                    )}
                    {courses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">সাবজেক্ট</label>
                  <select
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  >
                    {editSubject && !editFilteredSubjects.some((s) => s.name === editSubject) && (
                      <option value={editSubject}>
                        {editSubject} (মুছে ফেলা সাবজেক্ট)
                      </option>
                    )}
                    {editFilteredSubjects.map((s, idx) => (
                      <option key={`${s.name}_${idx}`} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">এক্সামের নাম</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">সময় (মিনিট)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    required
                    value={editTimerMinutes}
                    onChange={(e) => setEditTimerMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">পাস মার্কস</label>
                  <input
                    type="number"
                    step={0.5}
                    required
                    value={editPassMark}
                    onChange={(e) => setEditPassMark(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">পরীক্ষা শুরুর সময়</label>
                  <input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">উত্তর প্রকাশের সময়</label>
                  <input
                    type="datetime-local"
                    value={editAnswerReleaseTime}
                    onChange={(e) => setEditAnswerReleaseTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="admin-edit-exam-is-free"
                  checked={editIsFree}
                  onChange={(e) => setEditIsFree(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 cursor-pointer"
                />
                <label htmlFor="admin-edit-exam-is-free" className="text-xs font-medium text-slate-700 cursor-pointer">
                  ফ্রি পরীক্ষা (আইডি ছাড়াই)
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingExamKey(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow disabled:opacity-50 cursor-pointer"
                >
                  {isLoading ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
