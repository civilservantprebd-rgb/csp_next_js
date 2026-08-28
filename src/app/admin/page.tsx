"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { AdminNav, AdminTabType } from "@/components/admin/AdminNav";
import { ExamManager } from "@/components/admin/ExamManager";
import { QuestionBuilder } from "@/components/admin/QuestionBuilder";
import { BulkQuestionImporterModal } from "@/components/admin/BulkQuestionImporterModal";
import { StudentApproval } from "@/components/admin/StudentApproval";
import { SubmissionsTable } from "@/components/admin/SubmissionsTable";
import { fetchAppConfig, fetchAppConfigLite, saveAppConfig, deleteTopicQuestion } from "@/actions/admin-actions";
import { supabase } from "@/lib/supabase";
import { AppConfigData, Exam, QuestionItem, TopicQuestion } from "@/types/exam";
import {
  LogOut,
  Users,
  Plus,
  Trash2,
  Link2,
  Loader2,
  Edit3,
  Check,
  X,
  Layers,
  Tag,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HelpCircle,
  BookOpen
} from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

export default function AdminPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfigData | null>(null);
  const [isFullDataLoaded, setIsFullDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTabType>("exams");
  const [selectedExamKey, setSelectedExamKey] = useState("");
  const [teacherUser, setTeacherUser] = useState<{ email: string } | null>(null);

  // Sub-forms state
  const [newCourseName, setNewCourseName] = useState("");
  const [newSubjectCourse, setNewSubjectCourse] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [driveRoutine, setDriveRoutine] = useState("");
  const [driveSyllabus, setDriveSyllabus] = useState("");

  // Subject editing state
  const [editingSubjectIdx, setEditingSubjectIdx] = useState<number | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectCourse, setEditSubjectCourse] = useState("");

  // Course editing state
  const [editingCourseIdx, setEditingCourseIdx] = useState<number | null>(null);
  const [editCourseName, setEditCourseName] = useState("");

  // Topic states (standalone topic names)
  const [newTopicName, setNewTopicName] = useState("");
  const [editingTopicIdx, setEditingTopicIdx] = useState<number | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [bulkTopicName, setBulkTopicName] = useState<string | null>(null);

  const applyConfigToState = (data: AppConfigData) => {
    setConfig(data);
    setDriveRoutine(data.driveRoutineUrl || "");
    setDriveSyllabus(data.driveSyllabusUrl || "");
    if (data.courses?.length) {
      setNewSubjectCourse(data.courses[0]);
    }
    const keys = Object.keys(data.exams || {});
    if (keys.length > 0) {
      setSelectedExamKey((prevKey) => (prevKey && data.exams?.[prevKey] ? prevKey : keys[0]));
    }
  };

  const loadData = async (initialLoad = false) => {
    const rawUser = sessionStorage.getItem("teacher_user");
    if (!rawUser) {
      router.push("/");
      return;
    }
    const parsedUser = JSON.parse(rawUser);
    setTeacherUser(parsedUser);

    if (initialLoad) {
      // Phase 1: Lite load — shows exam list instantly (no heavy JOIN)
      const liteData = await fetchAppConfigLite();
      applyConfigToState(liteData);
      setIsFullDataLoaded(false);
    }

    // Phase 2 (or only phase for refresh): Full data with all questions
    const data = await fetchAppConfig(true);
    applyConfigToState(data);
    setIsFullDataLoaded(true);
  };

  useEffect(() => {
    loadData(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!config || !teacherUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 font-bengali text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> প্যানেল লোড হচ্ছে...
      </div>
    );
  }

  const handleLogout = async () => {
    if (confirm("আপনি কি নিশ্চিতভাবে শিক্ষক প্যানেল থেকে লগআউট করতে চান?")) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Error signing out from Supabase:", err);
      }
      sessionStorage.removeItem("teacher_user");
      sessionStorage.removeItem("current_student");
      localStorage.removeItem("bcs_student_user");
      router.push("/");
    }
  };

  // Add course
  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newCourseName.trim();
    if (!val || config.courses.includes(val)) return;

    const nextCourses = [...config.courses, val];
    await saveAppConfig({ courses: nextCourses });
    setNewCourseName("");
    loadData();
  };

  const handleDeleteCourse = async (courseName: string) => {
    if (config.courses.length <= 1) {
      alert("কমপক্ষে একটি কোর্স থাকা আবশ্যক।");
      return;
    }
    if (confirm(`আপনি কি '${courseName}' কোর্সটি মুছে ফেলতে চান?`)) {
      const nextCourses = config.courses.filter((c) => c !== courseName);
      await saveAppConfig({ courses: nextCourses });
      loadData();
    }
  };

  const startEditCourse = (idx: number, oldName: string) => {
    setEditingCourseIdx(idx);
    setEditCourseName(oldName);
  };

  const handleSaveCourseEdit = async (idx: number) => {
    const newVal = editCourseName.trim();
    if (!newVal) return;

    const oldVal = config.courses[idx];
    if (newVal === oldVal) {
      setEditingCourseIdx(null);
      return;
    }

    if (config.courses.includes(newVal)) {
      alert("এই নামের একটি কোর্স ইতিমধ্যেই রয়েছে।");
      return;
    }

    // 1. Update courses array
    const nextCourses = [...config.courses];
    nextCourses[idx] = newVal;

    // 2. Update subjects assigned to this course
    const nextSubjects = config.subjects.map((sub) => {
      if (sub.course === oldVal) {
        return { ...sub, course: newVal };
      }
      return sub;
    });

    // 3. Update topicQuestions assigned to this course
    const nextTopicQuestions = (config.topicQuestions || []).map((tq) => {
      if (tq.originalCourse === oldVal) {
        return { ...tq, originalCourse: newVal };
      }
      return tq;
    });

    // 4. Update exams assigned to this course
    const nextExams = { ...config.exams };
    Object.keys(nextExams).forEach((key) => {
      if (nextExams[key].course === oldVal) {
        nextExams[key] = { ...nextExams[key], course: newVal };
      }
    });

    // Save updated configurations to Firestore
    await saveAppConfig({
      courses: nextCourses,
      subjects: nextSubjects,
      topicQuestions: nextTopicQuestions,
      exams: nextExams,
    });

    setEditingCourseIdx(null);
    loadData();
    alert("কোর্স সফলভাবে আপডেট করা হয়েছে।");
  };

  // Add Subject
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newSubjectName.trim();
    if (!val) return;

    if (config.subjects.some((s) => s.name === val && s.course === newSubjectCourse)) {
      alert("এই কোর্সে এই সাবজেক্টটি ইতিমধ্যে বিদ্যমান।");
      return;
    }

    const nextSubjects = [...config.subjects, { name: val, course: newSubjectCourse }];
    await saveAppConfig({ subjects: nextSubjects });
    setNewSubjectName("");
    loadData();
  };

  const handleDeleteSubject = async (idx: number) => {
    if (config.subjects.length <= 1) {
      alert("কমপক্ষে একটি সাবজেক্ট থাকা আবশ্যক।");
      return;
    }
    if (confirm("আপনি কি এই সাবজেক্টটি মুছে ফেলতে চান?")) {
      const nextSubjects = [...config.subjects];
      nextSubjects.splice(idx, 1);
      await saveAppConfig({ subjects: nextSubjects });
      loadData();
    }
  };

  const startEditSubject = (idx: number, sub: { name: string; course: string }) => {
    setEditingSubjectIdx(idx);
    setEditSubjectName(sub.name);
    setEditSubjectCourse(sub.course);
  };

  const handleSaveSubjectEdit = async (idx: number) => {
    const nameVal = editSubjectName.trim();
    if (!nameVal) return;

    const nextSubjects = [...config.subjects];
    nextSubjects[idx] = {
      name: nameVal,
      course: editSubjectCourse
    };

    await saveAppConfig({ subjects: nextSubjects });
    setEditingSubjectIdx(null);
    loadData();
    alert("সাবজেক্ট সফলভাবে আপডেট করা হয়েছে।");
  };

  // Add Topic
  const handleAddTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = newTopicName.trim();
    if (!val) return;

    const currentTopics = config.topics || [];
    if (currentTopics.includes(val)) {
      alert("এই নামের একটি টপিক ইতিমধ্যে বিদ্যমান।");
      return;
    }

    const nextTopics = [...currentTopics, val];
    await saveAppConfig({ topics: nextTopics });
    setNewTopicName("");
    loadData();
  };

  const handleDeleteTopic = async (idx: number) => {
    const topicToDelete = (config.topics || [])[idx];
    if (confirm(`আপনি কি '${topicToDelete}' টপিকটি মুছে ফেলতে চান?`)) {
      const nextTopics = [...(config.topics || [])];
      nextTopics.splice(idx, 1);
      await saveAppConfig({ topics: nextTopics });
      loadData();
    }
  };

  const startEditTopic = (idx: number, t: string) => {
    setEditingTopicIdx(idx);
    setEditTopicName(t);
  };

  // Helper to aggregate all persistent topic questions for a given topic
  // (Survives course, subject, or exam deletion!)
  const getQuestionsByTopic = (topicName: string): TopicQuestion[] => {
    const list: TopicQuestion[] = [];
    const seenMap = new Set<string>();

    // 1. Primary source: persistent topicQuestions repository
    (config?.topicQuestions || []).forEach((tq) => {
      if (tq.topic === topicName) {
        list.push(tq);
        seenMap.add(`${tq.q.trim()}___${tq.topic}`);
      }
    });

    // 2. Secondary source: active exams (ensures full coverage)
    if (config?.exams) {
      Object.entries(config.exams).forEach(([examKey, exam]) => {
        (exam.questions || []).forEach((q, qIdx) => {
          if (q.topic === topicName) {
            const key = `${q.q.trim()}___${q.topic}`;
            if (!seenMap.has(key)) {
              list.push({
                id: `tq_${examKey}_${qIdx}`,
                topic: q.topic,
                q: q.q,
                opts: q.opts,
                correct: 0,
                exp: "",
                originalExamTitle: exam.title,
                originalCourse: exam.course,
                originalSubject: exam.subject,
                examKey: examKey,
              });
              seenMap.add(key);
            }
          }
        });
      });
    }

    return list;
  };

  const handleDeleteTopicQuestion = async (id: string) => {
    if (confirm("আপনি কি এই প্রশ্নটি টপিক ভাণ্ডার থেকে মুছে ফেলতে চান?")) {
      await deleteTopicQuestion(id);
      loadData();
    }
  };

  const handleSaveTopicEdit = async (idx: number) => {
    const nameVal = editTopicName.trim();
    if (!nameVal) return;

    const currentTopics = config?.topics || [];
    const oldTopicName = currentTopics[idx];
    if (currentTopics.includes(nameVal) && oldTopicName !== nameVal) {
      alert("এই নামের একটি টপিক ইতিমধ্যে বিদ্যমান।");
      return;
    }

    const nextTopics = [...currentTopics];
    nextTopics[idx] = nameVal;

    // Update in topicQuestions persistent repository
    const nextTopicQuestions = (config?.topicQuestions || []).map((tq) => {
      if (tq.topic === oldTopicName) {
        return { ...tq, topic: nameVal };
      }
      return tq;
    });

    // Cascade topic rename to all questions in exams
    const nextExams = { ...(config?.exams || {}) };
    let hasExamChanges = false;
    if (oldTopicName) {
      Object.keys(nextExams).forEach((key) => {
        if (nextExams[key].questions) {
          nextExams[key] = {
            ...nextExams[key],
            questions: nextExams[key].questions!.map((q) => {
              if (q.topic === oldTopicName) {
                hasExamChanges = true;
                return { ...q, topic: nameVal };
              }
              return q;
            }),
          };
        }
      });
    }

    await saveAppConfig({
      topics: nextTopics,
      topicQuestions: nextTopicQuestions,
      ...(hasExamChanges ? { exams: nextExams } : {}),
    });
    setEditingTopicIdx(null);
    loadData();
    alert("টপিক সফলভাবে আপডেট করা হয়েছে।");
  };

  // Drive links
  const handleSaveDriveLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAppConfig({
      driveRoutineUrl: driveRoutine.trim(),
      driveSyllabusUrl: driveSyllabus.trim(),
    });
    alert("গুগল ড্রাইভ লিংক সফলভাবে আপডেট করা হয়েছে।");
  };



  return (
    <>
      <Header />

      <main className="flex-grow max-w-5xl w-full mx-auto p-4 sm:p-6 font-bengali space-y-6">
        <div className="bg-white rounded-3xl p-4 sm:p-8 shadow-md border border-slate-200 space-y-5">
          {/* Header Panel Top */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> শিক্ষক প্যানেল
              </h2>
              <p className="text-xs text-slate-500">পরীক্ষা, কোর্স, সাবজেক্ট এবং ফলাফল নিয়ন্ত্রণ করুন</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200/80 px-3 py-1.5 rounded-xl shadow-xs">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[11px]">
                  {teacherUser.email.charAt(0).toUpperCase()}
                </div>
                <div className="text-left leading-tight">
                  <p className="text-[11px] sm:text-xs font-bold text-indigo-950 truncate max-w-[120px] sm:max-w-[180px]">
                    {teacherUser.email}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">লগআউট</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <AdminNav activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content */}
          <div className="pt-2">
            {activeTab === "exams" && (
              <ExamManager
                exams={config.exams || {}}
                courses={config.courses || []}
                subjects={config.subjects || []}
                activeExamKey={selectedExamKey}
                onSelectExamForQuestions={(k) => {
                  setSelectedExamKey(k);
                  setActiveTab("questions");
                }}
                onRefresh={loadData}
              />
            )}

            {activeTab === "courses" && (
              <div className="space-y-5">
                <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
                  <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> নতুন কোর্স যোগ করুন
                  </h3>
                  <form onSubmit={handleAddCourse} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      placeholder="যেমন: বিসিএস প্রিলি কোর্স"
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl text-xs sm:text-sm transition whitespace-nowrap shadow cursor-pointer"
                    >
                      যোগ করুন
                    </button>
                  </form>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">বিদ্যমান কোর্সসমূহ:</h4>
                  <div className="space-y-2">
                    {config.courses.map((course, idx) => {
                      const isEditing = editingCourseIdx === idx;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border transition-all ${
                            isEditing ? "border-indigo-400 bg-indigo-50/20" : "border-slate-200 bg-slate-50"
                          } flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm`}
                        >
                          {isEditing ? (
                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                              <input
                                type="text"
                                value={editCourseName}
                                onChange={(e) => setEditCourseName(e.target.value)}
                                className="flex-grow px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
                                required
                              />
                              <div className="flex gap-1.5 sm:ml-auto">
                                <button
                                  onClick={() => handleSaveCourseEdit(idx)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> সংরক্ষণ
                                </button>
                                <button
                                  onClick={() => setEditingCourseIdx(null)}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> বাতিল
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="font-bold text-slate-800">
                                {toBengaliDigits(idx + 1)}. {course}
                              </span>
                              <div className="flex gap-2 justify-end sm:ml-auto">
                                <button
                                  onClick={() => startEditCourse(idx, course)}
                                  className="text-amber-600 hover:text-amber-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> এডিট
                                </button>
                                <button
                                  onClick={() => handleDeleteCourse(course)}
                                  className="text-rose-600 hover:text-rose-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> মুছুন
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "subjects" && (
              <div className="space-y-5">
                <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
                  <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> নতুন সাবজেক্ট যোগ করুন
                  </h3>
                  <form onSubmit={handleAddSubject} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">কোর্স নির্বাচন করুন</label>
                      <select
                        value={newSubjectCourse}
                        onChange={(e) => setNewSubjectCourse(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
                      >
                        {config.courses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">সাবজেক্টের নাম</label>
                      <input
                        type="text"
                        required
                        placeholder="যেমন: বিজ্ঞান"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer"
                      >
                        সাবজেক্ট যোগ করুন
                      </button>
                    </div>
                  </form>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">বিদ্যমান সাবজেক্টসমূহ:</h4>
                  <div className="space-y-2">
                    {config.subjects.map((sub, idx) => {
                      const isEditing = editingSubjectIdx === idx;
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border transition-all ${
                            isEditing ? "border-indigo-400 bg-indigo-50/20" : "border-slate-200 bg-slate-50"
                          } flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm`}
                        >
                          {isEditing ? (
                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                              <input
                                type="text"
                                value={editSubjectName}
                                onChange={(e) => setEditSubjectName(e.target.value)}
                                className="flex-grow px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
                                required
                              />
                              <select
                                value={editSubjectCourse}
                                onChange={(e) => setEditSubjectCourse(e.target.value)}
                                className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
                              >
                                {!config.courses.includes(editSubjectCourse) && (
                                  <option value={editSubjectCourse}>
                                    {editSubjectCourse} (মুছে ফেলা কোর্স)
                                  </option>
                                )}
                                {config.courses.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                              <div className="flex gap-1.5 sm:ml-auto">
                                <button
                                  onClick={() => handleSaveSubjectEdit(idx)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> সংরক্ষণ
                                </button>
                                <button
                                  onClick={() => setEditingSubjectIdx(null)}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> বাতিল
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <span className="font-bold text-slate-800">
                                  {toBengaliDigits(idx + 1)}. {sub.name}
                                </span>
                                <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded ml-2">
                                  {sub.course}
                                </span>
                              </div>
                              <div className="flex gap-2 justify-end sm:ml-auto">
                                <button
                                  onClick={() => startEditSubject(idx, sub)}
                                  className="text-amber-600 hover:text-amber-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                                >
                                  <Edit3 className="w-3.5 h-3.5" /> এডিট
                                </button>
                                <button
                                  onClick={() => handleDeleteSubject(idx)}
                                  className="text-rose-600 hover:text-rose-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> মুছুন
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "topics" && (
              <div className="space-y-5">
                {/* Add new topic */}
                <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
                  <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> নতুন টপিক যোগ করুন
                  </h3>
                  <form onSubmit={handleAddTopic} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      required
                      placeholder="যেমন: প্রাচীন ও মধ্যযুগ"
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl text-xs sm:text-sm transition whitespace-nowrap shadow cursor-pointer"
                    >
                      টপিক যোগ করুন
                    </button>
                  </form>
                </div>

                {/* Filter and List topics */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                      বিদ্যমান টপিকসমূহ ({toBengaliDigits((config.topics || []).length)} টি):
                    </h4>

                    {/* Search bar */}
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="টপিক বা প্রশ্ন খুঁজুন..."
                        value={topicSearch}
                        onChange={(e) => setTopicSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {!config.topics || config.topics.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                        কোনো টপিক পাওয়া যায়নি। উপরের ফর্ম থেকে নতুন টপিক যোগ করুন।
                      </p>
                    ) : (
                      config.topics
                        .filter((t) => {
                          if (topicSearch.trim()) {
                            const qLower = topicSearch.trim().toLowerCase();
                            if (t.toLowerCase().includes(qLower)) return true;
                            const questionsInTopic = getQuestionsByTopic(t);
                            return questionsInTopic.some(
                              (item) =>
                                item.q.toLowerCase().includes(qLower) ||
                                (item.originalExamTitle && item.originalExamTitle.toLowerCase().includes(qLower))
                            );
                          }
                          return true;
                        })
                        .map((t, filteredIdx) => {
                          const originalIdx = (config.topics || []).indexOf(t);
                          const isEditing = editingTopicIdx === originalIdx;
                          const topicQuestions = getQuestionsByTopic(t);
                          const isExpanded = expandedTopic === t;

                          return (
                            <div
                              key={originalIdx}
                              className={`rounded-2xl border transition-all ${
                                isEditing
                                  ? "border-indigo-400 bg-indigo-50/20 p-3.5"
                                  : "border-slate-200 bg-slate-50 overflow-hidden shadow-2xs"
                              }`}
                            >
                              {isEditing ? (
                                <div className="flex flex-col sm:flex-row gap-2 w-full">
                                  <input
                                    type="text"
                                    value={editTopicName}
                                    onChange={(e) => setEditTopicName(e.target.value)}
                                    className="flex-grow px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
                                    placeholder="টপিকের নাম"
                                    required
                                  />
                                  <div className="flex gap-1.5 sm:ml-auto">
                                    <button
                                      onClick={() => handleSaveTopicEdit(originalIdx)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                                    >
                                      <Check className="w-3.5 h-3.5" /> সংরক্ষণ
                                    </button>
                                    <button
                                      onClick={() => setEditingTopicIdx(null)}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                                    >
                                      <X className="w-3.5 h-3.5" /> বাতিল
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  {/* Topic Card Header */}
                                  <div className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <span className="font-bold text-slate-800 text-sm">
                                        {toBengaliDigits(filteredIdx + 1)}. {t}
                                      </span>
                                      <span className="text-[11px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                                        {toBengaliDigits(topicQuestions.length)} টি প্রশ্ন
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 sm:ml-auto">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTopic(isExpanded ? null : t)}
                                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1.5 ${
                                          isExpanded
                                            ? "bg-indigo-600 text-white border-indigo-600"
                                            : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                                        }`}
                                      >
                                        {isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                        {isExpanded ? "প্রশ্ন লুকান" : "প্রশ্নসমূহ দেখুন"}
                                      </button>
                                      <button
                                        onClick={() => startEditTopic(originalIdx, t)}
                                        className="text-amber-600 hover:text-amber-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" /> এডিট
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTopic(originalIdx)}
                                        className="text-rose-600 hover:text-rose-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" /> মুছুন
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expandable Question List inside Topic */}
                                  {isExpanded && (
                                    <div className="bg-white p-3.5 border-t border-slate-200 space-y-3">
                                      <div className="flex justify-between items-center pb-1">
                                        <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                          <Layers className="w-3.5 h-3.5 text-indigo-600" /> &quot;{t}&quot; টপিকের
                                          প্রশ্ন তালিকা:
                                        </h5>
                                        <span className="text-[11px] text-slate-500 font-medium">
                                          মোট: {toBengaliDigits(topicQuestions.length)} টি প্রশ্ন
                                        </span>
                                      </div>

                                      {topicQuestions.length === 0 ? (
                                        <div className="py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                          এই টপিকে এখনও কোনো প্রশ্ন যুক্ত করা হয়নি। প্রশ্ন তৈরির সময় এই টপিক নির্বাচন
                                          করলে স্বয়ংক্রিয়ভাবে এখানে যুক্ত হয়ে যাবে।
                                        </div>
                                      ) : (
                                        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                                          {topicQuestions.map((item, qIdx) => {
                                            const hasActiveExam = item.examKey && config?.exams?.[item.examKey];
                                            return (
                                              <div
                                                key={item.id || qIdx}
                                                className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition space-y-2"
                                              >
                                                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                                  <div className="space-y-1 flex-grow">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                                        {toBengaliDigits(qIdx + 1)}. {item.q}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                                      {item.originalExamTitle && (
                                                        <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-semibold">
                                                          মূল এক্সাম: {item.originalExamTitle}
                                                        </span>
                                                      )}
                                                      {item.originalCourse && (
                                                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-medium">
                                                          {item.originalCourse}
                                                        </span>
                                                      )}
                                                      {item.originalSubject && (
                                                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-medium">
                                                          {item.originalSubject}
                                                        </span>
                                                      )}
                                                      {!hasActiveExam && (
                                                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                                                          সংরক্ষিত প্রশ্ন
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-1 shrink-0">
                                                    {hasActiveExam && item.examKey && (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setSelectedExamKey(item.examKey!);
                                                          setActiveTab("questions");
                                                        }}
                                                        className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                                      >
                                                        <ExternalLink className="w-3 h-3" /> এক্সাম ওপেন করুন
                                                      </button>
                                                    )}
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteTopicQuestion(item.id)}
                                                      className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 p-1.5 rounded-lg text-xs transition cursor-pointer flex items-center"
                                                      title="টপিক ভাণ্ডার থেকে মুছুন"
                                                    >
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                </div>

                                                {/* Options display */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                                                  {item.opts.map((opt, optIdx) => (
                                                    <div key={optIdx} className="flex items-center gap-1 truncate">
                                                      <span className="text-slate-400 font-medium">
                                                        {optIdx === 0
                                                          ? "ক)"
                                                          : optIdx === 1
                                                          ? "খ)"
                                                          : optIdx === 2
                                                          ? "গ)"
                                                          : "ঘ)"}
                                                      </span>
                                                      <span className="truncate">{opt}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "students" && <StudentApproval courses={config.courses || []} />}

            {activeTab === "questions" && config.exams?.[selectedExamKey] && (
              isFullDataLoaded ? (
                <QuestionBuilder
                  activeExamKey={selectedExamKey}
                  exam={config.exams[selectedExamKey]}
                  allExams={config.exams || {}}
                  onSelectExamKey={(k) => setSelectedExamKey(k)}
                  topics={config.topics || []}
                  onRefresh={loadData}
                />
              ) : (
                <div className="flex items-center justify-center p-10 text-slate-500 gap-2 font-bengali">
                  <Loader2 className="w-5 h-5 animate-spin" /> প্রশ্ন লোড হচ্ছে...
                </div>
              )
            )}

            {activeTab === "submissions" && <SubmissionsTable />}

            {activeTab === "drivelinks" && (
              <div className="max-w-md bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-600" /> গুগল ড্রাইভ লিংক সেটিংস (রুটিন ও সিলেবাস)
                </h3>
                <form onSubmit={handleSaveDriveLinks} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      পরীক্ষার রুটিন (Google Drive URL)
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/..."
                      value={driveRoutine}
                      onChange={(e) => setDriveRoutine(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      কোর্স সিলেবাস (Google Drive URL)
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/..."
                      value={driveSyllabus}
                      onChange={(e) => setDriveSyllabus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer"
                  >
                    লিংক আপডেট করুন
                  </button>
                </form>
              </div>
            )}


          </div>
        </div>
      </main>

      {bulkTopicName && (
        <BulkQuestionImporterModal
          isOpen={true}
          targetTopic={bulkTopicName}
          topics={config?.topics || []}
          onClose={() => setBulkTopicName(null)}
          onSuccess={loadData}
        />
      )}

      <Footer />
    </>
  );
}
