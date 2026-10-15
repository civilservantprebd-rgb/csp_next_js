"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  Search,
  ArrowLeft,
  UserX,
  FileText,
  BarChart2,
  CheckCircle2,
  Clock,
  Sparkles,
  Share2,
  Award,
  Layers,
  GraduationCap
} from "lucide-react";
import {
  getStudyGroups,
  createStudyGroup,
  deleteStudyGroup,
  getGroupDetails,
  removeMemberFromGroup,
  addMembersBulk,
  getExamsForGroupCourse,
  getGroupExamAttendance
} from "@/actions/study-group-actions";
import { StudyGroup, StudyGroupMember, GroupExamAttendance } from "@/types/study-group";
import { toBengaliDigits } from "@/lib/utils";

interface StudyGroupManagerProps {
  courses: string[];
}

export const StudyGroupManager: React.FC<StudyGroupManagerProps> = ({ courses }) => {
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // New Group Form
  const [isCreating, setIsCreating] = useState(false);
  const [newCourse, setNewCourse] = useState(courses[0] || "");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Selected Group for Monitoring
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<StudyGroupMember[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [activeSubTab, setActiveSubTab] = useState<"members" | "attendance">("members");

  // Bulk add members state
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);

  // Exam Attendance State
  const [groupExams, setGroupExams] = useState<{ id: string; title: string; course: string }[]>([]);
  const [selectedExamKey, setSelectedExamKey] = useState("");
  const [attendanceData, setAttendanceData] = useState<GroupExamAttendance | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [copiedReminder, setCopiedReminder] = useState(false);

  // Fetch groups
  const loadGroups = async () => {
    setLoading(true);
    const data = await getStudyGroups(courseFilter);
    setGroups(data);
    setLoading(false);
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter]);

  // Open details view for a group
  const handleOpenGroup = async (group: StudyGroup) => {
    setSelectedGroup(group);
    setLoadingDetails(true);
    setActiveSubTab("members");
    setMemberSearch("");
    setShowBulkAdd(false);

    const res = await getGroupDetails(group.id);
    setGroupMembers(res.members);
    setLoadingDetails(false);

    // কোর্সের পরীক্ষাগুলো লোড করা
    const exams = await getExamsForGroupCourse(group.course);
    setGroupExams(exams);
    if (exams.length > 0) {
      setSelectedExamKey(exams[0].id);
      loadExamAttendance(group.id, exams[0].id);
    } else {
      setSelectedExamKey("");
      setAttendanceData(null);
    }
  };

  // Load exam attendance
  const loadExamAttendance = async (groupId: string, examKey: string) => {
    if (!examKey) return;
    setLoadingAttendance(true);
    const data = await getGroupExamAttendance(groupId, examKey);
    setAttendanceData(data);
    setLoadingAttendance(false);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourse || !newName.trim()) {
      setErrorMsg("কোর্স এবং গ্রুপের নাম দেওয়া আবশ্যক।");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    const res = await createStudyGroup(newCourse, newName, newDesc);
    setSubmitting(false);

    if (res.success) {
      setNotice(res.message);
      setIsCreating(false);
      setNewName("");
      setNewDesc("");
      loadGroups();
      setTimeout(() => setNotice(""), 3500);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${groupName}" গ্রুপটি মুছে ফেলতে চান? গ্রুপের সকল সদস্য লিঙ্ক বাতিল হয়ে যাবে।`)) {
      return;
    }

    const res = await deleteStudyGroup(groupId);
    if (res.success) {
      setNotice(res.message);
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
      }
      loadGroups();
      setTimeout(() => setNotice(""), 3500);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleRemoveMember = async (studentId: string, studentName: string) => {
    if (!selectedGroup) return;
    if (!window.confirm(`আপনি কি "${studentName}"-কে এই গ্রুপ থেকে রিমুভ করতে চান?`)) {
      return;
    }

    const res = await removeMemberFromGroup(selectedGroup.id, studentId);
    if (res.success) {
      setGroupMembers((prev) => prev.filter((m) => m.studentId !== studentId));
      setNotice(res.message);
      // আপডেট অ্যাটেনডেন্স যদি থাকে
      if (selectedExamKey) {
        loadExamAttendance(selectedGroup.id, selectedExamKey);
      }
      setTimeout(() => setNotice(""), 3000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleBulkAdd = async () => {
    if (!selectedGroup || !bulkInput.trim()) return;
    setBulkAdding(true);
    setErrorMsg("");

    const res = await addMembersBulk(selectedGroup.id, bulkInput);
    setBulkAdding(false);

    if (res.success) {
      setNotice(res.message);
      setBulkInput("");
      setShowBulkAdd(false);
      // রিলোড মেম্বার
      const details = await getGroupDetails(selectedGroup.id);
      setGroupMembers(details.members);
      setTimeout(() => setNotice(""), 3500);
    } else {
      setErrorMsg(res.message);
    }
  };

  const copyInviteLink = (inviteCode: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://aarohon.com";
    const link = `${origin}/join-group/${inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(inviteCode);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const copyWhatsAppReminder = () => {
    if (!attendanceData || !selectedGroup) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://aarohon.com";
    const examUrl = `${origin}/exam/${attendanceData.examKey}`;

    let msg = `📢 *অনুস্মারক: ${selectedGroup.course} (${selectedGroup.name})*\n`;
    msg += `📝 আজকের পরীক্ষা: *${attendanceData.examTitle || attendanceData.examKey}*\n\n`;

    if (attendanceData.missedMembers.length > 0) {
      msg += `⚠️ আমাদের গ্রুপের নিচের সদস্যরা এখনো পরীক্ষাটি সম্পন্ন করোনি:\n`;
      attendanceData.missedMembers.forEach((m, idx) => {
        msg += `${toBengaliDigits(idx + 1)}. ${m.studentName} (${m.studentId})\n`;
      });
      msg += `\n⏰ দ্রুত লিংকে গিয়ে পরীক্ষাটি শেষ করার অনুরোধ করা হচ্ছে:\n🔗 ${examUrl}\n\n`;
      msg += `📊 গ্রুপের বর্তমান উপস্থিতি: ${toBengaliDigits(attendanceData.attendanceRate)}% (${toBengaliDigits(attendanceData.attendedCount)}/${toBengaliDigits(attendanceData.totalMembers)} জন)`;
    } else {
      msg += `🎉 চমৎকার! গ্রুপের সকল সদস্য আজকের পরীক্ষায় অংশগ্রহণ করেছে!`;
    }

    navigator.clipboard.writeText(msg);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 3000);
  };

  // Filtered members list
  const filteredMembers = groupMembers.filter((m) => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      (m.studentName || "").toLowerCase().includes(q) ||
      m.studentId.toLowerCase().includes(q) ||
      (m.studentEmail || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-bengali">
      {/* Toast Notifications */}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold">{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-2xl flex items-center gap-2 shadow-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {/* VIEW 1: SELECTED GROUP DEEP MONITORING VIEW */}
      {selectedGroup ? (
        <div className="space-y-6">
          {/* Top Navigation & Header */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedGroup(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                  title="গ্রুপ তালিকায় ফিরুন"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                      {selectedGroup.course}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">•</span>
                    <span className="text-xs text-slate-500 font-bold">
                      {toBengaliDigits(groupMembers.length)} জন সদস্য
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mt-1">{selectedGroup.name}</h2>
                </div>
              </div>

              {/* Invite Link Share Action */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-2xl">
                <div className="text-[11px] text-slate-500 font-medium px-2 truncate max-w-[200px] sm:max-w-[280px]">
                  join-group/{selectedGroup.inviteCode}
                </div>
                <button
                  onClick={() => copyInviteLink(selectedGroup.inviteCode)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                >
                  {copiedCode === selectedGroup.inviteCode ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> কপি হয়েছে
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> ইনভাইট লিংক
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Members vs Exam Attendance */}
            <div className="flex border-b border-slate-200 gap-6 pt-2">
              <button
                onClick={() => setActiveSubTab("members")}
                className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  activeSubTab === "members"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Users className="w-4 h-4" /> গ্রুপ সদস্য তালিকা ({toBengaliDigits(groupMembers.length)})
              </button>
              <button
                onClick={() => setActiveSubTab("attendance")}
                className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  activeSubTab === "attendance"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <BarChart2 className="w-4 h-4" /> পরীক্ষার উপস্থিতি ও মনিটরিং
              </button>
            </div>
          </div>

          {/* SUB-TAB 1: MEMBERS LIST */}
          {activeSubTab === "members" && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
              {/* Controls: Search & Bulk Add */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="নাম, ফোন বা ইমেইল দিয়ে খুঁজুন..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <button
                  onClick={() => setShowBulkAdd(!showBulkAdd)}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> {showBulkAdd ? "ফর্ম বন্ধ করুন" : "একসাথে মেম্বার যোগ (Bulk)"}
                </button>
              </div>

              {/* Bulk Add Form Drawer */}
              {showBulkAdd && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" /> একবারে একাধিক সদস্য যোগ করুন
                    </h4>
                    <span className="text-[11px] text-slate-500">কমা (,) বা নতুন লাইনে ফোন নম্বর/আইডি দিন</span>
                  </div>
                  <textarea
                    rows={4}
                    placeholder="017XXXXXXXX&#10;018XXXXXXXX&#10;019XXXXXXXX"
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  ></textarea>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowBulkAdd(false)}
                      className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100"
                    >
                      বাতিল
                    </button>
                    <button
                      onClick={handleBulkAdd}
                      disabled={bulkAdding || !bulkInput.trim()}
                      className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {bulkAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} যোগ করুন
                    </button>
                  </div>
                </div>
              )}

              {/* Member Table */}
              {loadingDetails ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs font-bold">সদস্য তালিকা লোড হচ্ছে...</span>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                  <UserX className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">কোনো সদস্য পাওয়া যায়নি</p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    ইনভাইট লিংক হোয়াটসঅ্যাপ গ্রুপে শেয়ার করুন অথবা উপরের &ldquo;বাল্ক মেম্বার যোগ&rdquo; দিয়ে নম্বর পেস্ট করুন।
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">শিক্ষার্থীর নাম ও আইডি</th>
                        <th className="py-3 px-4">ইমেইল</th>
                        <th className="py-3 px-4 text-center">মোট পরীক্ষা দিয়েছে</th>
                        <th className="py-3 px-4">যুক্ত হওয়ার তারিখ</th>
                        <th className="py-3 px-4 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredMembers.map((m, idx) => (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 text-slate-400 font-medium">
                            {toBengaliDigits(idx + 1)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">{m.studentName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">{m.studentId}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                            {m.studentEmail || "—"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {toBengaliDigits(m.totalExamsCount || 0)} টি পরীক্ষা
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("bn-BD") : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRemoveMember(m.studentId, m.studentName || m.studentId)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="গ্রুপ থেকে রিমুভ করুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB 2: EXAM ATTENDANCE & WHATSAPP REMINDER */}
          {activeSubTab === "attendance" && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
              {/* Exam Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">পরীক্ষা নির্বাচন করুন:</h4>
                    <p className="text-[11px] text-slate-500">কোন পরীক্ষার উপস্থিতি দেখতে চান তা বাছুন</p>
                  </div>
                </div>

                <div className="w-full sm:w-80">
                  <select
                    value={selectedExamKey}
                    onChange={(e) => {
                      setSelectedExamKey(e.target.value);
                      if (selectedGroup) loadExamAttendance(selectedGroup.id, e.target.value);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {groupExams.length === 0 ? (
                      <option value="">কোনো পরীক্ষা পাওয়া যায়নি</option>
                    ) : (
                      groupExams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {loadingAttendance ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs font-bold">উপস্থিতির তথ্য লোড হচ্ছে...</span>
                </div>
              ) : !attendanceData ? (
                <div className="text-center py-10 text-slate-400 text-xs font-bold">
                  কোনো পরীক্ষা নির্বাচিত নেই।
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Attendance Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
                      <p className="text-[11px] font-bold text-slate-500">মোট গ্রুপ সদস্য</p>
                      <p className="text-xl font-black text-slate-800 mt-1">
                        {toBengaliDigits(attendanceData.totalMembers)} জন
                      </p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
                      <p className="text-[11px] font-bold text-emerald-700">উপস্থিত (দিয়েছে)</p>
                      <p className="text-xl font-black text-emerald-800 mt-1">
                        {toBengaliDigits(attendanceData.attendedCount)} জন ({toBengaliDigits(attendanceData.attendanceRate)}%)
                      </p>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-center">
                      <p className="text-[11px] font-bold text-rose-700">অনুপস্থিত (দেয়নি)</p>
                      <p className="text-xl font-black text-rose-800 mt-1">
                        {toBengaliDigits(attendanceData.missedCount)} জন
                      </p>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center">
                      <p className="text-[11px] font-bold text-indigo-700">গ্রুপের গড় নম্বর</p>
                      <p className="text-xl font-black text-indigo-800 mt-1">
                        {toBengaliDigits(attendanceData.averageScore)}
                      </p>
                    </div>
                  </div>

                  {/* Absentee Reminder Box */}
                  <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-rose-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          অনুপস্থিত শিক্ষার্থীদের তালিকা ({toBengaliDigits(attendanceData.missedCount)} জন)
                        </h4>
                        <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                          এই সদস্যরা এখনো পরীক্ষাটি দেয়নি। হোয়াটসঅ্যাপ গ্রুপে এক ক্লিকে সতর্কবার্তা পাঠান:
                        </p>
                      </div>

                      <button
                        onClick={copyWhatsAppReminder}
                        disabled={attendanceData.missedCount === 0}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                      >
                        {copiedReminder ? (
                          <>
                            <Check className="w-4 h-4" /> মেসেজ কপি হয়েছে ✓
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" /> WhatsApp Reminder কপি করুন
                          </>
                        )}
                      </button>
                    </div>

                    {attendanceData.missedMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {attendanceData.missedMembers.map((m) => (
                          <span
                            key={m.studentId}
                            className="bg-white border border-rose-200 text-rose-800 text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1.5"
                          >
                            <span>{m.studentName}</span>
                            <span className="text-slate-400 font-mono text-[10px]">({m.studentId})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-bold text-emerald-700 bg-white p-3 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> চমৎকার! গ্রুপের সবাই এই পরীক্ষায় অংশগ্রহণ করেছে।
                      </p>
                    )}
                  </div>

                  {/* Attended Students Table */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" /> অংশগ্রহণকারী শিক্ষার্থীদের ফলাফল ({toBengaliDigits(attendanceData.attendedCount)} জন)
                    </h4>

                    {attendanceData.attendedMembers.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-slate-200">
                        এখনো এই গ্রুপের কোনো শিক্ষার্থী পরীক্ষাটি জমা দেয়নি।
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <th className="py-2.5 px-4">র‌্যাংক</th>
                              <th className="py-2.5 px-4">শিক্ষার্থী</th>
                              <th className="py-2.5 px-4 text-center">স্কোর</th>
                              <th className="py-2.5 px-4 text-right">জমা দেওয়ার সময়</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {attendanceData.attendedMembers.map((m, idx) => (
                              <tr key={m.studentId} className="hover:bg-slate-50/70">
                                <td className="py-2.5 px-4 font-bold text-slate-500">
                                  #{toBengaliDigits(idx + 1)}
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="font-bold text-slate-800">{m.studentName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{m.studentId}</div>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                    {toBengaliDigits(m.score)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">
                                  {m.submittedAt ? new Date(m.submittedAt).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: ALL GROUPS OVERVIEW & CREATION */
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">স্টাডি গ্রুপ মনিটর</h3>
                <p className="text-xs text-slate-500 font-medium">
                  কোর্স অনুযায়ী একাধিক হোয়াটসঅ্যাপ গ্রুপের শিক্ষার্থীদের আলাদাভাবে ট্র্যাকিং ও মনিটরিং
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Course Filter Dropdown */}
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">সকল কোর্স ({toBengaliDigits(groups.length)} টি গ্রুপ)</option>
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Create Group Button */}
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> নতুন স্টাডি গ্রুপ
              </button>
            </div>
          </div>

          {/* Create Group Modal */}
          {isCreating && (
            <div className="bg-white rounded-3xl border-2 border-indigo-200 p-5 sm:p-6 shadow-md space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> নতুন স্টাডি গ্রুপ তৈরি করুন
                </h4>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  বাতিল
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      কোর্স নির্বাচন করুন:
                    </label>
                    <select
                      value={newCourse}
                      onChange={(e) => setNewCourse(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {courses.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      গ্রুপের নাম:
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: প্রশ্ন ব্যাংক এনালাইসিস - গ্রুপ ১"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    বিবরণ বা নোট (ঐচ্ছিক):
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: সকালের ব্যাচ বা WhatsApp গ্রুপ ১"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !newName.trim()}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} গ্রুপ তৈরি করুন
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Groups Grid */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs font-bold">গ্রুপ তালিকা লোড হচ্ছে...</span>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 space-y-3 p-6">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">কোনো স্টাডি গ্রুপ তৈরি করা হয়নি</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                উপরে &ldquo;+ নতুন স্টাডি গ্রুপ&rdquo; বাটনে ক্লিক করে এক বা একাধিক স্টাডি গ্রুপ তৈরি করুন এবং লিংক হোয়াটসঅ্যাপে শেয়ার করুন।
              </p>
              <button
                onClick={() => setIsCreating(true)}
                className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
              >
                + প্রথম গ্রুপ তৈরি করুন
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => {
                const isCopied = copiedCode === group.inviteCode;
                return (
                  <div
                    key={group.id}
                    className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 truncate">
                          {group.course}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full shrink-0">
                          {toBengaliDigits(group.memberCount || 0)} জন সদস্য
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-base leading-snug">{group.name}</h4>
                      {group.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{group.description}</p>
                      )}
                    </div>

                    {/* Invite Link & Action Buttons */}
                    <div className="space-y-2.5 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-[11px]">
                        <span className="text-slate-400 truncate flex-1 pl-1">
                          join-group/{group.inviteCode}
                        </span>
                        <button
                          onClick={() => copyInviteLink(group.inviteCode)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg font-bold text-[10px] transition shrink-0 flex items-center gap-1 cursor-pointer"
                          title="ইনভাইট লিংক কপি করুন"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" /> কপি হয়েছে
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> কপি
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenGroup(group)}
                          className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <BarChart2 className="w-3.5 h-3.5" /> মনিটরিং ও মেম্বার
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="গ্রুপ মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
