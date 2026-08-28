"use client";

import React, { useState, useEffect } from "react";
import { EnrollmentRequest, AllowedStudent } from "@/types/student";
import { getEnrollRequests, approveEnrollRequest } from "@/actions/enroll-actions";
import {
  getAllAllowedStudents,
  addAllowedStudentManual,
  updateAllowedStudent,
  deleteAllowedStudent
} from "@/actions/student-actions";
import { Bell, Check, UserPlus, Trash2, Edit2, RotateCw, X, Save } from "lucide-react";
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

  // Edit state
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCourses, setEditCourses] = useState<string[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    const reqs = await getEnrollRequests();
    setRequests(reqs);

    const list = await getAllAllowedStudents();
    list.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    setStudents(list);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (req: EnrollmentRequest) => {
    const res = await approveEnrollRequest(req.docId || "", req.id, req.name, req.course || "ALL");
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
    setEditCourses(student.courses && student.courses.length > 0 ? student.courses : ["ALL"]);
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
    const finalCourses = editCourses.length > 0 ? editCourses : ["ALL"];
    const res = await updateAllowedStudent(studentId, editName, finalCourses);
    alert(res.message);
    if (res.success) {
      setEditingStudentId(null);
      loadData();
    }
  };

  const toggleCourseInEdit = (cName: string) => {
    if (cName === "ALL") {
      setEditCourses(["ALL"]);
      return;
    }

    setEditCourses((prev) => {
      const filtered = prev.filter((c) => c !== "ALL");
      if (filtered.includes(cName)) {
        const next = filtered.filter((c) => c !== cName);
        return next.length === 0 ? ["ALL"] : next;
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

  return (
    <div className="space-y-6 font-bengali">
      {/* Pending Enroll Requests */}
      <div className="bg-amber-50/50 p-4 sm:p-5 rounded-2xl border border-amber-200 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-amber-900 text-xs sm:text-sm flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-amber-600 animate-pulse" /> অপেক্ষমান এনরোলমেন্ট রিকোয়েস্ট (
            {toBengaliDigits(requests.length)}টি)
          </h3>
          <button
            onClick={loadData}
            className="text-amber-700 hover:text-amber-900 text-xs flex items-center gap-1 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" /> রিফ্রেশ
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {requests.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4 bg-white/50 rounded-xl">
              কোনো অপেক্ষমান রিকোয়েস্ট নেই।
            </p>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
              >
                <div>
                  <p className="font-bold text-slate-800">
                    {req.name} ({req.id})
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
                  <Check className="w-3.5 h-3.5" /> ভেরিফাই ও এপ্রুভ
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Manual Student Addition */}
      <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
        <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-indigo-600" /> সরাসরি অনুমোদিত শিক্ষার্থী যোগ করুন
        </h3>

        <form onSubmit={handleAddManual} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">স্টুডেন্ট আইডি / মোবাইল</label>
            <input
              type="text"
              required
              placeholder="যেমন: 01700000000"
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
              placeholder="যেমন: আব্দুর রহিম"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-700 mb-1">অনুমোদিত কোর্স</label>
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer"
            >
              তালিকাভুক্ত করুন
            </button>
          </div>
        </form>
      </div>

      {/* Allowed Students List & Course Modifier */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">
          অনুমোদিত শিক্ষার্থী তালিকা ও কোর্স পরিবর্তন ({toBengaliDigits(students.length)} জন):
        </h4>
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {students.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">কোনো অনুমোদিত আইডি নেই।</p>
          ) : (
            students.map((item) => {
              const isEditing = editingStudentId === item.id;

              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border-2 border-indigo-500 bg-indigo-50/40 space-y-3 text-xs sm:text-sm shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                      <span className="font-mono font-bold text-indigo-950">আইডি: {item.id}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" /> সংরক্ষণ করুন
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition"
                        >
                          <X className="w-3.5 h-3.5" /> বাতিল
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">অনুমোদিত কোর্সসমূহ নির্বাচন করুন</label>
                        <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() => toggleCourseInEdit("ALL")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              editCourses.includes("ALL")
                                ? "bg-indigo-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            সকল কোর্স (ALL)
                          </button>
                          {courses.map((c) => {
                            const isSelected = !editCourses.includes("ALL") && editCourses.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => toggleCourseInEdit(c)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  isSelected
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                  className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-indigo-700">{item.id}</span>
                      <span className="text-slate-800 font-bold">{item.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">কোর্স:</span>
                      {item.courses?.includes("ALL") ? (
                        <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                          সকল কোর্স (All Courses)
                        </span>
                      ) : (
                        (item.courses || []).map((c) => (
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

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => startEdit(item)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 border border-indigo-200"
                    >
                      <Edit2 className="w-3 h-3" /> কোর্স ও তথ্য পরিবর্তন
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 border border-rose-200"
                    >
                      <Trash2 className="w-3 h-3" />
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
