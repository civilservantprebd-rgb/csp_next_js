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
  GraduationCap,
  RotateCw,
  Trophy,
  Calendar,
  TrendingUp,
  Download,
  Printer,
  ShieldCheck,
  Building2,
  Mail,
  Pencil,
  Phone,
  MessageCircle
} from "lucide-react";
import {
  getStudyGroups,
  createStudyGroup,
  updateStudyGroup,
  deleteStudyGroup,
  getGroupDetails,
  removeMemberFromGroup,
  getExamsForGroupCourse,
  getGroupExamAttendance,
  getGroupDailyLeaderboard,
  getGroupPeriodLeaderboard,
  getAllAmbassadorApplications,
  approveAmbassadorApplication,
  removeAmbassador
} from "@/actions/study-group-actions";
import { StudyGroup, StudyGroupMember, GroupExamAttendance, GroupDailyRanking, AmbassadorApplication } from "@/types/study-group";
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

  // Ambassador Applications State
  const [ambassadorApps, setAmbassadorApps] = useState<AmbassadorApplication[]>([]);
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [processingAppId, setProcessingAppId] = useState<string | null>(null);

  // Rename / Edit Group State
  const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [updatingGroup, setUpdatingGroup] = useState(false);

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


  // Exam Attendance State
  const [groupExams, setGroupExams] = useState<{ id: string; title: string; course: string }[]>([]);
  const [selectedExamKey, setSelectedExamKey] = useState("");
  const [attendanceData, setAttendanceData] = useState<GroupExamAttendance | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [copiedReminder, setCopiedReminder] = useState(false);

  // Period Leaderboard & Main View State
  const [mainView, setMainView] = useState<"groups" | "leaderboard" | "ambassadors">("groups");
  const getTodayBD = () => {
    const now = new Date();
    const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    return bdTime.toISOString().slice(0, 10);
  };
  const [startDate, setStartDate] = useState<string>(getTodayBD);
  const [endDate, setEndDate] = useState<string>(getTodayBD);
  const [periodPreset, setPeriodPreset] = useState<"today" | "yesterday" | "3days" | "7days" | "month" | "custom">("today");
  const [selectedLiveExam, setSelectedLiveExam] = useState<string>("all");
  const [availableLiveExams, setAvailableLiveExams] = useState<{ id: string; title: string; course: string }[]>([]);
  const [rankings, setRankings] = useState<GroupDailyRanking[]>([]);
  const [loadingRankings, setLoadingRankings] = useState(false);

  // Fetch groups
  const loadGroups = async () => {
    setLoading(true);
    const data = await getStudyGroups(courseFilter);
    setGroups(data);
    setLoading(false);
  };

  // Fetch ambassador applications
  const loadAmbassadorApps = async () => {
    setLoadingAmbassadors(true);
    const apps = await getAllAmbassadorApplications();
    setAmbassadorApps(apps);
    setLoadingAmbassadors(false);
  };

  const handleApproveAmbassador = async (app: AmbassadorApplication) => {
    setProcessingAppId(app.id);
    setErrorMsg("");
    const res = await approveAmbassadorApplication(app.id);
    setProcessingAppId(null);

    if (res.success) {
      setNotice(res.message);
      await loadAmbassadorApps();
      await loadGroups();
      if (selectedGroup && selectedGroup.id === app.groupId) {
        const details = await getGroupDetails(selectedGroup.id);
        setGroupMembers(details.members);
      }
      setTimeout(() => setNotice(""), 4000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleRemoveAmbassador = async (app: AmbassadorApplication) => {
    const confirmText =
      app.status === "approved"
        ? `আপনি কি নিশ্চিত যে "${app.studentName}"-কে "${app.groupName}" গ্রুপের এম্বাসেডর পদ থেকে রিমুভ করতে চান?`
        : `আপনি কি "${app.studentName}"-এর এম্বাসেডর আবেদনটি বাতিল করতে চান?`;
    if (!window.confirm(confirmText)) return;

    setProcessingAppId(app.id);
    setErrorMsg("");
    const res = await removeAmbassador(app.id);
    setProcessingAppId(null);

    if (res.success) {
      setNotice(res.message);
      await loadAmbassadorApps();
      setTimeout(() => setNotice(""), 4000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const loadRankings = async (s?: string, e?: string, examKey?: string) => {
    setLoadingRankings(true);
    const startQ = s || startDate;
    const endQ = e || endDate;
    const keyQ = examKey !== undefined ? examKey : selectedLiveExam;
    const res = await getGroupPeriodLeaderboard(startQ, endQ, courseFilter, keyQ);
    setRankings(res.rankings || []);
    setAvailableLiveExams(res.availableLiveExams || []);
    setLoadingRankings(false);
  };

  const handleApplyPreset = (preset: "today" | "yesterday" | "3days" | "7days" | "month") => {
    setPeriodPreset(preset);
    const now = new Date();
    const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const today = bd.toISOString().slice(0, 10);

    let s = today;
    let e = today;

    if (preset === "today") {
      s = today;
      e = today;
    } else if (preset === "yesterday") {
      const y = new Date(bd.getTime() - 86400000).toISOString().slice(0, 10);
      s = y;
      e = y;
    } else if (preset === "3days") {
      const d3 = new Date(bd.getTime() - 2 * 86400000).toISOString().slice(0, 10);
      s = d3;
      e = today;
    } else if (preset === "7days") {
      const d7 = new Date(bd.getTime() - 6 * 86400000).toISOString().slice(0, 10);
      s = d7;
      e = today;
    } else if (preset === "month") {
      const firstDay = `${today.slice(0, 7)}-01`;
      s = firstDay;
      e = today;
    }

    setStartDate(s);
    setEndDate(e);
    loadRankings(s, e, selectedLiveExam);
  };

  useEffect(() => {
    loadGroups();
    loadAmbassadorApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter]);

  useEffect(() => {
    if (mainView === "leaderboard") {
      loadRankings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, courseFilter, selectedLiveExam, mainView]);

  // Download / Print PDF report
  const handleDownloadPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Open details view for a group
  const handleOpenGroup = async (group: StudyGroup) => {
    setSelectedGroup(group);
    setLoadingDetails(true);
    setActiveSubTab("members");
    setMemberSearch("");

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

  const handleStartRename = (group: StudyGroup) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditDesc(group.description || "");
    setErrorMsg("");
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editName.trim()) {
      setErrorMsg("গ্রুপের নাম ফাঁকা রাখা যাবে না।");
      return;
    }

    setUpdatingGroup(true);
    setErrorMsg("");
    const res = await updateStudyGroup(editingGroup.id, editName.trim(), editDesc.trim());
    setUpdatingGroup(false);

    if (res.success && res.group) {
      const updated = res.group;
      setNotice(res.message);
      setGroups((prev) =>
        prev.map((g) => (g.id === updated.id ? { ...g, name: updated.name, description: updated.description } : g))
      );
      if (selectedGroup?.id === updated.id) {
        setSelectedGroup((prev) =>
          prev ? { ...prev, name: updated.name, description: updated.description } : null
        );
      }
      setEditingGroup(null);
      loadAmbassadorApps();
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
        msg += `${toBengaliDigits(idx + 1)}. ${m.studentName}\n`;
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
    return (m.studentName || "").toLowerCase().includes(q);
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
                  <div className="flex items-center gap-2 mt-1">
                    <h2 className="text-xl font-black text-slate-900">{selectedGroup.name}</h2>
                    <button
                      type="button"
                      onClick={() => handleStartRename(selectedGroup)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                      title="গ্রুপের নাম রিনেম করুন"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedGroup.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedGroup.description}</p>
                  )}
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

            {/* Group Ambassadors Section inside Selected Group */}
            {(() => {
              const groupApprovedAmbassadors = ambassadorApps.filter(
                (a) => a.groupId === selectedGroup.id && a.status === "approved"
              );
              const groupPendingAmbassadors = ambassadorApps.filter(
                (a) => a.groupId === selectedGroup.id && a.status === "pending"
              );
              return (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-800">
                        গ্রুপ এম্বাসেডর ({toBengaliDigits(groupApprovedAmbassadors.length)} জন)
                      </span>
                      {groupPendingAmbassadors.length > 0 && (
                        <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {toBengaliDigits(groupPendingAmbassadors.length)} টি পেন্ডিং রিকোয়েস্ট
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Approved Ambassadors for this group */}
                  {groupApprovedAmbassadors.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      এই গ্রুপে এখনো কোনো এম্বাসেডর নিযুক্ত নেই।
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {groupApprovedAmbassadors.map((amb) => (
                        <div
                          key={amb.id}
                          className="bg-white border border-indigo-200 rounded-xl px-3 py-2 flex items-center justify-between gap-3 shadow-2xs"
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900">{amb.studentName}</span>
                              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                এম্বাসেডর
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {amb.university} • সেশন: {amb.session} {amb.studentEmail ? `• ${amb.studentEmail}` : ""}
                            </p>
                            {amb.whatsapp && (
                              <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-700">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                <span>{amb.whatsapp}</span>
                                <a
                                  href={`https://wa.me/880${amb.whatsapp.replace(/^0/, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-emerald-700 hover:text-emerald-800 underline ml-1 font-medium"
                                >
                                  WhatsApp
                                </a>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={processingAppId === amb.id}
                            onClick={() => handleRemoveAmbassador(amb)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                            title="এম্বাসেডর পদ থেকে রিমুভ করুন"
                          >
                            {processingAppId === amb.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                            রিমুভ
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pending Ambassador Requests for this group */}
                  {groupPendingAmbassadors.length > 0 && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <p className="text-[11px] font-bold text-amber-800">
                        অপেক্ষমাণ এম্বাসেডর রিকোয়েস্ট:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {groupPendingAmbassadors.map((req) => (
                          <div
                            key={req.id}
                            className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-col justify-between gap-2.5"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-slate-900">{req.studentName}</span>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(req.appliedAt).toLocaleDateString("bn-BD")}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 font-medium">
                                🎓 {req.university} (সেশন: {req.session})
                              </p>
                              {req.studentEmail && (
                                <p className="text-[10px] text-slate-500">✉️ {req.studentEmail}</p>
                              )}
                              {req.whatsapp && (
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-200/60 w-fit">
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                  <span>{req.whatsapp}</span>
                                  <a
                                    href={`https://wa.me/880${req.whatsapp.replace(/^0/, "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-1.5 py-0.5 rounded transition"
                                  >
                                    WhatsApp
                                  </a>
                                </div>
                              )}
                              <p className="text-[11px] text-slate-700 bg-white/80 p-2 rounded-lg border border-amber-100 mt-1">
                                <span className="font-bold text-slate-500">কারণ: </span>
                                {req.reason}
                              </p>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                disabled={processingAppId === req.id}
                                onClick={() => handleRemoveAmbassador(req)}
                                className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              >
                                বাতিল
                              </button>
                              <button
                                type="button"
                                disabled={processingAppId === req.id}
                                onClick={() => handleApproveAmbassador(req)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                {processingAppId === req.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                অ্যাপ্রুভ করুন
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
                onClick={() => {
                  setActiveSubTab("attendance");
                  if (selectedGroup && selectedExamKey) {
                    loadExamAttendance(selectedGroup.id, selectedExamKey);
                  }
                }}
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
              {/* Controls: Search */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="শিক্ষার্থীর নাম দিয়ে খুঁজুন..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

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
                    শিক্ষার্থীদের যুক্ত করতে ইনভাইট লিংক হোয়াটসঅ্যাপ বা মেসেঞ্জারে শেয়ার করুন।
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">শিক্ষার্থীর নাম</th>
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

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedExamKey}
                    onChange={(e) => {
                      setSelectedExamKey(e.target.value);
                      if (selectedGroup) loadExamAttendance(selectedGroup.id, e.target.value);
                    }}
                    className="w-full sm:w-80 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
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

                  <button
                    onClick={() => {
                      if (selectedGroup && selectedExamKey) {
                        loadExamAttendance(selectedGroup.id, selectedExamKey);
                      }
                    }}
                    title="উপস্থিতির তথ্য রিফ্রেশ করুন"
                    className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition cursor-pointer shrink-0 shadow-xs"
                  >
                    <RotateCw className={`w-4 h-4 ${loadingAttendance ? "animate-spin text-indigo-600" : ""}`} />
                  </button>
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
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4 print:hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                  onClick={() => {
                    setMainView("groups");
                    setIsCreating(true);
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> নতুন স্টাডি গ্রুপ
                </button>
              </div>
            </div>

            {/* View Switcher: "গ্রুপ তালিকা" vs "🏆 দৈনিক গ্রুপ র‍্যাংকিং" vs "🎖️ এম্বাসেডর রিকোয়েস্ট ও তালিকা" */}
            <div className="flex flex-wrap border-b border-slate-200 gap-6 pt-1">
              <button
                type="button"
                onClick={() => setMainView("groups")}
                className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  mainView === "groups"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Layers className="w-4 h-4" /> গ্রুপ তালিকা ({toBengaliDigits(groups.length)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setMainView("leaderboard");
                  loadRankings();
                }}
                className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  mainView === "leaderboard"
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-500" /> লাইভ পরীক্ষা র‍্যাংকিং (শীর্ষ গ্রুপ)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMainView("ambassadors");
                  loadAmbassadorApps();
                }}
                className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition cursor-pointer ${
                  mainView === "ambassadors"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>এম্বাসেডর রিকোয়েস্ট ও তালিকা</span>
                {ambassadorApps.filter((a) => a.status === "pending").length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                    {toBengaliDigits(ambassadorApps.filter((a) => a.status === "pending").length)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Main View: Leaderboard vs Groups List */}
          {mainView === "leaderboard" ? (
            <div className="space-y-6">
              {/* Date Period Filter & Controls */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4 print:hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        লাইভ পরীক্ষা অংশগ্রহণের ভিত্তিতে গ্রুপ প্রতিযোগিতা ও র‍্যাংকিং
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        নির্দিষ্ট সময়সীমায় (Time Period) যে গ্রুপের সদস্যরা সবচেয়ে বেশি হারে লাইভ পরীক্ষায় অংশ নেবে, সেই গ্রুপ শীর্ষে (Top) থাকবে
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Quick Preset Buttons */}
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("today")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        periodPreset === "today"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      ⚡ আজ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("yesterday")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        periodPreset === "yesterday"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      📅 গতকাল
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("3days")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        periodPreset === "3days"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      🗓️ গত ৩ দিন
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("7days")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        periodPreset === "7days"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      📊 গত ৭ দিন
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("month")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        periodPreset === "month"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      📆 চলতি মাস
                    </button>
                  </div>
                </div>

                {/* Second Row: Custom Date Range Inputs + Live Exam Selector + PDF Download + Refresh */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-slate-400 font-bold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> সময়সীমা:
                    </span>

                    {/* Start Date */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                      <span className="text-[10px] font-bold text-slate-400">হতে:</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setPeriodPreset("custom");
                          setStartDate(e.target.value);
                          if (e.target.value) loadRankings(e.target.value, endDate);
                        }}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                      />
                    </div>

                    {/* End Date */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                      <span className="text-[10px] font-bold text-slate-400">পর্যন্ত:</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          setPeriodPreset("custom");
                          setEndDate(e.target.value);
                          if (e.target.value) loadRankings(startDate, e.target.value);
                        }}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                      />
                    </div>

                    {/* Live Exam Dropdown Filter */}
                    {availableLiveExams.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={selectedLiveExam}
                          onChange={(e) => {
                            setSelectedLiveExam(e.target.value);
                            loadRankings(startDate, endDate, e.target.value);
                          }}
                          className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-xs truncate"
                        >
                          <option value="all">
                            🎯 সকল লাইভ পরীক্ষা ({toBengaliDigits(availableLiveExams.length)} টি)
                          </option>
                          {availableLiveExams.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.title} {ex.course ? `(${ex.course})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {/* Period Summary Tag */}
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold rounded-lg text-[11px] border border-amber-200/60">
                      {startDate === endDate
                        ? `তারিখ: ${startDate}`
                        : `${startDate} হতে ${endDate}`}
                    </span>

                    {/* PDF Download Button */}
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={loadingRankings || rankings.length === 0}
                      title="র‍্যাংকিং রিপোর্ট পিডিএফ আকারে ডাউনলোড বা প্রিন্ট করুন"
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF ডাউনলোড</span>
                    </button>

                    {/* Refresh Button */}
                    <button
                      type="button"
                      onClick={() => loadRankings()}
                      title="রিফ্রেশ করুন"
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                    >
                      <RotateCw className={`w-4 h-4 ${loadingRankings ? "animate-spin text-amber-600" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Champion Top Card & Leaderboard Table */}
              {loadingRankings ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                  <span className="text-xs font-bold">গ্রুপ লাইভ র‍্যাংকিং হিসাব হচ্ছে...</span>
                </div>
              ) : rankings.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-6 space-y-2">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">কোনো গ্রুপ পাওয়া যায়নি</h4>
                  <p className="text-xs text-slate-400">প্রথমে কিছু স্টাডি গ্রুপ তৈরি করুন।</p>
                </div>
              ) : (
                <div id="printable-group-rankings" className="space-y-6">
                  {/* Print-Only Official Report Header */}
                  <div className="hidden print:block text-center border-b-2 border-slate-300 pb-5 mb-6 pt-2">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">আরোহণ</h1>
                    <p className="text-xs font-semibold text-slate-600 mt-1">
                      হেল্পলাইন / হোয়াটসঅ্যাপ: 01577301529 | www.aarohon.com
                    </p>
                    <div className="mt-3 inline-block bg-slate-100 px-4 py-1.5 rounded-xl border border-slate-300">
                      <h2 className="text-base font-black text-slate-800">
                        স্টাডি গ্রুপ লাইভ পরীক্ষা পারফরম্যান্স ও র‍্যাংকিং রিপোর্ট
                      </h2>
                    </div>
                    <div className="flex justify-center items-center gap-3 text-xs font-semibold text-slate-600 mt-2.5 flex-wrap">
                      <span><strong>সময়সীমা:</strong> {startDate === endDate ? startDate : `${startDate} হতে ${endDate}`}</span>
                      <span>•</span>
                      <span><strong>কোর্স:</strong> {courseFilter === "all" ? "সকল কোর্স" : courseFilter}</span>
                      {selectedLiveExam !== "all" && (
                        <>
                          <span>•</span>
                          <span><strong>পরীক্ষা:</strong> {availableLiveExams.find((e) => e.id === selectedLiveExam)?.title || selectedLiveExam}</span>
                        </>
                      )}
                      <span>•</span>
                      <span><strong>রিপোর্ট তৈরির তারিখ:</strong> {new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}</span>
                    </div>
                  </div>

                  {/* Top 1 Highlight Card */}
                  {rankings[0] && rankings[0].participationRate > 0 ? (
                    <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 text-white rounded-3xl p-6 sm:p-7 shadow-lg shadow-amber-200/50 space-y-4 print:bg-amber-50 print:text-slate-900 print:border print:border-amber-300 print:shadow-none">
                      <div className="absolute right-4 -bottom-6 opacity-15 pointer-events-none print:hidden">
                        <Trophy className="w-48 h-48 text-white" />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full border border-white/30 text-white print:text-slate-900 print:border-slate-300 print:bg-white">
                            👑 এই সময়সীমার শীর্ষ গ্রুপ (Rank #1 Champion)
                          </span>
                          <h3 className="text-2xl font-black print:text-slate-900">{rankings[0].groupName}</h3>
                          <p className="text-xs text-amber-100 font-semibold print:text-slate-600">{rankings[0].course}</p>
                        </div>

                        <div className="text-left sm:text-right bg-white/10 backdrop-blur-xs border border-white/20 p-4 rounded-2xl shrink-0 print:bg-white print:border-slate-300">
                          <span className="text-[11px] font-bold text-amber-100 block print:text-slate-600">
                            লাইভ পরীক্ষা অংশগ্রহণের হার
                          </span>
                          <span className="text-3xl font-black print:text-slate-900">{toBengaliDigits(rankings[0].participationRate)}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 relative z-10 text-center border-t border-white/20 print:border-slate-300">
                        <div className="bg-white/10 rounded-xl p-2.5 print:bg-white print:border print:border-slate-200">
                          <span className="text-[10px] text-amber-100 font-bold block print:text-slate-500">সক্রিয় পরীক্ষার্থী</span>
                          <span className="text-sm sm:text-base font-black print:text-slate-900">
                            {toBengaliDigits(rankings[0].activeCount)} / {toBengaliDigits(rankings[0].totalMembers)} জন
                          </span>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2.5 print:bg-white print:border print:border-slate-200">
                          <span className="text-[10px] text-amber-100 font-bold block print:text-slate-500">মোট লাইভ পরীক্ষা সম্পন্ন</span>
                          <span className="text-sm sm:text-base font-black print:text-slate-900">
                            {toBengaliDigits(rankings[0].submissionsCount)} টি
                          </span>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2.5 print:bg-white print:border print:border-slate-200">
                          <span className="text-[10px] text-amber-100 font-bold block print:text-slate-500">অনুষ্ঠিত লাইভ পরীক্ষা</span>
                          <span className="text-sm sm:text-base font-black print:text-slate-900">
                            {toBengaliDigits(rankings[0].liveExamsCount || 0)} টি
                          </span>
                        </div>
                        <div className="bg-white/10 rounded-xl p-2.5 print:bg-white print:border print:border-slate-200">
                          <span className="text-[10px] text-amber-100 font-bold block print:text-slate-500">গড় স্কোর</span>
                          <span className="text-sm sm:text-base font-black print:text-slate-900">
                            {toBengaliDigits(rankings[0].averageScore)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center text-slate-500 text-xs font-semibold">
                      📅 {startDate === endDate ? startDate : `${startDate} হতে ${endDate}`} সময়সীমায় কোনো গ্রুপের সদস্য এখনো কোনো লাইভ পরীক্ষা সম্পন্ন করেনি।
                    </div>
                  )}

                  {/* Leaderboard Table */}
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-5 sm:p-6 space-y-4 print:border-none print:shadow-none print:p-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        সকল গ্রুপের লাইভ অবস্থান ও পারফরম্যান্স (
                        {startDate === endDate ? startDate : `${startDate} হতে ${endDate}`}
                        )
                      </h4>
                      <div className="flex items-center gap-3 print:hidden">
                        <span className="text-[11px] text-slate-400 font-semibold hidden sm:inline">
                          লাইভ অংশগ্রহণের হারের ভিত্তিতে সাজানো
                        </span>
                        <button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={loadingRankings || rankings.length === 0}
                          title="পিডিএফ আকারে সংরক্ষণ বা প্রিন্ট করুন"
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF রিপোর্ট</span>
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-100 rounded-2xl print:border-slate-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold print:bg-slate-100 print:text-slate-800">
                            <th className="py-3 px-4 text-center">র‍্যাংক</th>
                            <th className="py-3 px-4">গ্রুপের নাম ও কোর্স</th>
                            <th className="py-3 px-4">লাইভ পরীক্ষার হার (%)</th>
                            <th className="py-3 px-4 text-center">সক্রিয় সদস্য</th>
                            <th className="py-3 px-4 text-center">লাইভ পরীক্ষা সম্পন্ন</th>
                            <th className="py-3 px-4 text-center">গড় স্কোর</th>
                            <th className="py-3 px-4 text-right print:hidden">অ্যাকশন</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                          {rankings.map((r) => {
                            const isTop = r.rank === 1 && r.participationRate > 0;
                            return (
                              <tr
                                key={r.groupId}
                                className={`hover:bg-slate-50/70 transition ${
                                  isTop ? "bg-amber-50/40 font-semibold print:bg-amber-50/30" : ""
                                }`}
                              >
                                <td className="py-3 px-4 text-center">
                                  {r.rank === 1 ? (
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black text-xs shadow-xs print:border print:border-amber-300">
                                      🥇
                                    </span>
                                  ) : r.rank === 2 ? (
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-black text-xs">
                                      🥈
                                    </span>
                                  ) : r.rank === 3 ? (
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-800 font-black text-xs">
                                      🥉
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-bold">
                                      #{toBengaliDigits(r.rank)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                    {r.groupName}
                                    {isTop && (
                                      <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded-sm print:border print:border-amber-600 print:text-amber-800 print:bg-amber-100">
                                        TOP
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 print:text-slate-600">{r.course}</div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden print:border print:border-slate-300">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          r.participationRate >= 70
                                            ? "bg-emerald-500"
                                            : r.participationRate >= 40
                                            ? "bg-amber-500"
                                            : "bg-indigo-500"
                                        }`}
                                        style={{ width: `${Math.min(100, r.participationRate)}%` }}
                                      ></div>
                                    </div>
                                    <span className="font-bold text-slate-700 text-xs">
                                      {toBengaliDigits(r.participationRate)}%
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-medium text-slate-700">
                                    {toBengaliDigits(r.activeCount)} / {toBengaliDigits(r.totalMembers)} জন
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-black bg-slate-100 text-slate-700 print:border print:border-slate-200">
                                    {toBengaliDigits(r.submissionsCount)} টি
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="font-bold text-slate-700">
                                    {toBengaliDigits(r.averageScore)}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right print:hidden">
                                  <button
                                    onClick={() => {
                                      const found = groups.find((g) => g.id === r.groupId);
                                      if (found) handleOpenGroup(found);
                                    }}
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition cursor-pointer"
                                  >
                                    মনিটর দেখুন
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Print-Only Official Report Footer */}
                  <div className="hidden print:flex justify-between items-center mt-8 pt-4 border-t border-slate-300 text-[11px] text-slate-500 font-medium">
                    <span>আরোহণ — স্টাডি গ্রুপ লিডারবোর্ড ও মনিটরিং সিস্টেম</span>
                    <span>www.aarohon.com</span>
                  </div>
                </div>
              )}
            </div>
          ) : mainView === "ambassadors" ? (
            /* VIEW: AMBASSADOR APPLICATIONS & APPROVED AMBASSADORS */
            <div className="space-y-6">
              {/* Top Info & Refresh Bar */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      স্টাডি গ্রুপ এম্বাসেডর রিকোয়েস্ট ও তালিকা
                    </h4>
                    <p className="text-xs text-slate-500">
                      অ্যাপ্রুভ করলে শিক্ষার্থী ঐ গ্রুপের এম্বাসেডর হবে এবং গ্রুপের উপস্থিতি ও র‍্যাংকিং মনিটর করতে পারবে (এক গ্রুপে একাধিক এম্বাসেডর থাকতে পারবে)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loadAmbassadorApps}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${loadingAmbassadors ? "animate-spin text-indigo-600" : ""}`} />
                  <span>রিফ্রেশ করুন</span>
                </button>
              </div>

              {loadingAmbassadors ? (
                <div className="py-16 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span className="text-xs font-bold">এম্বাসেডর তথ্য লোড হচ্ছে...</span>
                </div>
              ) : (
                <>
                  {/* SECTION 1: PENDING AMBASSADOR REQUESTS */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>
                          অপেক্ষমাণ এম্বাসেডর রিকোয়েস্ট ({toBengaliDigits(
                            ambassadorApps.filter(
                              (a) =>
                                a.status === "pending" &&
                                (courseFilter === "all" || a.course === courseFilter)
                            ).length
                          )} টি)
                        </span>
                      </h5>
                    </div>

                    {ambassadorApps.filter(
                      (a) =>
                        a.status === "pending" &&
                        (courseFilter === "all" || a.course === courseFilter)
                    ).length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
                        <CheckCircle2 className="w-7 h-7 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-600">কোনো নতুন এম্বাসেডর রিকোয়েস্ট পেন্ডিং নেই</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ambassadorApps
                          .filter(
                            (a) =>
                              a.status === "pending" &&
                              (courseFilter === "all" || a.course === courseFilter)
                          )
                          .map((req) => (
                            <div
                              key={req.id}
                              className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex flex-col justify-between gap-4 shadow-2xs"
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                                      {req.groupName} ({req.course})
                                    </span>
                                    <h6 className="text-sm font-black text-slate-900 mt-1.5">
                                      {req.studentName}
                                    </h6>
                                  </div>
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-300 shrink-0">
                                    পেন্ডিং
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 bg-white p-3 rounded-xl border border-amber-100">
                                  <div className="flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span className="truncate">
                                      <strong className="text-slate-500">বিশ্ববিদ্যালয়:</strong> {req.university}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    <span>
                                      <strong className="text-slate-500">সেশন:</strong> {req.session}
                                    </span>
                                  </div>
                                  {req.studentEmail && (
                                    <div className="flex items-center gap-1.5 sm:col-span-2 text-[11px] text-slate-500">
                                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate">{req.studentEmail}</span>
                                    </div>
                                  )}
                                  {req.whatsapp && (
                                    <div className="flex items-center justify-between gap-1.5 sm:col-span-2 bg-emerald-50/80 border border-emerald-200/80 p-2 rounded-lg text-emerald-900 font-bold">
                                      <div className="flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>WhatsApp: {req.whatsapp}</span>
                                      </div>
                                      <a
                                        href={`https://wa.me/880${req.whatsapp.replace(/^0/, "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition shadow-xs"
                                      >
                                        <MessageCircle className="w-3 h-3" /> মেসেজ দিন
                                      </a>
                                    </div>
                                  )}
                                </div>

                                <div className="bg-white p-3 rounded-xl border border-amber-100 text-xs">
                                  <p className="text-[10px] font-bold text-slate-400 mb-1">
                                    কেন এম্বাসেডর হতে চায়:
                                  </p>
                                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                                    {req.reason}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/60">
                                <span className="text-[10px] text-slate-500 font-medium">
                                  আবেদনের তারিখ: {new Date(req.appliedAt).toLocaleDateString("bn-BD")}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={processingAppId === req.id}
                                    onClick={() => handleRemoveAmbassador(req)}
                                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                                  >
                                    বাতিল করুন
                                  </button>
                                  <button
                                    type="button"
                                    disabled={processingAppId === req.id}
                                    onClick={() => handleApproveAmbassador(req)}
                                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                  >
                                    {processingAppId === req.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                    অ্যাপ্রুভ করুন
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: APPROVED AMBASSADORS LIST */}
                  <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-600" />
                        <span>
                          অনুমোদিত এম্বাসেডর তালিকা ({toBengaliDigits(
                            ambassadorApps.filter(
                              (a) =>
                                a.status === "approved" &&
                                (courseFilter === "all" || a.course === courseFilter)
                            ).length
                          )} জন)
                        </span>
                      </h5>
                    </div>

                    {ambassadorApps.filter(
                      (a) =>
                        a.status === "approved" &&
                        (courseFilter === "all" || a.course === courseFilter)
                    ).length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
                        <ShieldCheck className="w-7 h-7 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-600">এখনো কোনো এম্বাসেডর অনুমোদিত হয়নি</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <th className="py-3 px-4">#</th>
                              <th className="py-3 px-4">এম্বাসেডরের নাম ও ইমেইল</th>
                              <th className="py-3 px-4">বিশ্ববিদ্যালয় ও সেশন</th>
                              <th className="py-3 px-4">স্টাডি গ্রুপ ও কোর্স</th>
                              <th className="py-3 px-4">অ্যাপ্রুভ হওয়ার তারিখ</th>
                              <th className="py-3 px-4 text-right">অ্যাকশন</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ambassadorApps
                              .filter(
                                (a) =>
                                  a.status === "approved" &&
                                  (courseFilter === "all" || a.course === courseFilter)
                              )
                              .map((amb, idx) => (
                                <tr key={amb.id} className="hover:bg-slate-50/70 transition">
                                  <td className="py-3 px-4 font-bold text-slate-400">
                                    {toBengaliDigits(idx + 1)}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-900">{amb.studentName}</div>
                                    {amb.studentEmail && (
                                      <div className="text-[11px] text-slate-500">{amb.studentEmail}</div>
                                    )}
                                    {amb.whatsapp && (
                                      <div className="flex items-center gap-1.5 mt-1">
                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                          <Phone className="w-3 h-3 text-emerald-600" />
                                          {amb.whatsapp}
                                        </span>
                                        <a
                                          href={`https://wa.me/880${amb.whatsapp.replace(/^0/, "")}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[10px] text-emerald-700 hover:text-emerald-800 underline font-medium"
                                        >
                                          WhatsApp
                                        </a>
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-800">{amb.university}</div>
                                    <div className="text-[11px] text-slate-500">সেশন: {amb.session}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-indigo-700">{amb.groupName}</div>
                                    <div className="text-[10px] text-slate-500">{amb.course}</div>
                                  </td>
                                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                                    {amb.approvedAt
                                      ? new Date(amb.approvedAt).toLocaleDateString("bn-BD")
                                      : new Date(amb.appliedAt).toLocaleDateString("bn-BD")}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      type="button"
                                      disabled={processingAppId === amb.id}
                                      onClick={() => handleRemoveAmbassador(amb)}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                                      title="এম্বাসেডর থেকে রিমুভ করুন"
                                    >
                                      {processingAppId === amb.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                      রিমুভ করুন
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
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
                const groupAmbassadors = ambassadorApps.filter(
                  (a) => a.groupId === group.id && a.status === "approved"
                );
                const groupPendingReqs = ambassadorApps.filter(
                  (a) => a.groupId === group.id && a.status === "pending"
                );
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

                      {/* Ambassador Status Badges on Group Card */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          এম্বাসেডর: {toBengaliDigits(groupAmbassadors.length)} জন
                        </span>
                        {groupPendingReqs.length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                            ⏳ {toBengaliDigits(groupPendingReqs.length)} টি রিকোয়েস্ট
                          </span>
                        )}
                      </div>
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
                          type="button"
                          onClick={() => handleStartRename(group)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                          title="গ্রুপ রিনেম / এডিট করুন"
                        >
                          <Pencil className="w-4 h-4" />
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
        </>
      )}
    </div>
  )}

  {/* Rename Group Modal */}
  {editingGroup && (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl max-w-md w-full space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Pencil className="w-4 h-4 text-indigo-600" /> স্টাডি গ্রুপ রিনেম করুন
          </h4>
          <button
            type="button"
            onClick={() => setEditingGroup(null)}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            বাতিল
          </button>
        </div>

        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 space-y-1">
          <p className="font-bold">🔒 নিরাপদ রিনেম গ্যারান্টি:</p>
          <p className="text-emerald-700 leading-relaxed">
            নাম পরিবর্তন করলেও গ্রুপের লিংক (ইনভাইট কোড), আগের মেম্বার, এবং অতীতের পরীক্ষার সকল রেজাল্ট অপরিবর্তিত ও সক্রিয় থাকবে।
          </p>
        </div>

        <form onSubmit={handleSaveRename} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              কোর্স (অপরিবর্তনীয়):
            </label>
            <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
              {editingGroup.course}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              গ্রুপের নতুন নাম <span className="text-rose-500">*</span>:
            </label>
            <input
              type="text"
              required
              placeholder="গ্রুপের নতুন নাম লিখুন..."
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              বিবরণ বা নোট (ঐচ্ছিক):
            </label>
            <input
              type="text"
              placeholder="যেমন: সকালের ব্যাচ বা WhatsApp গ্রুপ ১"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingGroup(null)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={updatingGroup || !editName.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              {updatingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} রিনেম সংরক্ষণ করুন
            </button>
          </div>
        </form>
      </div>
    </div>
  )}
</div>
  );
};
