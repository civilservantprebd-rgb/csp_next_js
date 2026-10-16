"use client";

import React, { useState, useEffect } from "react";
import {
  Award,
  Users,
  CheckCircle2,
  Clock,
  Search,
  Copy,
  Check,
  FileText,
  BarChart2,
  Trophy,
  Calendar,
  Download,
  RotateCw,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  GraduationCap,
  Building2,
  BookOpen,
  LogIn,
  Loader2,
  UserX,
  Send
} from "lucide-react";
import {
  getPublicStudyGroupsForAmbassador,
  getMyAmbassadorStatus,
  applyForAmbassador,
  getAmbassadorDashboardData,
  getAmbassadorExamAttendance,
  getAmbassadorPeriodActivity,
  getAmbassadorGroupLeaderboard
} from "@/actions/study-group-actions";
import {
  StudyGroup,
  StudyGroupMember,
  GroupExamAttendance,
  GroupDailyRanking,
  AmbassadorApplication,
  GroupPeriodMemberActivity
} from "@/types/study-group";
import { getLocalStudentUser, loginWithGoogle, StudentUser } from "@/lib/student-auth";
import { toBengaliDigits } from "@/lib/utils";

export function AmbassadorView() {
  const [studentUser, setStudentUser] = useState<StudentUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [myApplication, setMyApplication] = useState<AmbassadorApplication | null>(null);
  const [availableGroups, setAvailableGroups] = useState<StudyGroup[]>([]);

  // Application Form State
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [session, setSession] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");

  // Approved Ambassador Dashboard State
  const [activeTab, setActiveTab] = useState<"members" | "attendance" | "period_activity" | "rankings">("members");
  const [groupData, setGroupData] = useState<StudyGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<StudyGroupMember[]>([]);
  const [coAmbassadors, setCoAmbassadors] = useState<AmbassadorApplication[]>([]);
  const [groupExams, setGroupExams] = useState<{ id: string; title: string; course: string }[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  // Tab 2: Exam Attendance State
  const [selectedExamKey, setSelectedExamKey] = useState("");
  const [attendanceData, setAttendanceData] = useState<GroupExamAttendance | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [copiedReminder, setCopiedReminder] = useState(false);

  // Tab 3 & 4: Date Period State
  const getTodayBD = () => {
    const now = new Date();
    const bdTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    return bdTime.toISOString().slice(0, 10);
  };
  const [startDate, setStartDate] = useState<string>(getTodayBD);
  const [endDate, setEndDate] = useState<string>(getTodayBD);
  const [periodPreset, setPeriodPreset] = useState<"today" | "yesterday" | "3days" | "7days" | "month" | "custom">("today");

  // Tab 3: Period Activity State
  const [activePeriodMembers, setActivePeriodMembers] = useState<GroupPeriodMemberActivity[]>([]);
  const [inactivePeriodMembers, setInactivePeriodMembers] = useState<{ studentId: string; studentName: string }[]>([]);
  const [loadingPeriodActivity, setLoadingPeriodActivity] = useState(false);

  // Tab 4: Group Rankings State
  const [rankings, setRankings] = useState<GroupDailyRanking[]>([]);
  const [availableLiveExams, setAvailableLiveExams] = useState<{ id: string; title: string; course: string }[]>([]);
  const [selectedLiveExam, setSelectedLiveExam] = useState<string>("all");
  const [rankingCourseFilter, setRankingCourseFilter] = useState<string>("all");
  const [loadingRankings, setLoadingRankings] = useState(false);

  useEffect(() => {
    const u = getLocalStudentUser();
    setStudentUser(u);
    if (u?.name) setFullName(u.name);
    setAuthChecked(true);
  }, []);

  const loadInitialStatus = async (user: StudentUser | null) => {
    setLoadingStatus(true);
    try {
      const [groupsList, statusRes] = await Promise.all([
        getPublicStudyGroupsForAmbassador(),
        user ? getMyAmbassadorStatus(user.uid, user.email) : Promise.resolve({ application: null })
      ]);
      setAvailableGroups(groupsList);
      if (groupsList.length > 0 && !selectedGroupId) {
        setSelectedGroupId(groupsList[0].id);
      }
      setMyApplication(statusRes.application);

      if (statusRes.application?.status === "approved" && user) {
        await loadApprovedDashboard(statusRes.application.groupId, user);
      }
    } catch (err) {
      console.error("Failed to load ambassador status:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (!authChecked) return;
    loadInitialStatus(studentUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, studentUser?.uid]);

  const loadApprovedDashboard = async (groupId: string, user: StudentUser) => {
    setLoadingDashboard(true);
    try {
      const res = await getAmbassadorDashboardData(groupId, user.uid, user.email);
      if (res.allowed && res.group) {
        setGroupData(res.group);
        setGroupMembers(res.members);
        setCoAmbassadors(res.ambassadors);
        setGroupExams(res.exams);
        if (res.exams.length > 0) {
          setSelectedExamKey(res.exams[0].id);
          loadExamAttendance(groupId, res.exams[0].id, user);
        }
      }
    } finally {
      setLoadingDashboard(false);
    }
  };

  const loadExamAttendance = async (groupId: string, examKey: string, user?: StudentUser | null) => {
    const activeUser = user || studentUser;
    if (!activeUser || !examKey) return;
    setLoadingAttendance(true);
    const data = await getAmbassadorExamAttendance(groupId, examKey, activeUser.uid, activeUser.email);
    setAttendanceData(data);
    setLoadingAttendance(false);
  };

  const loadPeriodActivity = async (s?: string, e?: string) => {
    if (!studentUser || !myApplication) return;
    setLoadingPeriodActivity(true);
    const sDate = s || startDate;
    const eDate = e || endDate;
    const res = await getAmbassadorPeriodActivity(
      myApplication.groupId,
      sDate,
      eDate,
      studentUser.uid,
      studentUser.email
    );
    setActivePeriodMembers(res.activeMembers || []);
    setInactivePeriodMembers(res.inactiveMembers || []);
    setLoadingPeriodActivity(false);
  };

  const loadGroupRankings = async (s?: string, e?: string, cFilter?: string, examK?: string) => {
    if (!studentUser || !myApplication) return;
    setLoadingRankings(true);
    const sDate = s || startDate;
    const eDate = e || endDate;
    const cF = cFilter !== undefined ? cFilter : rankingCourseFilter;
    const eK = examK !== undefined ? examK : selectedLiveExam;
    const res = await getAmbassadorGroupLeaderboard(
      myApplication.groupId,
      studentUser.uid,
      studentUser.email,
      sDate,
      eDate,
      cF,
      eK
    );
    setRankings(res.rankings || []);
    setAvailableLiveExams(res.availableLiveExams || []);
    setLoadingRankings(false);
  };

  useEffect(() => {
    if (myApplication?.status !== "approved" || !studentUser) return;
    if (activeTab === "period_activity") {
      loadPeriodActivity();
    } else if (activeTab === "rankings") {
      loadGroupRankings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, startDate, endDate, rankingCourseFilter, selectedLiveExam]);

  const handleApplyPreset = (preset: "today" | "yesterday" | "3days" | "7days" | "month") => {
    setPeriodPreset(preset);
    const now = new Date();
    const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const today = bd.toISOString().slice(0, 10);

    let s = today;
    let e = today;

    if (preset === "yesterday") {
      const y = new Date(bd.getTime() - 86400000).toISOString().slice(0, 10);
      s = y;
      e = y;
    } else if (preset === "3days") {
      s = new Date(bd.getTime() - 2 * 86400000).toISOString().slice(0, 10);
      e = today;
    } else if (preset === "7days") {
      s = new Date(bd.getTime() - 6 * 86400000).toISOString().slice(0, 10);
      e = today;
    } else if (preset === "month") {
      s = `${today.slice(0, 7)}-01`;
      e = today;
    }

    setStartDate(s);
    setEndDate(e);
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentUser) return;
    setFormError("");
    setFormNotice("");

    if (!fullName.trim()) {
      setFormError("আপনার পূর্ণ নাম লিখুন।");
      return;
    }
    if (!university.trim()) {
      setFormError("আপনার বিশ্ববিদ্যালয় বা প্রতিষ্ঠানের নাম লিখুন।");
      return;
    }
    if (!session.trim()) {
      setFormError("আপনার সেশন বা বর্ষ উল্লেখ করুন।");
      return;
    }
    if (!selectedGroupId) {
      setFormError("ড্রপডাউন থেকে একটি স্টাডি গ্রুপ নির্বাচন করুন।");
      return;
    }
    if (!reason.trim()) {
      setFormError("কেন আপনি এই গ্রুপের অ্যাম্বাসেডর হতে চান তা সংক্ষেপে লিখুন।");
      return;
    }

    setSubmitting(true);
    const res = await applyForAmbassador({
      studentId: studentUser.uid,
      studentName: fullName.trim(),
      studentEmail: studentUser.email || "",
      photoURL: studentUser.photoURL,
      university: university.trim(),
      session: session.trim(),
      reason: reason.trim(),
      groupId: selectedGroupId
    });
    setSubmitting(false);

    if (res.success && res.application) {
      setFormNotice(res.message);
      setMyApplication(res.application);
    } else {
      setFormError(res.message);
    }
  };

  const copyInviteLink = () => {
    if (!groupData) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://aarohon.com";
    const link = `${origin}/join-group/${groupData.inviteCode}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const copyWhatsAppReminder = () => {
    if (!attendanceData || !groupData) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://aarohon.com";
    const examUrl = `${origin}/exam/${attendanceData.examKey}`;

    let msg = `📢 *অনুস্মারক: ${groupData.course} (${groupData.name})*\n`;
    msg += `📝 পরীক্ষা: *${attendanceData.examTitle || attendanceData.examKey}*\n\n`;

    if (attendanceData.missedMembers.length > 0) {
      msg += `⚠️ আমাদের গ্রুপের নিচের সদস্যরা এখনো পরীক্ষাটি সম্পন্ন করোনি:\n`;
      attendanceData.missedMembers.forEach((m, idx) => {
        msg += `${toBengaliDigits(idx + 1)}. ${m.studentName}\n`;
      });
      msg += `\n⏰ দ্রুত লিংকে গিয়ে পরীক্ষাটি শেষ করার অনুরোধ করা হচ্ছে:\n🔗 ${examUrl}\n\n`;
      msg += `📊 গ্রুপের বর্তমান উপস্থিতি: ${toBengaliDigits(attendanceData.attendanceRate)}% (${toBengaliDigits(attendanceData.attendedCount)}/${toBengaliDigits(attendanceData.totalMembers)} জন)`;
    } else {
      msg += `🎉 চমৎকার! গ্রুপের সকল সদস্য পরীক্ষায় অংশগ্রহণ করেছে!`;
    }

    navigator.clipboard.writeText(msg);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 3000);
  };

  const handlePrintReport = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const filteredMembers = groupMembers.filter((m) => {
    const q = memberSearch.toLowerCase().trim();
    if (!q) return true;
    return (m.studentName || "").toLowerCase().includes(q);
  });

  if (!authChecked || loadingStatus) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-500 font-bengali">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
        <p className="text-xs font-bold">অ্যাম্বাসেডর প্যানেল লোড হচ্ছে...</p>
      </div>
    );
  }

  // ============================================================================
  // STATE 1: NOT LOGGED IN WITH GOOGLE
  // ============================================================================
  if (!studentUser) {
    return (
      <div className="space-y-6 font-bengali animate-in fade-in duration-200">
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-3xl p-6 sm:p-10 shadow-lg relative overflow-hidden">
          <div className="max-w-2xl space-y-4 relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
              <Award className="w-4 h-4" /> আরোহণ ক্যাম্পাস ও স্টাডি গ্রুপ অ্যাম্বাসেডর প্রোগ্রাম
            </span>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight">
              আপনার স্টাডি গ্রুপের নেতৃত্ব দিন এবং সহপাঠীদের প্রস্তুতিতে এগিয়ে রাখুন!
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed">
              অ্যাম্বাসেডর হিসেবে যুক্ত হয়ে আপনি আপনার স্টাডি গ্রুপের সদস্যদের নিয়মিত পরীক্ষার উপস্থিতি, নির্দিষ্ট সময়ের পারফরম্যান্স, এবং অন্য সকল গ্রুপের সাথে র‍্যাংকিং মনিটর করতে পারবেন ও অফিশিয়াল PDF রিপোর্ট ডাউনলোড করতে পারবেন।
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => loginWithGoogle(undefined, "/?nav=ambassador")}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Google দিয়ে সাইন ইন করে আবেদন করুন</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STATE 2: APPLICATION IS PENDING APPROVAL
  // ============================================================================
  if (myApplication && myApplication.status === "pending") {
    return (
      <div className="space-y-6 font-bengali animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm max-w-2xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  অ্যাডমিন অনুমোদনের অপেক্ষায় (Pending)
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                  আপনার অ্যাম্বাসেডর আবেদন জমা হয়েছে
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadInitialStatus(studentUser)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" /> স্ট্যাটাস রিফ্রেশ করুন
            </button>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3 text-xs sm:text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-semibold">নির্বাচিত স্টাডি গ্রুপ:</span>
              <span className="font-black text-indigo-700">
                {myApplication.groupName} ({myApplication.course})
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-semibold">আবেদনকারীর নাম:</span>
              <span className="font-bold text-slate-800">{myApplication.studentName}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-semibold">বিশ্ববিদ্যালয় / প্রতিষ্ঠান:</span>
              <span className="font-bold text-slate-800">{myApplication.university}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2.5">
              <span className="text-slate-500 font-semibold">সেশন / বর্ষ:</span>
              <span className="font-bold text-slate-800">{myApplication.session}</span>
            </div>
            <div className="space-y-1 pt-1">
              <span className="text-slate-500 font-semibold block">যুক্ত হওয়ার কারণ:</span>
              <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                {myApplication.reason}
              </p>
            </div>
          </div>

          <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-900">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-bold">পরবর্তী ধাপ কী?</p>
              <p className="text-indigo-800">
                আপনার আবেদনটি স্টাডি গ্রুপ মনিটরে পাঠানো হয়েছে। অ্যাডমিন আপনার আবেদন অ্যাপ্রুভ করলেই এই পেজে স্বয়ংক্রিয়ভাবে আপনার গ্রুপের **অ্যাম্বাসেডর ড্যাশবোর্ড** খুলে যাবে। উল্লেখ্য, একজন শিক্ষার্থী কেবল একটি গ্রুপেই আবেদন করতে পারেন।
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STATE 3: APPROVED AMBASSADOR DASHBOARD (GROUP ADMIN MONITOR)
  // ============================================================================
  if (myApplication && myApplication.status === "approved") {
    const myGroupRank = rankings.find((r) => r.groupId === myApplication.groupId);

    return (
      <div className="space-y-6 font-bengali animate-in fade-in duration-200">
        {/* Top Ambassador Header Banner (Hidden on Print) */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white rounded-3xl p-5 sm:p-6 shadow-md space-y-4 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black uppercase">
                  <Award className="w-3.5 h-3.5" /> অফিশিয়াল গ্রুপ অ্যাম্বাসেডর
                </span>
                <span className="text-xs font-bold text-indigo-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                  {groupData?.course || myApplication.course}
                </span>
                <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                  {toBengaliDigits(groupMembers.length)} জন সদস্য
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {groupData?.name || myApplication.groupName}
              </h2>
              <p className="text-xs text-indigo-200">
                অ্যাম্বাসেডর: <strong className="text-white">{myApplication.studentName}</strong> ({myApplication.university}, সেশন: {myApplication.session})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {groupData?.inviteCode && (
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" /> ইনভাইট লিংক কপি হয়েছে
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> গ্রুপ ইনভাইট লিংক
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handlePrintReport}
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF রিপোর্ট ডাউনলোড</span>
              </button>
            </div>
          </div>

          {/* Co-Ambassadors List (if multiple ambassadors in the same group) */}
          {coAmbassadors.length > 0 && (
            <div className="pt-3 border-t border-white/15 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-indigo-200 font-semibold">এই গ্রুপের দায়িত্বপ্রাপ্ত অ্যাম্বাসেডরবৃন্দ:</span>
              {coAmbassadors.map((amb) => (
                <span
                  key={amb.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white/10 text-white font-bold text-[11px] border border-white/15"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {amb.studentName} ({amb.university})
                </span>
              ))}
            </div>
          )}

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-1">
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === "members"
                  ? "bg-white text-indigo-950 shadow-sm"
                  : "bg-white/10 text-indigo-100 hover:bg-white/20"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>গ্রুপ সদস্য ({toBengaliDigits(groupMembers.length)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("attendance")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === "attendance"
                  ? "bg-white text-indigo-950 shadow-sm"
                  : "bg-white/10 text-indigo-100 hover:bg-white/20"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>পরীক্ষার উপস্থিতি</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("period_activity")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === "period_activity"
                  ? "bg-white text-indigo-950 shadow-sm"
                  : "bg-white/10 text-indigo-100 hover:bg-white/20"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>নির্দিষ্ট সময়ে অংশগ্রহণ</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("rankings")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === "rankings"
                  ? "bg-amber-400 text-slate-950 shadow-sm"
                  : "bg-white/10 text-indigo-100 hover:bg-white/20"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>অন্য গ্রুপের সাথে র‍্যাংকিং</span>
            </button>
          </div>
        </div>

        {/* Print-Only Official Report Header */}
        <div className="hidden print:block text-center border-b-2 border-slate-300 pb-4 mb-6 pt-2">
          <h1 className="text-2xl font-black text-slate-900">আরোহণ — স্টাডি গ্রুপ অ্যাম্বাসেডর রিপোর্ট</h1>
          <p className="text-xs font-bold text-slate-600 mt-1">
            গ্রুপ: {groupData?.name || myApplication.groupName} ({groupData?.course || myApplication.course}) | অ্যাম্বাসেডর: {myApplication.studentName} ({myApplication.university})
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            রিপোর্ট তৈরির তারিখ: {new Date().toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: GROUP MEMBERS LIST (READ-ONLY — NO ADD/REMOVE)             */}
        {/* ================================================================= */}
        {activeTab === "members" && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" /> গ্রুপের সদস্য তালিকা
                </h3>
                <p className="text-xs text-slate-500">
                  সদস্যরা কে কয়টি পরীক্ষায় অংশ নিয়েছে তার সার্বিক তালিকা (সদস্য সংযোজন বা বিয়োজন শুধুমাত্র অ্যাডমিন প্যানেল থেকে প্রযোজ্য)
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="সদস্যের নাম দিয়ে খুঁজুন..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {loadingDashboard ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs font-bold">সদস্য তালিকা লোড হচ্ছে...</span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                <UserX className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">কোনো সদস্য পাওয়া যায়নি</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">শিক্ষার্থীর নাম</th>
                      <th className="py-3 px-4 text-center">মোট পরীক্ষা দিয়েছে</th>
                      <th className="py-3 px-4 text-right">যুক্ত হওয়ার তারিখ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMembers.map((m, idx) => {
                      const isAmb = coAmbassadors.some(
                        (a) =>
                          a.studentId === m.studentId ||
                          (a.studentEmail && m.studentEmail && a.studentEmail.toLowerCase() === m.studentEmail.toLowerCase())
                      );
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 text-slate-400 font-medium">
                            {toBengaliDigits(idx + 1)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>{m.studentName}</span>
                              {isAmb && (
                                <span className="text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.2 rounded-full">
                                  অ্যাম্বাসেডর
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {toBengaliDigits(m.totalExamsCount || 0)} টি পরীক্ষা
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500 text-[11px]">
                            {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("bn-BD") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: SPECIFIC EXAM ATTENDANCE & MONITORING                      */}
        {/* ================================================================= */}
        {activeTab === "attendance" && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800">পরীক্ষা নির্বাচন করুন:</h4>
                  <p className="text-[11px] text-slate-500">কে কে পরীক্ষা দিচ্ছে ও কারা দেয়নি তা দেখুন</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedExamKey}
                  onChange={(e) => {
                    setSelectedExamKey(e.target.value);
                    loadExamAttendance(myApplication.groupId, e.target.value);
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
                  type="button"
                  onClick={() => {
                    if (selectedExamKey) loadExamAttendance(myApplication.groupId, selectedExamKey);
                  }}
                  className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition cursor-pointer shrink-0"
                  title="রিফ্রেশ করুন"
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
                    <p className="text-[11px] font-bold text-slate-500">মোট সদস্য</p>
                    <p className="text-xl font-black text-slate-800 mt-1">
                      {toBengaliDigits(attendanceData.totalMembers)} জন
                    </p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
                    <p className="text-[11px] font-bold text-emerald-700">অংশ নিয়েছে</p>
                    <p className="text-xl font-black text-emerald-800 mt-1">
                      {toBengaliDigits(attendanceData.attendedCount)} জন ({toBengaliDigits(attendanceData.attendanceRate)}%)
                    </p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-center">
                    <p className="text-[11px] font-bold text-rose-700">এখনো দেয়নি</p>
                    <p className="text-xl font-black text-rose-800 mt-1">
                      {toBengaliDigits(attendanceData.missedCount)} জন
                    </p>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-center">
                    <p className="text-[11px] font-bold text-indigo-700">গ্রুপের গড় স্কোর</p>
                    <p className="text-xl font-black text-indigo-800 mt-1">
                      {toBengaliDigits(attendanceData.averageScore)}
                    </p>
                  </div>
                </div>

                {/* Missed Students + WhatsApp Reminder */}
                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-rose-900 text-xs sm:text-sm flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        অনুপস্থিত সদস্যদের তালিকা ({toBengaliDigits(attendanceData.missedCount)} জন)
                      </h4>
                      <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                        যারা এখনো এই পরীক্ষাটি দেয়নি তাদের রিমাইন্ডার মেসেজ কপি করে গ্রুপে পাঠান:
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={copyWhatsAppReminder}
                      disabled={attendanceData.missedCount === 0}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0 print:hidden"
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
                    <div className="flex flex-wrap gap-2 pt-1">
                      {attendanceData.missedMembers.map((m) => (
                        <span
                          key={m.studentId}
                          className="bg-white border border-rose-200 text-rose-800 text-[11px] font-bold px-2.5 py-1 rounded-xl shadow-xs"
                        >
                          {m.studentName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-emerald-700 bg-white p-3 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> গ্রুপের সবাই এই পরীক্ষায় অংশগ্রহণ করেছে!
                    </p>
                  )}
                </div>

                {/* Attended Students Table */}
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" /> অংশগ্রহণকারী সদস্যদের ফলাফল ({toBengaliDigits(attendanceData.attendedCount)} জন)
                  </h4>

                  {attendanceData.attendedMembers.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-slate-200">
                      এখনো কোনো সদস্য এই পরীক্ষাটি সম্পন্ন করেনি।
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-2.5 px-4">র‍্যাংক</th>
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
                              <td className="py-2.5 px-4 font-bold text-slate-800">{m.studentName}</td>
                              <td className="py-2.5 px-4 text-center">
                                <span className="font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                                  {toBengaliDigits(m.score)}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right text-slate-500 text-[11px]">
                                {m.submittedAt
                                  ? new Date(m.submittedAt).toLocaleTimeString("bn-BD", {
                                      hour: "2-digit",
                                      minute: "2-digit"
                                    })
                                  : "—"}
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

        {/* ================================================================= */}
        {/* TAB 3: TIME-PERIOD ACTIVITY (নির্দিষ্ট সময়ে কে কে পরীক্ষা দিয়েছে) */}
        {/* ================================================================= */}
        {activeTab === "period_activity" && (
          <div className="space-y-6">
            {/* Period Filter Controls */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4 print:hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" /> নির্দিষ্ট সময়ে কে কে পরীক্ষা দিয়েছে
                  </h3>
                  <p className="text-xs text-slate-500">
                    যেকোনো তারিখ বা সময়সীমা বেছে নিয়ে দেখুন ঐ সময়ে আপনার গ্রুপের কোন কোন সদস্য পরীক্ষায় অংশ নিয়েছে
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: "today", label: "⚡ আজ" },
                      { id: "yesterday", label: "📅 গতকাল" },
                      { id: "3days", label: "🗓️ গত ৩ দিন" },
                      { id: "7days", label: "📊 গত ৭ দিন" },
                      { id: "month", label: "📆 চলতি মাস" }
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPreset(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        periodPreset === p.id
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                    <span className="text-[10px] font-bold text-slate-400">হতে:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setPeriodPreset("custom");
                        setStartDate(e.target.value);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                    <span className="text-[10px] font-bold text-slate-400">পর্যন্ত:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setPeriodPreset("custom");
                        setEndDate(e.target.value);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF ডাউনলোড
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPeriodActivity()}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                  >
                    <RotateCw className={`w-4 h-4 ${loadingPeriodActivity ? "animate-spin text-indigo-600" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {loadingPeriodActivity ? (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs font-bold">নির্দিষ্ট সময়ের অংশগ্রহণ হিসাব হচ্ছে...</span>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
                    <p className="text-[11px] font-bold text-slate-500">নির্বাচিত সময়সীমা</p>
                    <p className="text-sm sm:text-base font-black text-slate-800 mt-1">
                      {startDate === endDate ? startDate : `${startDate} হতে ${endDate}`}
                    </p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
                    <p className="text-[11px] font-bold text-emerald-700">এই সময়ে পরীক্ষা দিয়েছে</p>
                    <p className="text-xl font-black text-emerald-800 mt-1">
                      {toBengaliDigits(activePeriodMembers.length)} জন
                    </p>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl text-center">
                    <p className="text-[11px] font-bold text-rose-700">এই সময়ে কোনো পরীক্ষা দেয়নি</p>
                    <p className="text-xl font-black text-rose-800 mt-1">
                      {toBengaliDigits(inactivePeriodMembers.length)} জন
                    </p>
                  </div>
                </div>

                {/* Active Members in Period */}
                <div className="space-y-3">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    এই সময়সীমায় পরীক্ষায় অংশগ্রহণকারী সদস্যবৃন্দ ({toBengaliDigits(activePeriodMembers.length)} জন)
                  </h4>

                  {activePeriodMembers.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-bold text-slate-400">
                      এই সময়সীমায় গ্রুপের কোনো সদস্য পরীক্ষা দেয়নি।
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                            <th className="py-3 px-4">#</th>
                            <th className="py-3 px-4">সদস্যের নাম</th>
                            <th className="py-3 px-4 text-center">মোট পরীক্ষা</th>
                            <th className="py-3 px-4 text-center">লাইভ পরীক্ষা</th>
                            <th className="py-3 px-4 text-center">গড় স্কোর</th>
                            <th className="py-3 px-4">অংশ নেওয়া পরীক্ষাসমূহ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activePeriodMembers.map((m, idx) => (
                            <tr key={m.studentId} className="hover:bg-slate-50/70">
                              <td className="py-3 px-4 font-bold text-slate-400">
                                {toBengaliDigits(idx + 1)}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-800">{m.studentName}</td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-black">
                                  {toBengaliDigits(m.examsTakenCount)} টি
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-black">
                                  {toBengaliDigits(m.liveExamsTakenCount)} টি
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-black text-emerald-700">
                                {toBengaliDigits(m.averageScore)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {m.submissions.slice(0, 4).map((s, sIdx) => (
                                    <span
                                      key={`${s.examKey}_${sIdx}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-700 font-medium"
                                    >
                                      <span>{s.examTitle}</span>
                                      <strong className="text-indigo-700">({toBengaliDigits(s.score)})</strong>
                                    </span>
                                  ))}
                                  {m.submissions.length > 4 && (
                                    <span className="text-[10px] font-bold text-slate-400">
                                      +{toBengaliDigits(m.submissions.length - 4)}টি আরও
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Inactive Members in Period */}
                {inactivePeriodMembers.length > 0 && (
                  <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      এই সময়ে যারা কোনো পরীক্ষায় অংশ নেয়নি ({toBengaliDigits(inactivePeriodMembers.length)} জন):
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {inactivePeriodMembers.map((im) => (
                        <span
                          key={im.studentId}
                          className="px-2.5 py-1 rounded-xl bg-white border border-rose-200 text-rose-800 text-[11px] font-bold"
                        >
                          {im.studentName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: GROUP RANKINGS WITH OTHER GROUPS                           */}
        {/* ================================================================= */}
        {activeTab === "rankings" && (
          <div className="space-y-6">
            {/* Filter Controls */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4 print:hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" /> অন্য সকল গ্রুপের সাথে র‍্যাংকিং তুলনা
                  </h3>
                  <p className="text-xs text-slate-500">
                    নির্দিষ্ট সময়সীমায় লাইভ পরীক্ষায় অংশগ্রহণের হারের (%) ভিত্তিতে সকল স্টাডি গ্রুপের র‍্যাংকিং
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { id: "today", label: "⚡ আজ" },
                      { id: "yesterday", label: "📅 গতকাল" },
                      { id: "3days", label: "🗓️ গত ৩ দিন" },
                      { id: "7days", label: "📊 গত ৭ দিন" },
                      { id: "month", label: "📆 চলতি মাস" }
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPreset(p.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        periodPreset === p.id
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                    <span className="text-[10px] font-bold text-slate-400">হতে:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setPeriodPreset("custom");
                        setStartDate(e.target.value);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                    <span className="text-[10px] font-bold text-slate-400">পর্যন্ত:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setPeriodPreset("custom");
                        setEndDate(e.target.value);
                      }}
                      className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    />
                  </div>

                  {availableLiveExams.length > 0 && (
                    <select
                      value={selectedLiveExam}
                      onChange={(e) => setSelectedLiveExam(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-xs truncate"
                    >
                      <option value="all">
                        🎯 সকল লাইভ পরীক্ষা ({toBengaliDigits(availableLiveExams.length)} টি)
                      </option>
                      {availableLiveExams.map((ex) => (
                        <option key={ex.id} value={ex.id}>
                          {ex.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    disabled={loadingRankings || rankings.length === 0}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF ডাউনলোড
                  </button>
                  <button
                    type="button"
                    onClick={() => loadGroupRankings()}
                    className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                  >
                    <RotateCw className={`w-4 h-4 ${loadingRankings ? "animate-spin text-amber-600" : ""}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Our Group Position Highlight Card */}
            {myGroupRank && (
              <div className="bg-gradient-to-r from-indigo-50 via-white to-amber-50 border-2 border-indigo-300 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-600 text-white">
                    আপনার গ্রুপের বর্তমান অবস্থান
                  </span>
                  <h4 className="text-lg font-black text-slate-900">
                    র‍্যাংক #{toBengaliDigits(myGroupRank.rank)} — {myGroupRank.groupName}
                  </h4>
                  <p className="text-xs text-slate-500 font-semibold">
                    সক্রিয় সদস্য: {toBengaliDigits(myGroupRank.activeCount)}/{toBengaliDigits(myGroupRank.totalMembers)} জন • মোট লাইভ সাবমিশন: {toBengaliDigits(myGroupRank.submissionsCount)} টি • গড় স্কোর: {toBengaliDigits(myGroupRank.averageScore)}
                  </p>
                </div>
                <div className="text-left sm:text-right bg-indigo-600 text-white px-5 py-3 rounded-2xl shrink-0">
                  <span className="text-[10px] font-bold text-indigo-200 block">অংশগ্রহণের হার</span>
                  <span className="text-2xl font-black">{toBengaliDigits(myGroupRank.participationRate)}%</span>
                </div>
              </div>
            )}

            {/* Full Rankings Table */}
            {loadingRankings ? (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs font-bold">র‍্যাংকিং লোড হচ্ছে...</span>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  সকল গ্রুপের লিডারবোর্ড ({startDate === endDate ? startDate : `${startDate} হতে ${endDate}`})
                </h4>

                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-3 px-4 text-center">র‍্যাংক</th>
                        <th className="py-3 px-4">গ্রুপের নাম ও কোর্স</th>
                        <th className="py-3 px-4">লাইভ পরীক্ষার হার (%)</th>
                        <th className="py-3 px-4 text-center">সক্রিয় সদস্য</th>
                        <th className="py-3 px-4 text-center">লাইভ পরীক্ষা সম্পন্ন</th>
                        <th className="py-3 px-4 text-center">গড় স্কোর</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rankings.map((r) => {
                        const isMine = r.groupId === myApplication.groupId;
                        return (
                          <tr
                            key={r.groupId}
                            className={`transition ${
                              isMine
                                ? "bg-indigo-50/70 font-bold"
                                : "hover:bg-slate-50/70"
                            }`}
                          >
                            <td className="py-3 px-4 text-center">
                              {r.rank === 1 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-black text-xs">
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
                                <span className="text-slate-500 font-bold">
                                  #{toBengaliDigits(r.rank)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                <span>{r.groupName}</span>
                                {isMine && (
                                  <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.2 rounded-full">
                                    আপনার গ্রুপ
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{r.course}</div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      r.participationRate >= 70
                                        ? "bg-emerald-500"
                                        : r.participationRate >= 40
                                        ? "bg-amber-500"
                                        : "bg-indigo-500"
                                    }`}
                                    style={{ width: `${Math.min(100, r.participationRate)}%` }}
                                  />
                                </div>
                                <span className="font-bold text-slate-700">
                                  {toBengaliDigits(r.participationRate)}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-700">
                              {toBengaliDigits(r.activeCount)} / {toBengaliDigits(r.totalMembers)} জন
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-black text-[11px]">
                                {toBengaliDigits(r.submissionsCount)} টি
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-700">
                              {toBengaliDigits(r.averageScore)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // STATE 4: SIGNED IN WITH GOOGLE, NO APPLICATION YET -> APPLICATION FORM
  // ============================================================================
  return (
    <div className="space-y-6 font-bengali animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-3xl p-5 sm:p-7 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-black">স্টাডি গ্রুপ অ্যাম্বাসেডর আবেদন ফর্ম</h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              যেকোনো একটি স্টাডি গ্রুপের অ্যাম্বাসেডর হিসেবে যুক্ত হয়ে গ্রুপের মনিটরিং ও লিডারবোর্ড পরিচালনা করুন
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-8 shadow-sm max-w-2xl mx-auto space-y-6">
        {formError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-2xl flex items-center gap-2 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}
        {formNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-2xl flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{formNotice}</span>
          </div>
        )}

        {/* Signed-in Google User Info */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
              {studentUser.name?.charAt(0) || "G"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{studentUser.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{studentUser.email || "Google Account Verified"}</p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
            Google Signed In
          </span>
        </div>

        <form onSubmit={handleSubmitApplication} className="space-y-4">
          {/* 1. Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ১. আপনার পূর্ণ নাম <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="আপনার পূর্ণ নাম লিখুন"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>
          </div>

          {/* 2. University & 3. Session */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ২. বিশ্ববিদ্যালয় / শিক্ষা প্রতিষ্ঠান <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="যেমন: ঢাকা বিশ্ববিদ্যালয়"
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                ৩. সেশন / বর্ষ <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="যেমন: ২০১৯-২০"
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* 4. Study Group Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ৪. যে স্টাডি গ্রুপের অ্যাম্বাসেডর হতে চান তা নির্বাচন করুন <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                required
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition cursor-pointer"
              >
                {availableGroups.length === 0 ? (
                  <option value="">বর্তমানে কোনো স্টাডি গ্রুপ খোলা নেই</option>
                ) : (
                  availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} — ({g.course}) [{toBengaliDigits(g.memberCount || 0)} জন সদস্য]
                    </option>
                  ))
                )}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              বিঃদ্রঃ আপনি শুধুমাত্র একটি গ্রুপের অ্যাম্বাসেডর হিসেবে আবেদন করতে পারবেন। পরবর্তীতে অন্য গ্রুপে আবেদন করা যাবে না।
            </p>
          </div>

          {/* 5. Why do you want to join */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ৫. কেন আপনি অ্যাম্বাসেডর হিসেবে জয়েন করতে চান? <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="আপনার অভিজ্ঞতা বা কেন আপনি এই স্টাডি গ্রুপটি পরিচালনা করতে আগ্রহী তা সংক্ষেপে লিখুন..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || availableGroups.length === 0}
              className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> আবেদন জমা হচ্ছে...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> অ্যাম্বাসেডর হিসেবে আবেদন জমা দিন
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
