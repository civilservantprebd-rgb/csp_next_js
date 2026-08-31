"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { EnrollmentRequest, AllowedStudent } from "@/types/student";
import { getEnrollRequests, approveEnrollRequest } from "@/actions/enroll-actions";
import {
  getAllAllowedStudents,
  addAllowedStudentManual,
  updateAllowedStudent,
  deleteAllowedStudent,
  batchEnrollStudents
} from "@/actions/student-actions";
import {
  Bell,
  Check,
  UserPlus,
  Trash2,
  Edit2,
  RotateCw,
  X,
  Save,
  Search,
  Users,
  CheckSquare,
  Square,
  BookOpen,
  UserCheck,
  Sparkles
} from "lucide-react";
import { parseBengaliDigits, toBengaliDigits } from "@/lib/utils";

interface StudentApprovalProps {
  courses: string[];
}

export const StudentApproval: React.FC<StudentApprovalProps> = ({ courses }) => {
  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [students, setStudents] = useState<AllowedStudent[]>([]);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newCourse, setNewCourse] = useState("ALL");
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCourse, setFilterCourse] = useState("ALL_FILTER");

  // Selection for Batch Actions
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [batchCourses, setBatchCourses] = useState<string[]>([]);

  // Edit state
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCourses, setEditCourses] = useState<string[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    const reqs = await getEnrollRequests();
    setRequests(reqs);

    const list = await getAllAllowedStudents();
    setStudents(list);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (req: EnrollmentRequest) => {
    const rawCourses = (req.course || "ALL")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await approveEnrollRequest(req.docId || "", req.id, req.name, rawCourses);
    alert(res.message);
    loadData();
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = parseBengaliDigits(newId).trim();
    if (!cleanId || !newName.trim()) return;

    const res = await addAllowedStudentManual(cleanId, newName.trim(), newCourse);
    alert(res.message);

    setNewId("");
    setNewName("");
    loadData();
  };

  const startEdit = (student: AllowedStudent) => {
    setEditingStudentId(student.id);
    setEditName(student.name);
    setEditCourses(student.courses && student.courses.length > 0 ? student.courses : []);
  };

  const cancelEdit = () => {
    setEditingStudentId(null);
    setEditName("");
    setEditCourses([]);
  };

  const handleSaveEdit = async (studentId: string) => {
    if (!editName.trim()) {
      alert("শিক্ষার্থীর নাম প্রদান করা আবশ্যক।");
      return;
    }
    const res = await updateAllowedStudent(studentId, editName, editCourses);
    alert(res.message);
    if (res.success) {
      setEditingStudentId(null);
      loadData();
    }
  };

  const toggleCourseInEdit = (cName: string) => {
    if (cName === "ALL") {
      setEditCourses((prev) => (prev.includes("ALL") ? [] : ["ALL"]));
      return;
    }

    setEditCourses((prev) => {
      const filtered = prev.filter((c) => c !== "ALL");
      if (filtered.includes(cName)) {
        return filtered.filter((c) => c !== cName);
      } else {
        return [...filtered, cName];
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm("আপনি কি নিশ্চিতভাবে এই শিক্ষার্থীকে মুছে ফেলতে চান?")) {
      const ok = await deleteAllowedStudent(id);
      if (ok) {
        setStudents((prev) => prev.filter((s) => s.id !== id));
      } else {
        alert("শিক্ষার্থী মুছতে সমস্যা হয়েছে।");
      }
    }
  };

  // Select / Deselect Logic
  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (filteredList: AllowedStudent[]) => {
    if (selectedStudentIds.length === filteredList.length && filteredList.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredList.map((s) => s.id));
    }
  };

  const toggleBatchCourse = (cName: string) => {
    if (cName === "ALL") {
      setBatchCourses((prev) => (prev.includes("ALL") ? [] : ["ALL"]));
      return;
    }
    setBatchCourses((prev) => {
      const filtered = prev.filter((c) => c !== "ALL");
      if (filtered.includes(cName)) {
        return filtered.filter((c) => c !== cName);
      } else {
        return [...filtered, cName];
      }
    });
  };

  const handleApplyBatchEnroll = async () => {
    if (selectedStudentIds.length === 0) {
      alert("কমপক্ষে একজন শিক্ষার্থী নির্বাচন করুন।");
      return;
    }
    if (batchCourses.length === 0) {
      alert("কমপক্ষে একটি কোর্স নির্বাচন করুন।");
      return;
    }

    const res = await batchEnrollStudents(selectedStudentIds, batchCourses);
    alert(res.message);
    if (res.success) {
      setSelectedStudentIds([]);
      setBatchCourses([]);
      loadData();
    }
  };

  // Filter students based on search and selected course
  const filteredStudents = students.filter((st) => {
    // Search query match
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      st.name.toLowerCase().includes(query) ||
      (st.email && st.email.toLowerCase().includes(query)) ||
      st.id.toLowerCase().includes(query);

    // Course filter match
    let matchesCourse = true;
    if (filterCourse === "UNENROLLED") {
      matchesCourse = !st.courses || st.courses.length === 0;
    } else if (filterCourse !== "ALL_FILTER") {
      matchesCourse =
        st.courses?.includes("ALL") || st.courses?.includes(filterCourse);
    }

    return matchesSearch && matchesCourse;
  });

  return (
    <div className="space-y-6 font-bengali">
      {/* Pending Enroll Requests Banner */}
      <div className="bg-amber-50/70 p-4 sm:p-5 rounded-2xl border border-amber-200 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-amber-900 text-xs sm:text-sm flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-amber-600 animate-pulse" /> অপেক্ষমান এনরোলমেন্ট রিকোয়েস্ট (
            {toBengaliDigits(requests.length)}টি)
          </h3>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="text-amber-700 hover:text-amber-900 text-xs flex items-center gap-1 cursor-pointer font-medium"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> রিফ্রেশ
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {requests.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3 bg-white/60 rounded-xl">
              কোনো অপেক্ষমান এনরোলমেন্ট রিকোয়েস্ট নেই।
            </p>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
              >
                <div>
                  <p className="font-bold text-slate-800">
                    {req.name} ({req.email || req.id})
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                      {req.course || "সাধারণ কোর্স"}
                    </span>{" "}
                    | TrxID: <span className="font-mono font-bold text-amber-700">{req.trxId}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleApprove(req)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> ভেরিফাই ও এনরোল করুন
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual Student Addition */}
      <div className="bg-indigo-50/60 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
        <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-indigo-600" /> ম্যানুয়ালি নতুন শিক্ষার্থী যোগ ও কোর্স এনরোলমেন্ট
        </h3>

        <form onSubmit={handleAddManual} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">স্টুডেন্ট আইডি / ইমেইল / মোবাইল</label>
            <input
              type="text"
              required
              placeholder="যেমন: student@gmail.com বা UID"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">শিক্ষার্থীর নাম</label>
            <input
              type="text"
              required
              placeholder="যেমন: তানভীর আহমেদ"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">প্রাথমিক এনরোলমেন্ট কোর্স</label>
            <select
              value={newCourse}
              onChange={(e) => setNewCourse(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white cursor-pointer"
            >
              <option value="ALL">সকল কোর্স (All Courses)</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" /> শিক্ষার্থী সংরক্ষণ ও এনরোল করুন
            </button>
          </div>
        </form>
      </div>

      {/* Main Student Management Section */}
      <div className="space-y-4">
        {/* Section Header & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" /> রেজিস্টার্ড শিক্ষার্থী ও কোর্স এনরোলমেন্ট সেকশন
            </h3>
            <p className="text-xs text-slate-500">
              যেকোনো লগইনকৃত শিক্ষার্থীকে ডাটাবেজ থেকে এক বা একাধিক কোর্সে এনরোল করতে পারবেন
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-xl text-xs border border-indigo-100">
              মোট শিক্ষার্থী: {toBengaliDigits(students.length)} জন
            </span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="শিক্ষার্থীর নাম, ইমেইল বা আইডি দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>

          <div>
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white cursor-pointer"
            >
              <option value="ALL_FILTER">সকল শিক্ষার্থী ({toBengaliDigits(students.length)})</option>
              <option value="UNENROLLED">কোনো কোর্সে এনরোল করা হয়নি</option>
              <option value="ALL">সকল কোর্সের এক্সেসপ্রাপ্ত (ALL)</option>
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Batch Course Enrollment Action Bar */}
        {selectedStudentIds.length > 0 && (
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-md space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-xs sm:text-sm">
                  {toBengaliDigits(selectedStudentIds.length)} জন শিক্ষার্থী নির্বাচিত হয়েছে
                </span>
              </div>

              <button
                onClick={() => setSelectedStudentIds([])}
                className="text-slate-300 hover:text-white text-xs underline cursor-pointer self-end sm:self-auto"
              >
                নির্বাচন বাতিল করুন
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-indigo-200">
                এক বা একাধিক কোর্স নির্বাচন করুন:
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleBatchCourse("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    batchCourses.includes("ALL")
                      ? "bg-amber-500 text-slate-950 border-amber-400"
                      : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                  }`}
                >
                  সকল কোর্স (ALL)
                </button>
                {courses.map((c) => {
                  const isSel = !batchCourses.includes("ALL") && batchCourses.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleBatchCourse(c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        isSel
                          ? "bg-indigo-500 text-white border-indigo-400"
                          : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleApplyBatchEnroll}
                className="mt-2 w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> নির্বাচিত শিক্ষার্থীদের কোর্সে এনরোল করুন
              </button>
            </div>
          </div>
        )}

        {/* Student List Toolbar */}
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => toggleSelectAll(filteredStudents)}
            className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer hover:text-indigo-600"
          >
            {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-indigo-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>সবাইকে সিলেক্ট করুন ({toBengaliDigits(filteredStudents.length)})</span>
          </button>
        </div>

        {/* Registered Students Cards List */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <Users className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400 font-medium">কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
            </div>
          ) : (
            filteredStudents.map((item) => {
              const isSelected = selectedStudentIds.includes(item.id);
              const isEditing = editingStudentId === item.id;

              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border-2 border-indigo-500 bg-indigo-50/50 space-y-4 text-xs sm:text-sm shadow-md"
                  >
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        {item.photoURL ? (
                          <Image src={item.photoURL} alt="Avatar" width={32} height={32} className="w-8 h-8 rounded-full border border-indigo-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                            {item.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-indigo-950">{item.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{item.email || item.id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" /> সেভ করুন
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition"
                        >
                          <X className="w-3.5 h-3.5" /> বাতিল
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">শিক্ষার্থীর নাম</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                          অনুমোদিত কোর্সসমূহ (এক বা একাধিক চেক করুন):
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 bg-white rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => toggleCourseInEdit("ALL")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                              editCourses.includes("ALL")
                                ? "bg-amber-500 text-slate-950 border-amber-500"
                                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                            }`}
                          >
                            সকল কোর্স (ALL)
                          </button>
                          {courses.map((c) => {
                            const isSel = !editCourses.includes("ALL") && editCourses.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => toggleCourseInEdit(c)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                  isSel
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                {c}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm shadow-2xs ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50/30"
                      : "border-slate-200 bg-white hover:bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelectStudent(item.id)}
                      className="mt-1 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 hover:text-slate-500 shrink-0" />
                      )}
                    </button>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.photoURL ? (
                          <Image src={item.photoURL} alt="Avatar" width={24} height={24} className="w-6 h-6 rounded-full border border-slate-200" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                            {item.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-slate-900 font-bold">{item.name}</span>
                        {item.email && (
                          <span className="text-slate-500 font-medium text-[11px] truncate">
                            ({item.email})
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="text-[10px] text-slate-400 font-medium">এনরোলমেন্ট:</span>
                        {!item.courses || item.courses.length === 0 ? (
                          <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-200">
                            কোনো কোর্সে এনরোল করা হয়নি
                          </span>
                        ) : item.courses.includes("ALL") ? (
                          <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                            সকল কোর্স (All Courses)
                          </span>
                        ) : (
                          item.courses.map((c) => (
                            <span
                              key={c}
                              className="bg-indigo-50 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200"
                            >
                              {c}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button
                      onClick={() => startEdit(item)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 border border-indigo-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> কোর্স এনরোলমেন্ট পরিবর্তন
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs p-1.5 rounded-xl transition cursor-pointer flex items-center border border-rose-200"
                      title="শিক্ষার্থী মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
