"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { AdminNav, AdminTabType } from "@/components/admin/AdminNav";
import { ExamManager } from "@/components/admin/ExamManager";
import { QuestionBuilder } from "@/components/admin/QuestionBuilder";
import { StudentApproval } from "@/components/admin/StudentApproval";
import { SubmissionsTable } from "@/components/admin/SubmissionsTable";
import { fetchAppConfig, saveAppConfig } from "@/actions/admin-actions";
import { AppConfigData, Exam } from "@/types/exam";
import {
  LogOut,
  Users,
  Plus,
  Trash2,
  Link2,
  Loader2,
  Edit3,
  Check,
  X
} from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

export default function AdminPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfigData | null>(null);
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

  const loadData = async () => {
    const rawUser = sessionStorage.getItem("teacher_user");
    if (!rawUser) {
      router.push("/");
      return;
    }
    const parsedUser = JSON.parse(rawUser);
    setTeacherUser(parsedUser);

    const data = await fetchAppConfig();
    setConfig(data);
    setDriveRoutine(data.driveRoutineUrl || "");
    setDriveSyllabus(data.driveSyllabusUrl || "");
    if (data.courses?.length) {
      setNewSubjectCourse(data.courses[0]);
    }

    const keys = Object.keys(data.exams || {});
    if (keys.length > 0) {
      setSelectedExamKey(keys[0]);
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  if (!config || !teacherUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 font-bengali text-slate-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> প্যানেল লোড হচ্ছে...
      </div>
    );
  }

  const handleLogout = () => {
    if (confirm("আপনি কি নিশ্চিতভাবে শিক্ষক প্যানেল থেকে লগআউট করতে চান?")) {
      sessionStorage.removeItem("teacher_user");
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

    // 3. Update exams assigned to this course
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
      exams: nextExams
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

            {activeTab === "students" && <StudentApproval courses={config.courses || []} />}

            {activeTab === "questions" && config.exams?.[selectedExamKey] && (
              <QuestionBuilder
                activeExamKey={selectedExamKey}
                exam={config.exams[selectedExamKey]}
                onRefresh={loadData}
              />
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

      <Footer />
    </>
  );
}
