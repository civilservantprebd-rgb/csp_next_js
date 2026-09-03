"use client";

import React, { useEffect, useState } from "react";
import { Exam, SubjectItem } from "@/types/exam";
import { createExam, updateExam, deleteExam, toggleExamResultPublish } from "@/actions/admin-actions";
import { isAnswerTimeReached } from "@/lib/bangladesh-time";
import { QuestionBuilder } from "./QuestionBuilder";
import {
  Plus,
  Trash2,
  Edit3,
  Share2,
  Copy,
  X,
  Settings,
  Send,
  RotateCcw,
  CheckCircle2,
  Clock,
  Award,
  BookOpen,
  ChevronDown
} from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

interface ExamManagerProps {
  exams: Record<string, Exam>;
  courses: string[];
  subjects: SubjectItem[];
  topics?: string[];
  activeExamKey: string;
  onSelectExamForQuestions: (examKey: string) => void;
  onRefresh: () => void;
}

export const ExamManager: React.FC<ExamManagerProps> = ({
  exams,
  courses,
  subjects,
  topics = [],
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
  const [endTime, setEndTime] = useState("");
  const [isResultPublished, setIsResultPublished] = useState(false);
  const [isFree, setIsFree] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ---- কোর্স-ভিত্তিক তালিকা: কোন কোর্সের গ্রুপ সংকুচিত আছে ----
  // ডিফল্টে সক্রিয় পরীক্ষার কোর্স ছাড়া বাকি সব সংকুচিত (কোর্সে ট্যাপ করলে খোলে)
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(() => {
    const active = exams[activeExamKey];
    const expanded = active?.course ? String(active.course).trim() : "";
    const collapsed = new Set<string>();
    courses.forEach((c) => {
      if (c !== expanded) collapsed.add(c);
    });
    Object.values(exams).forEach((ex) => {
      const c = String(ex.course || "").trim();
      if (c && c !== expanded) collapsed.add(c);
    });
    return collapsed;
  });

  const toggleCourseGroup = (courseName: string) => {
    setCollapsedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseName)) next.delete(courseName);
      else next.add(courseName);
      return next;
    });
  };

  const ensureCourseVisible = (courseName: string) => {
    const c = String(courseName || "").trim();
    if (!c) return;
    setCollapsedCourses((prev) => {
      if (!prev.has(c)) return prev;
      const next = new Set(prev);
      next.delete(c);
      return next;
    });
  };

  // সক্রিয় পরীক্ষার কোর্সের গ্রুপ যেন সবসময় খোলা থাকে (প্রশ্ন-বিল্ডার থেকে নির্বাচন বদলালেও)
  useEffect(() => {
    const active = exams[activeExamKey];
    if (active?.course) ensureCourseVisible(active.course);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExamKey, exams]);

  // Edit form states
  const [editingExamKey, setEditingExamKey] = useState<string | null>(null);
  const [editCourse, setEditCourse] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editTimerMinutes, setEditTimerMinutes] = useState(10);
  const [editPassMark, setEditPassMark] = useState(1);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editIsResultPublished, setEditIsResultPublished] = useState(false);
  const [editIsFree, setEditIsFree] = useState(false);

  const filteredSubjects = subjects.filter((s) => s.course === course);
  const editFilteredSubjects = subjects.filter((s) => s.course === editCourse);

  // Convert DB ISO time into the <input type="datetime-local"> format (YYYY-MM-DDTHH:mm)
  const toDatetimeLocal = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // datetime-local gives a naive "YYYY-MM-DDTHH:mm" string in the admin's local time.
  // The app treats every exam time as Bangladesh time (UTC+6, no DST). Storing the naive
  // string directly lets Postgres interpret it as UTC, shifting every exam by 6 hours —
  // exams then never go live when the admin expects. Attach the explicit +06:00 offset.
  const toBangladeshIso = (value: string): string => {
    const v = String(value || "").trim();
    if (!v) return "";
    if (v.includes("Z") || v.includes("+") || /-\d{2}:\d{2}$/.test(v)) return v;
    return v.length === 16 ? `${v}:00+06:00` : `${v}+06:00`;
  };

  const startEdit = (key: string, ex: Exam) => {
    setEditingExamKey(key);
    setEditCourse(ex.course);
    setEditSubject(ex.subject);
    setEditTitle(ex.title);
    setEditTimerMinutes(ex.timerMinutes);
    setEditPassMark(ex.passMark || 1);
    setEditStartTime(toDatetimeLocal(ex.startTime));
    setEditEndTime(toDatetimeLocal(ex.endTime));
    setEditIsResultPublished(ex.isResultPublished ?? isAnswerTimeReached(ex));
    setEditIsFree(!!ex.isFree);
  };

  const handleTogglePublish = async (key: string, publish: boolean) => {
    const actionText = publish ? "ফলাফল প্রকাশ ও লিডারবোর্ডে উন্মুক্ত" : "ফলাফল রিসেট ও অপ্রকাশিত";
    if (confirm(`আপনি কি এই পরীক্ষার ${actionText} করতে চান?`)) {
      setIsLoading(true);
      const success = await toggleExamResultPublish(key, publish);
      setIsLoading(false);
      if (success) {
        onRefresh();
        alert(
          publish
            ? "ফলাফল ও লিডারবোর্ড সফলভাবে রিলিজ করা হয়েছে। শিক্ষার্থীদের উত্তর যাচাই ও মূল্যায়ন সম্পন্ন হয়েছে।"
            : "ফলাফল সফলভাবে রিসেট করা হয়েছে। শিক্ষার্থীরা এখন 'মার্ক্স প্রকাশিত হয়নি' বার্তা দেখতে পাবে।"
        );
      } else {
        alert("ফলাফল স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে।");
      }
    }
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
      startTime: toBangladeshIso(editStartTime),
      endTime: toBangladeshIso(editEndTime),
      isResultPublished: editIsResultPublished,
      isFree: editIsFree
    });
    setIsLoading(false);

    if (success) {
      ensureCourseVisible(editCourse);
      onRefresh();
      alert("এক্সাম সেট সফলভাবে আপডেট করা হয়েছে।");
    } else {
      alert("এক্সাম সেট আপডেট করতে সমস্যা হয়েছে।");
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
      startTime: toBangladeshIso(startTime),
      endTime: toBangladeshIso(endTime),
      isResultPublished,
      isFree,
      questions: []
    });
    setIsLoading(false);

    if (!newKey) {
      alert("এক্সাম তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
      return;
    }

    if (newKey) {
      setTitle("");
      setIsResultPublished(false);
      ensureCourseVisible(course);
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
    if (url) {
      navigator.clipboard.writeText(url);
      alert("পরীক্ষার লিংক কপি করা হয়েছে:\n" + url);
    }
  };

  // ---- কোর্স অনুযায়ী গ্রুপিং (নিচের তালিকার জন্য) ----
  const examEntries = Object.entries(exams);
  const knownCourses = new Set(courses);
  const orderedCourseNames = [...courses];
  examEntries.forEach(([, ex]) => {
    const c = String(ex.course || "").trim();
    if (c && !knownCourses.has(c) && !orderedCourseNames.includes(c)) orderedCourseNames.push(c);
  });
  const courseExamMap = new Map<string, [string, Exam][]>();
  orderedCourseNames.forEach((c) => {
    const list = examEntries.filter(([, ex]) => String(ex.course || "").trim() === c);
    if (list.length > 0) courseExamMap.set(c, list);
  });
  const courseGroups = Array.from(courseExamMap.keys());
  const allCoursesCollapsed =
    courseGroups.length > 0 && courseGroups.every((c) => collapsedCourses.has(c));
  const toggleAllCourseGroups = () => {
    setCollapsedCourses(allCoursesCollapsed ? new Set() : new Set(courseGroups));
  };

  return (
    <div className="space-y-6 font-bengali">
      {/* Create New Exam Box */}
      <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 space-y-4">
        <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-indigo-600" /> নতুন এক্সাম সেট তৈরি করুন
        </h3>

        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">কোর্স</label>
            <select
              value={course}
              onChange={(e) => {
                const newCourseName = e.target.value;
                setCourse(newCourseName);
                const matched = subjects.filter((s) => s.course === newCourseName);
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
            <label className="block text-sm font-medium text-slate-600 mb-1">সাবজেক্ট</label>
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
              {filteredSubjects.length === 0 && <option value="">কোনো সাবজেক্ট নেই</option>}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">এক্সামের নাম</label>
            <input
              type="text"
              required
              placeholder="যেমন: বাংলা ১ম পত্র - মডেল টেস্ট ০১"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">সময় (মিনিট)</label>
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
            <label className="block text-sm font-medium text-slate-600 mb-1">পাস মার্কস</label>
            <input
              type="number"
              step={0.5}
              required
              value={passMark}
              onChange={(e) => setPassMark(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
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
            <label className="block text-sm font-medium text-slate-600 mb-1">
              পরীক্ষা সমাপ্তি বা শেষ সময় <span className="text-slate-400 font-normal">(ঐচ্ছিক)</span>
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2">
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

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="admin-exam-publish-now"
                checked={isResultPublished}
                onChange={(e) => setIsResultPublished(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
              />
              <label htmlFor="admin-exam-publish-now" className="text-xs font-medium text-emerald-800 cursor-pointer">
                তৈরির সাথে সাথেই ফলাফল উন্মুক্ত রাখুন
              </label>
            </div>
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

      {/* List of Existing Exams — কোর্স অনুযায়ী সাজানো (কোর্স হেডারে ট্যাপ করলে ওই কোর্সের পরীক্ষাগুলো খোলে) */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
          <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
            সকল এক্সাম সেটসমূহ — কোর্স অনুযায়ী
          </h4>
          <div className="flex items-center gap-2">
            {courseGroups.length > 0 && (
              <button
                type="button"
                onClick={toggleAllCourseGroups}
                className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition cursor-pointer"
              >
                {allCoursesCollapsed ? "সব খুলুন" : "সব বন্ধ করুন"}
              </button>
            )}
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
              মোট {toBengaliDigits(examEntries.length)}টি
            </span>
          </div>
        </div>

        {courseGroups.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            কোনো পরীক্ষা নেই — উপরের ফর্ম দিয়ে প্রথম এক্সাম সেট তৈরি করুন।
          </p>
        ) : (
          <div className="space-y-3">
            {courseGroups.map((courseName) => {
              const groupExams = courseExamMap.get(courseName) || [];
              const isOpen = !collapsedCourses.has(courseName);
              const hasActive = groupExams.some(([k]) => k === activeExamKey);
              return (
                <div key={courseName} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  {/* কোর্স হেডার — ট্যাপ করলে ওই কোর্সের সব পরীক্ষা দেখায় */}
                  <button
                    type="button"
                    onClick={() => toggleCourseGroup(courseName)}
                    aria-expanded={isOpen}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition cursor-pointer ${
                      isOpen
                        ? "bg-gradient-to-r from-indigo-900 to-indigo-800"
                        : "bg-slate-800 hover:bg-slate-700"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shrink-0 shadow-sm">
                        <span className="w-full h-full bg-slate-900/90 rounded-[10px] flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-amber-300" />
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-white font-black text-xs sm:text-sm truncate">
                          {courseName}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] text-indigo-200 font-semibold">
                          {toBengaliDigits(groupExams.length)}টি পরীক্ষা
                          {hasActive && (
                            <span className="bg-amber-400 text-slate-950 px-1.5 py-px rounded font-black">
                              সক্রিয়
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-5 h-5 text-indigo-200 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* ওই কোর্সের পরীক্ষাগুলো */}
                  {isOpen && (
                    <div className="p-2.5 space-y-2.5 bg-slate-50/70">
                      {groupExams.map(([k, ex]) => {
                        const isActive = activeExamKey === k;
                        const isPublished = isAnswerTimeReached(ex);

                        return (
                          <div
                            key={k}
                            className={`p-3.5 rounded-2xl border ${
                              isActive ? "border-indigo-500 bg-indigo-50/40" : "border-slate-200 bg-slate-50"
                            } flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm">{ex.title}</span>
                                {isActive && (
                                  <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded font-bold">
                                    সক্রিয়
                                  </span>
                                )}
                                {isPublished ? (
                                  <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> রেজাল্ট প্রকাশিত
                                  </span>
                                ) : (
                                  <span className="text-xs bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-600" /> রেজাল্ট অপ্রকাশিত (লুকানো)
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-slate-500">
                                কোর্স: {ex.course} | সাবজেক্ট: {ex.subject} | প্রশ্ন: {toBengaliDigits(ex.questions?.length || 0)} |
                                সময়: {toBengaliDigits(ex.timerMinutes)} মিনিট
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-1.5 w-full sm:w-auto justify-end">
                              {/* Result Release / Reset Button */}
                              {isPublished ? (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePublish(k, false)}
                                  disabled={isLoading}
                                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-sm font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-sm"
                                  title="ফলাফল রিসেট করে গোপন করুন (শিক্ষার্থীদের 'মার্ক্স প্রকাশিত হয়নি' বার্তা দেখাবে)"
                                >
                                  <RotateCcw className="w-3 h-3" /> রেজাল্ট রিসেট
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePublish(k, true)}
                                  disabled={isLoading}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-sm"
                                  title="ফলাফল ও লিডারবোর্ড প্রকাশ করুন"
                                >
                                  <Send className="w-3 h-3" /> রেজাল্ট রিলিজ
                                </button>
                              )}

                              <button
                                onClick={() => startEdit(k, ex)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                              >
                                <Settings className="w-3 h-3" /> এডিট
                              </button>
                              <button
                                onClick={() => copyShareLink(k)}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> লিংক
                              </button>
                              <button
                                onClick={() => handleDelete(k)}
                                className="bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm font-medium px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> মুছুন
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Question builder modal — add/edit questions right inside the exam set */}
      {editingExamKey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 font-bengali">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-6 shadow-2xl space-y-4 relative border border-slate-100 max-h-[92vh] overflow-y-auto">
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
              <p className="text-xs text-slate-500">পরীক্ষার নাম, কোর্স, সাবজেক্ট এবং ফলাফল প্রকাশ নিয়ন্ত্রণ করুন</p>
            </div>

            <form id="exam-edit-form" onSubmit={handleUpdate} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">কোর্স</label>
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
                  <label className="block text-sm font-medium text-slate-600 mb-1">সাবজেক্ট</label>
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
                <label className="block text-sm font-medium text-slate-600 mb-1">এক্সামের নাম</label>
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
                  <label className="block text-sm font-medium text-slate-600 mb-1">সময় (মিনিট)</label>
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
                  <label className="block text-sm font-medium text-slate-600 mb-1">পাস মার্কস</label>
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
                  <label className="block text-sm font-medium text-slate-600 mb-1">পরীক্ষা শুরুর সময়</label>
                  <input
                    type="datetime-local"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">পরীক্ষা সমাপ্তি বা শেষ সময়</label>
                  <input
                    type="datetime-local"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
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

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="admin-edit-exam-publish-now"
                    checked={editIsResultPublished}
                    onChange={(e) => setEditIsResultPublished(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="admin-edit-exam-publish-now" className="text-xs font-medium text-emerald-800 cursor-pointer">
                    ফলাফল ও মার্ক্স উন্মুক্ত রাখুন (Published)
                  </label>
                </div>
              </div>

            </form>

            {/* Question add/edit — inside the same edit modal */}
            <div className="border-t border-slate-200 pt-4 mt-2">
              <h4 className="font-bold text-indigo-950 text-sm sm:text-base flex items-center gap-2 mb-3">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                প্রশ্ন যোগ/এডিট — {editTitle || exams[editingExamKey]?.title || "এই পরীক্ষায়"}
              </h4>
              {exams[editingExamKey] && (
                <QuestionBuilder
                  activeExamKey={editingExamKey}
                  exam={{
                    ...exams[editingExamKey],
                    course: editCourse || exams[editingExamKey].course,
                    subject: editSubject || exams[editingExamKey].subject,
                    title: editTitle || exams[editingExamKey].title,
                    timerMinutes: Number(editTimerMinutes) || exams[editingExamKey].timerMinutes,
                    passMark: Number(editPassMark) || 1,
                    isFree: editIsFree,
                    isResultPublished: editIsResultPublished
                  }}
                  allExams={exams}
                  onSelectExamKey={(k) => {
                    if (exams[k]) {
                      startEdit(k, exams[k]);
                    }
                  }}
                  topics={topics}
                  onRefresh={onRefresh}
                />
              )}
            </div>

            {/* সংরক্ষণ / বাতিল — একদম নিচে (form attribute-এর কারণে এখান থেকেও কাজ করে) */}
            <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingExamKey(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                form="exam-edit-form"
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition shadow disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
