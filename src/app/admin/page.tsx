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
  Lock,
  Link2,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

export default function AdminPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AppConfigData | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabType>("exams");
  const [selectedExamKey, setSelectedExamKey] = useState("");
  const [teacherUser, setTeacherUser] = useState<{ email: string; role: "admin" | "subadmin" } | null>(null);

  // Sub-forms state
  const [newCourseName, setNewCourseName] = useState("");
  const [newSubjectCourse, setNewSubjectCourse] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [driveRoutine, setDriveRoutine] = useState("");
  const [driveSyllabus, setDriveSyllabus] = useState("");
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [subAdminName, setSubAdminName] = useState("");
  const [subAdminPass, setSubAdminPass] = useState("");

  const loadData = async () => {
    const rawUser = sessionStorage.getItem("teacher_user");
    if (!rawUser) {
      router.push("/");
      return;
    }
    const parsedUser = JSON.parse(rawUser);
    setTeacherUser(parsedUser);

    if (parsedUser.role === "subadmin") {
      setActiveTab("students");
    }

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
      const nextSubjects = config.subjects.filter((s) => s.course !== courseName);
      await saveAppConfig({ courses: nextCourses, subjects: nextSubjects });
      loadData();
    }
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

  // Drive links
  const handleSaveDriveLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAppConfig({
      driveRoutineUrl: driveRoutine.trim(),
      driveSyllabusUrl: driveSyllabus.trim(),
    });
    alert("গুগল ড্রাইভ লিংক সফলভাবে আপডেট করা হয়েছে।");
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currPass !== config.teacherPass) {
      alert("বর্তমান পাসওয়ার্ড সঠিক নয়।");
      return;
    }
    await saveAppConfig({ teacherPass: newPass.trim() });
    setCurrPass("");
    setNewPass("");
    alert("পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।");
  };

  // Sub Admins
  const handleAddSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = subAdminName.trim();
    const pass = subAdminPass.trim();
    if (!name || !pass) return;

    const list = config.subAdmins || [];
    if (pass === config.teacherPass || list.some((s) => s.pass === pass)) {
      alert("এই পাসওয়ার্ডটি ইতিমধ্যে ব্যবহৃত হচ্ছে।");
      return;
    }

    list.push({ name, pass });
    await saveAppConfig({ subAdmins: list });
    setSubAdminName("");
    setSubAdminPass("");
    loadData();
    alert("নতুন সাব-এডমিন যোগ করা হয়েছে।");
  };

  const handleDeleteSubAdmin = async (idx: number) => {
    if (confirm("আপনি কি এই সাব-এডমিনকে মুছে ফেলতে চান?")) {
      const list = [...(config.subAdmins || [])];
      list.splice(idx, 1);
      await saveAppConfig({ subAdmins: list });
      loadData();
    }
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
                  <span className="text-[9px] sm:text-[10px] text-indigo-600 font-semibold block">
                    {teacherUser.role === "subadmin" ? "সাব-এডমিন" : "এডমিন"}
                  </span>
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
          <AdminNav activeTab={activeTab} role={teacherUser.role} onTabChange={setActiveTab} />

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
                    {config.courses.map((course, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center text-xs sm:text-sm"
                      >
                        <span className="font-bold text-slate-800">
                          {toBengaliDigits(idx + 1)}. {course}
                        </span>
                        <button
                          onClick={() => handleDeleteCourse(course)}
                          className="text-rose-600 hover:text-rose-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> মুছুন
                        </button>
                      </div>
                    ))}
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
                    {config.subjects.map((sub, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center text-xs sm:text-sm"
                      >
                        <div>
                          <span className="font-bold text-slate-800">
                            {toBengaliDigits(idx + 1)}. {sub.name}
                          </span>
                          <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded ml-2">
                            {sub.course}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteSubject(idx)}
                          className="text-rose-600 hover:text-rose-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> মুছুন
                        </button>
                      </div>
                    ))}
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

            {activeTab === "subadmins" && (
              <div className="space-y-5">
                <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
                  <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" /> নতুন সাব-এডমিন তৈরি করুন
                  </h3>
                  <form onSubmit={handleAddSubAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">সাব-এডমিনের নাম</label>
                      <input
                        type="text"
                        required
                        placeholder="যেমন: সহকারি শিক্ষক ১"
                        value={subAdminName}
                        onChange={(e) => setSubAdminName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">লগইন পাসওয়ার্ড</label>
                      <input
                        type="password"
                        required
                        placeholder="পাসওয়ার্ড দিন"
                        value={subAdminPass}
                        onChange={(e) => setSubAdminPass(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
                      />
                    </div>
                    <div>
                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer"
                      >
                        সাব-এডমিন যোগ করুন
                      </button>
                    </div>
                  </form>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">বিদ্যমান সাব-এডমিন তালিকা:</h4>
                  <div className="space-y-2">
                    {!config.subAdmins || config.subAdmins.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">কোনো সাব-এডমিন তৈরি করা হয়নি।</p>
                    ) : (
                      config.subAdmins.map((sub, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center text-xs sm:text-sm"
                        >
                          <div>
                            <span className="font-bold text-slate-800">{sub.name}</span>
                            <span className="text-slate-400 font-mono text-[11px] ml-2">
                              (পাসওয়ার্ড: {sub.pass})
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteSubAdmin(idx)}
                            className="text-rose-600 hover:text-rose-800 font-semibold text-xs px-2 py-1 cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> মুছুন
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "security" && (
              <div className="max-w-md bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-600" /> পাসওয়ার্ড পরিবর্তন করুন
                </h3>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">বর্তমান পাসওয়ার্ড</label>
                    <input
                      type="password"
                      required
                      value={currPass}
                      onChange={(e) => setCurrPass(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">নতুন পাসওয়ার্ড</label>
                    <input
                      type="password"
                      required
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer"
                  >
                    পাসওয়ার্ড আপডেট করুন
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
