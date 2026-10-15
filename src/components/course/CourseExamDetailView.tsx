"use client";

import React, { useState, useEffect, useMemo } from "react";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { BookmarkButton } from "@/components/shared/BookmarkButton";
import { MathText } from "@/lib/MathText";
import {
  toBengaliDigits,
  formatBangladeshDate
} from "@/lib/utils";
import { getLocalStudentUser, loginWithGoogle } from "@/lib/student-auth";
import { getExamDetailedHubData, ExamDetailedHubBundle } from "@/actions/exam-actions";
import { Submission } from "@/types/submission";
import { Exam } from "@/types/exam";
import {
  Trophy,
  Award,
  BookOpen,
  Clock,
  CircleHelp,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowLeft,
  PlayCircle,
  Sparkles,
  Loader2,
  LogIn,
  BookOpenCheck,
  Zap,
  ListFilter,
  Check
} from "lucide-react";

const optLabels = ["ক", "খ", "গ", "ঘ"];

interface CourseExamDetailViewProps {
  examKey: string;
  courseName?: string;
  onBack: () => void;
  onStartExam: (examKey: string) => void;
}

export const CourseExamDetailView: React.FC<CourseExamDetailViewProps> = ({
  examKey,
  courseName,
  onBack,
  onStartExam,
}) => {
  const [hubData, setHubData] = useState<ExamDetailedHubBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"result" | "leaderboard">("result");
  const [filterMode, setFilterMode] = useState<"all" | "correct" | "incorrect" | "skipped">("all");
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number>(0);
  const [studentUser, setStudentUser] = useState<{ uid: string; name?: string; email?: string } | null>(null);

  // Sync client student identity & load hub data
  useEffect(() => {
    const u = getLocalStudentUser();
    if (u) setStudentUser(u);

    setLoading(true);
    getExamDetailedHubData(examKey, u?.uid)
      .then((res) => {
        if (res && res.exam) setHubData(res);
      })
      .catch((err) => console.error("Load exam detail data failed:", err))
      .finally(() => setLoading(false));
  }, [examKey]);

  const exam: Exam | null = hubData?.exam || null;
  const questions = hubData?.questions || [];
  const solutions = hubData?.solutions || [];
  const submissions = hubData?.submissions || [];
  const leaderboard = hubData?.leaderboard || [];

  // Categorize attempts
  const liveSubmission = useMemo(
    () => submissions.find((s) => s.isLiveSubmission === true),
    [submissions]
  );
  const practiceSubmissions = useMemo(
    () => submissions.filter((s) => !s.isLiveSubmission),
    [submissions]
  );

  // Currently inspected submission for detailed question review
  const activeSubmission: Submission | null = useMemo(() => {
    if (submissions.length === 0) return null;
    return submissions[selectedAttemptIndex] || submissions[0];
  }, [submissions, selectedAttemptIndex]);

  // Find student's own entry on the leaderboard
  const studentLeaderboardRank = useMemo(() => {
    if (!studentUser || leaderboard.length === 0) return null;
    const normUid = studentUser.uid.trim();
    const idx = leaderboard.findIndex(
      (item) => item.studentId && item.studentId.trim() === normUid
    );
    if (idx !== -1) {
      return { rank: idx + 1, item: leaderboard[idx] };
    }
    return null;
  }, [studentUser, leaderboard]);

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-xs font-bold text-slate-500">পরীক্ষার তথ্য ও ফলাফল লোড হচ্ছে...</span>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 shadow-xs space-y-3">
        <p className="text-sm font-bold text-slate-700">পরীক্ষার তথ্য পাওয়া যায়নি</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition"
        >
          পরীক্ষার তালিকায় ফিরে যান
        </button>
      </div>
    );
  }

  const qCount = questions.length || 0;
  const hasSubmissions = submissions.length > 0;
  const isCompleted = hasSubmissions;
  const answersReleased = !!solutions && solutions.length > 0;

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200 font-bengali">
      {/* Back Button */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-indigo-700 hover:text-indigo-900 transition py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 cursor-pointer active:scale-95 max-w-full"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="sm:hidden truncate">পরীক্ষাসমূহে ফিরে যান</span>
          <span className="hidden sm:inline truncate">{courseName ? `${courseName}-এর পরীক্ষাসমূহে ফিরে যান` : "পরীক্ষার তালিকায় ফিরে যান"}</span>
        </button>
      </div>

      {/* ===================== HERO EXAM SUMMARY CARD ===================== */}
      <section className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 border border-slate-200 shadow-xs space-y-3.5 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="space-y-1.5 sm:space-y-2 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {exam.course && (
                <span className="bg-indigo-50 text-indigo-700 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md border border-indigo-200/60">
                  {exam.course}
                </span>
              )}
              {exam.subject && (
                <span className="bg-slate-100 text-slate-700 text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                  {exam.subject}
                </span>
              )}
              {exam.isFree && (
                <span className="bg-emerald-50 text-emerald-700 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                  সম্পূর্ণ ফ্রি
                </span>
              )}
              {isCompleted && (
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> অংশগ্রহণ করা হয়েছে
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-2xl font-black text-slate-900 leading-snug break-words">
              {exam.title}
            </h2>

            {/* Meta stats pills */}
            <div className="grid grid-cols-2 min-[520px]:flex min-[520px]:flex-wrap items-center gap-1.5 sm:gap-2.5 text-[11px] sm:text-xs font-bold text-slate-600 pt-0.5 sm:pt-1">
              <span className="inline-flex items-center justify-center min-[520px]:justify-start gap-1 bg-slate-100 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border border-slate-200/80">
                <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{toBengaliDigits(exam.timerMinutes)} মিনিট</span>
              </span>
              <span className="inline-flex items-center justify-center min-[520px]:justify-start gap-1 bg-slate-100 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border border-slate-200/80">
                <CircleHelp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{toBengaliDigits(qCount)}টি প্রশ্ন</span>
              </span>
              <span className="inline-flex items-center justify-center min-[520px]:justify-start gap-1 bg-rose-50 text-rose-800 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border border-rose-200/60">
                <span>প্রতি ভুলে -০.৫</span>
              </span>
              {!!exam.passMark && (
                <span className="inline-flex items-center justify-center min-[520px]:justify-start gap-1 bg-amber-50 text-amber-800 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl border border-amber-200/60">
                  <span>পাস: {toBengaliDigits(exam.passMark)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Action CTA Button */}
          <div className="shrink-0 pt-1 sm:pt-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onStartExam(examKey)}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-bold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>{isCompleted ? "পুনরায় প্র্যাকটিস করুন" : "পরীক্ষা শুরু করুন"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ===================== TAB NAVIGATION BAR ===================== */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-1 sm:p-1.5 border border-slate-200 shadow-xs flex gap-1 sm:gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("result")}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap min-w-0 ${
            activeTab === "result"
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:inline">আমার ফলাফল ও উত্তরপত্র</span>
          <span className="sm:hidden truncate">ফলাফল ও সমাধান</span>
          {hasSubmissions && (
            <span
              className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-black leading-none shrink-0 ${
                activeTab === "result" ? "bg-white/20 text-white" : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {toBengaliDigits(submissions.length)}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap min-w-0 ${
            activeTab === "leaderboard"
              ? "bg-amber-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="hidden sm:inline">মেধা তালিকা ও লিডারবোর্ড</span>
          <span className="sm:hidden truncate">লিডারবোর্ড</span>
          {leaderboard.length > 0 && (
            <span
              className={`text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full font-black leading-none shrink-0 ${
                activeTab === "leaderboard" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
              }`}
            >
              {toBengaliDigits(leaderboard.length)}
            </span>
          )}
        </button>
      </div>

      {/* ===================== TAB 1: RESULT & QUESTION REVIEW ===================== */}
      {activeTab === "result" && (
        <div className="space-y-4 sm:space-y-5">
          {/* CASE 1: Student not logged in */}
          {!studentUser && (
            <div className="bg-white rounded-3xl p-6 sm:p-10 text-center border border-slate-200 shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mx-auto text-amber-600 shadow-2xs">
                <LogIn className="w-7 h-7" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  ফলাফল দেখতে লগইন করুন
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  আপনার সংরক্ষিত লাইভ ও প্র্যাকটিস স্কোর, ভুল উত্তরের খাতা এবং সঠিক উত্তরপত্র দেখতে Google দিয়ে লগইন করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => loginWithGoogle(undefined, window.location.pathname)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-xs cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Google দিয়ে লগইন করুন</span>
              </button>
            </div>
          )}

          {/* CASE 2: Student logged in, but NO submission for this exam */}
          {studentUser && !hasSubmissions && (
            <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-xs space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center mx-auto text-indigo-600 shadow-2xs">
                <BookOpenCheck className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  আপনি এখনো এই পরীক্ষায় অংশগ্রহণ করেননি
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  পরীক্ষাটি সম্পন্ন করলেই এখানে আপনার লাইভ ও প্র্যাকটিস পরীক্ষার স্কোর, প্রতিটি প্রশ্নের সঠিক/ভুল বিশ্লেষণ ও সমাধান দেখতে পাবেন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartExam(examKey)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-6 py-3 rounded-xl text-xs sm:text-sm transition shadow-sm cursor-pointer active:scale-95"
              >
                <PlayCircle className="w-5 h-5" />
                <span>এখনই পরীক্ষা শুরু করুন</span>
              </button>
            </div>
          )}

          {/* CASE 3: Student HAS submissions */}
          {studentUser && hasSubmissions && (
            <div className="space-y-4 sm:space-y-5">
              {/* 1. ATTEMPTS BREAKDOWN CARDS (Live vs Latest Practice) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Live Exam Attempt Card */}
                {liveSubmission ? (
                  <div className="bg-gradient-to-br from-rose-50/70 via-white to-red-50/40 rounded-2xl p-4 sm:p-5 border-2 border-rose-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider shadow-2xs">
                        <Zap className="w-3.5 h-3.5" /> লাইভ পরীক্ষা
                      </span>
                      {studentLeaderboardRank && (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md text-xs font-black">
                          <Trophy className="w-3 h-3 text-amber-600" />
                          মেধা ক্রম: #{toBengaliDigits(studentLeaderboardRank.rank)}
                        </span>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] text-slate-500 font-bold">লাইভে অর্জিত স্কোর</p>
                      <p className="text-2xl font-black text-slate-900">
                        {toBengaliDigits(liveSubmission.score)}
                        <span className="text-xs text-slate-400 font-bold">
                          {" "}
                          / {toBengaliDigits(liveSubmission.totalQuestions || qCount)}
                        </span>
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-rose-100 text-center">
                      <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-bold block">সঠিক</span>
                        <span className="text-xs font-black text-emerald-700">
                          {toBengaliDigits(liveSubmission.correct || 0)}
                        </span>
                      </div>
                      <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-bold block">ভুল</span>
                        <span className="text-xs font-black text-rose-700">
                          {toBengaliDigits(liveSubmission.incorrect || 0)}
                        </span>
                      </div>
                      <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-bold block">সময়</span>
                        <span className="text-[11px] font-bold text-slate-700 truncate block">
                          {liveSubmission.timeSpent || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center space-y-1">
                    <Zap className="w-7 h-7 text-slate-300" />
                    <p className="text-xs font-bold text-slate-700">লাইভ পরীক্ষায় অংশ নেওয়া হয়নি</p>
                    <p className="text-[11px] text-slate-400">এই পরীক্ষাটির লাইভ পর্বে আপনি উপস্থিত ছিলেন না।</p>
                  </div>
                )}

                {/* Latest Practice Attempt Card */}
                {practiceSubmissions.length > 0 ? (
                  <div className="bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/40 rounded-2xl p-4 sm:p-5 border-2 border-indigo-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black uppercase tracking-wider shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5" /> সর্বশেষ প্র্যাকটিস
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold">
                        {practiceSubmissions[0].submittedAtISO
                          ? formatBangladeshDate(practiceSubmissions[0].submittedAtISO)
                          : ""}
                      </span>
                    </div>

                    <div>
                      <p className="text-[11px] text-slate-500 font-bold">প্র্যাকটিস স্কোর</p>
                      <p className="text-2xl font-black text-slate-900">
                        {toBengaliDigits(practiceSubmissions[0].score)}
                        <span className="text-xs text-slate-400 font-bold">
                          {" "}
                          / {toBengaliDigits(practiceSubmissions[0].totalQuestions || qCount)}
                        </span>
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-indigo-100 text-center">
                      <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-bold block">সঠিক</span>
                        <span className="text-xs font-black text-emerald-700">
                          {toBengaliDigits(practiceSubmissions[0].correct || 0)}
                        </span>
                      </div>
                      <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-bold block">ভুল</span>
                        <span className="text-xs font-black text-rose-700">
                          {toBengaliDigits(practiceSubmissions[0].incorrect || 0)}
                        </span>
                      </div>
                      <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-500 font-bold block">মোট প্র্যাকটিস</span>
                        <span className="text-xs font-black text-indigo-700">
                          {toBengaliDigits(practiceSubmissions.length)} বার
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-dashed border-slate-200 text-center flex flex-col items-center justify-center space-y-1">
                    <Sparkles className="w-7 h-7 text-slate-300" />
                    <p className="text-xs font-bold text-slate-700">কোনো প্র্যাকটিস এটেম্পট নেই</p>
                    <p className="text-[11px] text-slate-400">লাইভের পরে পুনরায় পরীক্ষা দিলে এখানে যুক্ত হবে।</p>
                  </div>
                )}
              </div>

              {/* 2. ATTEMPT SWITCHER (If student took it multiple times) */}
              {submissions.length > 1 && (
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs space-y-2">
                  <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ListFilter className="w-3.5 h-3.5 text-indigo-600" />
                    <span>কোন এটেম্পটের উত্তরপত্র বিশ্লেষণ দেখতে চান?</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {submissions.map((sub, sIdx) => {
                      const isLive = sub.isLiveSubmission === true;
                      const isSelected = selectedAttemptIndex === sIdx;
                      return (
                        <button
                          key={sub.id || sIdx}
                          type="button"
                          onClick={() => setSelectedAttemptIndex(sIdx)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                            isSelected
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                          }`}
                        >
                          <span>
                            {isLive ? "🔴 লাইভ" : `🔄 প্র্যাকটিস #${toBengaliDigits(submissions.length - sIdx)}`}
                          </span>
                          <span className="text-[11px] opacity-80">
                            (স্কোর: {toBengaliDigits(sub.score)})
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. QUESTION-BY-QUESTION REVIEW SECTION */}
              {!answersReleased ? (
                <div className="bg-white rounded-3xl border border-amber-200 p-8 text-center space-y-3">
                  <Clock className="w-10 h-10 text-amber-600 mx-auto animate-pulse" />
                  <h4 className="font-bold text-slate-900 text-base">উত্তরপত্র এখনও অপ্রকাশিত</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    পরীক্ষার নির্ধারিত সময় শেষ হওয়ার পর পূর্ণাঙ্গ সঠিক উত্তর, আপনার উত্তর এবং ব্যাখ্যা দেখতে পাবেন।
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {/* Header with filter chips */}
                  <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>প্রশ্ন ও উত্তরপত্র পর্যালোচনা</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        আপনার দাগানো উত্তরের সাথে সঠিক উত্তরের তুলনামূলক বিশ্লেষণ
                      </p>
                    </div>

                    {/* Filter chips */}
                    <div className="grid grid-cols-2 min-[520px]:flex min-[520px]:flex-wrap gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setFilterMode("all")}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border text-center justify-center flex items-center ${
                          filterMode === "all"
                            ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        সবগুলো ({toBengaliDigits(qCount)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterMode("correct")}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border text-center justify-center flex items-center ${
                          filterMode === "correct"
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        সঠিক ({toBengaliDigits(activeSubmission?.correct || 0)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterMode("incorrect")}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border text-center justify-center flex items-center ${
                          filterMode === "incorrect"
                            ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                            : "bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100"
                        }`}
                      >
                        ভুল ({toBengaliDigits(activeSubmission?.incorrect || 0)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterMode("skipped")}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer border text-center justify-center flex items-center ${
                          filterMode === "skipped"
                            ? "bg-slate-600 text-white border-slate-600 shadow-2xs"
                            : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        দাগানো হয়নি
                      </button>
                    </div>
                  </div>

                  {/* Questions items */}
                  <div className="space-y-3">
                    {(() => {
                      const effectiveAnswers = activeSubmission?.answers || [];
                      const isNewFormat =
                        effectiveAnswers.length > 0 &&
                        typeof effectiveAnswers[0] === "object" &&
                        effectiveAnswers[0] !== null &&
                        "qid" in effectiveAnswers[0];

                      const renderedList = questions.map((q, qIdx) => {
                        let studentAnsIdx: number | null = null;
                        if (isNewFormat) {
                          const matched: any = (effectiveAnswers as any[]).find(
                            (a: any) => a && typeof a === "object" && a.qid === q.id
                          );
                          if (
                            matched &&
                            matched.ans !== null &&
                            matched.ans !== undefined &&
                            matched.ans !== -1 &&
                            matched.ans !== ""
                          ) {
                            studentAnsIdx = Number(matched.ans);
                          }
                        } else {
                          const raw = (effectiveAnswers as any[])?.[qIdx];
                          if (raw !== null && raw !== undefined && raw !== -1 && raw !== "") {
                            studentAnsIdx =
                              typeof raw === "object" && "ans" in raw
                                ? raw.ans === -1
                                  ? null
                                  : Number(raw.ans)
                                : Number(raw);
                          }
                        }

                        const sol =
                          solutions?.find((s: any) => s.id && s.id === q.id) ||
                          solutions?.[qIdx] || { correct: 0, exp: "" };
                        const solCorrect = Number(sol.correct);
                        const isCorrect = studentAnsIdx !== null && studentAnsIdx === solCorrect;
                        const isSkipped = studentAnsIdx === null;

                        // Filter
                        if (filterMode === "correct" && !isCorrect) return null;
                        if (filterMode === "incorrect" && (isCorrect || isSkipped)) return null;
                        if (filterMode === "skipped" && !isSkipped) return null;

                        return (
                          <div
                            key={q.id || qIdx}
                            className={`bg-white rounded-2xl border p-3 sm:p-5 shadow-xs space-y-3 ${
                              isSkipped
                                ? "border-slate-200"
                                : isCorrect
                                ? "border-emerald-200 bg-emerald-50/15"
                                : "border-rose-200 bg-rose-50/15"
                            }`}
                          >
                            {/* Question Meta Bar */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center justify-center font-black text-xs px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200">
                                  প্রশ্ন {toBengaliDigits(qIdx + 1)}
                                </span>
                                {isSkipped ? (
                                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <MinusCircle className="w-3 h-3" /> দাগানো হয়নি
                                  </span>
                                ) : isCorrect ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> সঠিক (+১)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                                    <XCircle className="w-3 h-3 text-rose-600" /> ভুল (-০.৫)
                                  </span>
                                )}
                              </div>

                              <BookmarkButton
                                size="sm"
                                studentId={activeSubmission?.studentId}
                                question={{
                                  q: q.q,
                                  opts: q.opts,
                                  correct: solCorrect,
                                  exp: sol.exp,
                                  userAns: studentAnsIdx,
                                  examTitle: exam.title,
                                  topic: q.topic,
                                  subject: exam.subject || ""
                                }}
                              />
                            </div>

                            {/* Question Statement */}
                            <h4 className="font-bold text-sm sm:text-base text-slate-900 leading-relaxed break-words">
                              <MathText text={q.q} />
                            </h4>

                            {/* Options 4-Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                              {q.opts.map((opt, oIdx) => {
                                const isAns = oIdx === solCorrect;
                                const isStudent = oIdx === studentAnsIdx;
                                let boxCls = "border-slate-200 bg-slate-50 text-slate-700";
                                if (isAns) boxCls = "border-emerald-300 bg-emerald-50 text-emerald-950 font-bold";
                                if (isStudent && !isAns) boxCls = "border-rose-300 bg-rose-50 text-rose-950 font-bold";
                                if (isAns && isStudent) boxCls = "border-emerald-400 bg-emerald-100 text-emerald-950 font-bold";

                                return (
                                  <div
                                    key={oIdx}
                                    className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs sm:text-sm ${boxCls}`}
                                  >
                                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 bg-slate-800 text-white">
                                      {optLabels[oIdx]}
                                    </span>
                                    <span className="flex-1 min-w-0 break-words"><MathText text={opt} /></span>
                                    {isAns && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                                    {isStudent && !isAns && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Answer Summary Line */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3 pt-1 text-xs sm:text-sm bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-500 font-medium">আপনার উত্তর:</span>
                                <strong className={isCorrect ? "text-emerald-700" : isSkipped ? "text-slate-400" : "text-rose-700"}>
                                  {isSkipped ? (
                                    "দাগানো হয়নি"
                                  ) : (
                                    <>
                                      {optLabels[studentAnsIdx!]} (<MathText text={q.opts[studentAnsIdx!] || "—"} />)
                                    </>
                                  )}
                                </strong>
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap text-emerald-800">
                                <span className="text-slate-500 font-medium">সঠিক উত্তর:</span>
                                <strong>
                                  {optLabels[solCorrect]} (<MathText text={q.opts[solCorrect] || "—"} />)
                                </strong>
                              </div>
                            </div>

                            {/* Explanation */}
                            {sol.exp && (
                              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                                <strong className="text-amber-900 block mb-0.5">ব্যাখ্যা:</strong>
                                <MathText text={sol.exp} />
                              </div>
                            )}
                          </div>
                        );
                      });

                      const visible = renderedList.filter(Boolean);
                      if (visible.length === 0) {
                        return (
                          <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-400 font-medium text-xs">
                            এই ফিল্টারে কোনো প্রশ্ন নেই।
                          </div>
                        );
                      }
                      return visible;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: LEADERBOARD ===================== */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
          {/* Student Rank Highlight Banner (if student is ranked) */}
          {studentLeaderboardRank && (
            <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 p-3.5 sm:p-5 rounded-2xl shadow-sm flex items-center justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/40 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-slate-950" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-bold text-amber-950 uppercase tracking-wider">আপনার অবস্থান</p>
                  <h3 className="text-base sm:text-xl font-black truncate">
                    মেধা তালিকায় আপনি {toBengaliDigits(studentLeaderboardRank.rank)} তম
                  </h3>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] sm:text-xs font-bold text-amber-950 block">অর্জিত স্কোর</span>
                <span className="text-lg sm:text-xl font-black">{toBengaliDigits(studentLeaderboardRank.item.score)}</span>
              </div>
            </div>
          )}

          {/* Standard Leaderboard Table */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-6 border border-slate-200 shadow-xs">
            <LeaderboardTable
              title={`${exam.title} - মেধা তালিকা`}
              items={leaderboard}
              isLoading={false}
              isLocked={hubData?.isLocked ?? false}
              noLeaderboard={hubData?.hasNoLeaderboard ?? false}
              releaseDateText={hubData?.releaseDateText || ""}
              onPrint={() => window.print()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
