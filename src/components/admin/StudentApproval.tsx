"use client";

import React, { useState, useEffect } from "react";
import { EnrollmentRequest, AllowedStudent } from "@/types/student";
import { getEnrollRequests, approveEnrollRequest } from "@/actions/enroll-actions";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, deleteDoc, setDoc } from "firebase/firestore";
import { Bell, Check, UserPlus, Trash2, Edit2, RotateCw } from "lucide-react";
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

  const loadData = async () => {
    setIsLoading(true);
    const reqs = await getEnrollRequests();
    setRequests(reqs);

    const snap = await getDocs(collection(db, "allowed_students"));
    const list: AllowedStudent[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        docId: d.id,
        id: data.id || d.id,
        name: data.name || "শিক্ষার্থী",
        courses: data.courses || (data.course ? [data.course] : ["ALL"]),
      });
    });
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

    await setDoc(
      doc(db, "allowed_students", cleanId),
      {
        id: cleanId,
        name: newName.trim(),
        courses: [newCourse],
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    setNewId("");
    setNewName("");
    loadData();
    alert("শিক্ষার্থী তালিকাভুক্ত হয়েছে।");
  };

  const handleDelete = async (id: string) => {
    if (confirm(`আপনি কি এই শিক্ষার্থীকে (${id}) মুছে ফেলতে চান?`)) {
      await deleteDoc(doc(db, "allowed_students", id));
      loadData();
    }
  };

  return (
    <div className="space-y-6 font-bengali">
      {/* Enrollment Requests Section */}
      <div className="bg-amber-50/70 p-4 sm:p-5 rounded-2xl border border-amber-200 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-amber-900 text-xs sm:text-sm flex items-center">
            <Bell className="w-4 h-4 text-amber-600 mr-1.5 animate-bounce" /> নতুন এনরোলমেন্ট রিকোয়েস্টসমূহ (
            {toBengaliDigits(requests.length)} টি):
          </h4>
          <button
            onClick={loadData}
            className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" /> রিফ্রেশ
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {requests.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">কোনো নতুন এনরোলমেন্ট রিকোয়েস্ট নেই।</p>
          ) : (
            requests.map((req, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-amber-200 bg-white shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {req.name} <span className="text-indigo-600 font-mono">({req.id})</span>
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

      {/* Allowed Students List */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">
          অনুমোদিত স্টুডেন্ট আইডি ও নাম তালিকা ({toBengaliDigits(students.length)} জন):
        </h4>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {students.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">কোনো অনুমোদিত আইডি নেই।</p>
          ) : (
            students.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center text-xs sm:text-sm"
              >
                <div>
                  <span className="font-mono font-bold text-indigo-700">{item.id}</span>
                  <span className="text-slate-700 ml-2 font-medium">- {item.name}</span>
                  <span className="inline-block bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 border border-indigo-200">
                    {item.courses?.includes("ALL") ? "সকল কোর্স" : item.courses?.join(", ") || "সকল কোর্স"}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="bg-rose-100 hover:bg-rose-200 text-rose-700 font-medium text-xs px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> মুছুন
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
