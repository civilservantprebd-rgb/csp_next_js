"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  BookOpen,
  Award,
  ChevronRight,
  FileText,
  Calendar,
  Loader2,
  ArrowRight
} from "lucide-react";
import { Exam } from "@/types/exam";
import { Submission } from "@/types/submission";
import { toBengaliDigits, formatBangladeshDate } from "@/lib/utils";
import { isAnswerTimeReached, parseBangladeshDateTime } from "@/lib/bangladesh-time";
import {
  getStudentCourseSummaries,
  getCourseSubmissions,
  CourseSummaryItem
} from "@/actions/student-actions";

interface CourseGroupedResultsProps {
  exams: Record<string, Exam>;
  onSelectSubmissionDetail: (submission: Submission) => void;
  onOpenEnrollModal?: (courseName?: string) => void;
  onLoginPrompt?: () => void;
  studentId?: string;
}

export interface ExamResultItem {
  examKey: string;
  examTitle: string;
  subject?: string;
  courseName: string;
  totalQuestions: number;
  liveSubmission?: Submission;
  latestPracticeSubmission?: Submission;
  latestSubmissionDate?: string;
  maxScore: number;
  liveEndMs?: number;
}

export const CourseGroupedResults: React.FC<CourseGroupedResultsProps> = ({
  exams,
  onSelectSubmissionDetail,
  onOpenEnrollModal,
  onLoginPrompt,
  studentId,
}) => {
  // Course summaries (lightweight list: courseName, totalExamsTaken, highestScore, avgScore)
  const [courseSummaries, setCourseSummaries] = useState<CourseSummaryItem[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  // Expanded course state
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  // Lazy cache of exams per course: courseName -> ExamResultItem[]
  const [courseExamsCache, setCourseExamsCache] = useState<Record<string, ExamResultItem[]>>({});
  const [loadingExamsForCourse, setLoadingExamsForCourse] = useState<string | null>(null);

  // 1. Fetch lightweight course summaries immediately (Ultra Fast)
  useEffect(() => {
    if (!studentId) {
      setCourseSummaries([]);
      return;
    }

    setLoadingSummaries(true);
    getStudentCourseSummaries(studentId, exams)
      .then((summaries) => {
        setCourseSummaries(summaries || []);
      })
      .catch((err) => {
        console.error("Failed to load course summaries:", err);
      })
      .finally(() => {
        setLoadingSummaries(false);
      });
  }, [studentId, exams]);

  // 2. Fetch submissions for a course ON DEMAND only when the user clicks a course card!
  const toggleCourse = async (courseName: string) => {
    if (expandedCourse === courseName) {
      setExpandedCourse(null);
      return;
    }

    setExpandedCourse(courseName);

    // If already cached, no need to fetch again!
    if (courseExamsCache[courseName]) {
      return;
    }

    if (!studentId) return;

    setLoadingExamsForCourse(courseName);
    try {
      // Find all exam keys that belong to this course
      const courseExamKeys = Object.entries(exams)
        .filter(([_, ex]) => (ex.course || "সাধারণ কোর্স") === courseName)
        .map(([k]) => k);

      const subs = await getCourseSubmissions(studentId, courseExamKeys);

      // Group submissions by examKey:
      // Live is kept permanently; Practice keeps only the latest attempt!
      const examMap = new Map<string, { live?: Submission; practice?: Submission }>();

      subs.forEach((sub) => {
        if (!examMap.has(sub.examKey)) {
          examMap.set(sub.examKey, {});
        }
        const record = examMap.get(sub.examKey)!;

        if (sub.isLiveSubmission) {
          if (!record.live) {
            record.live = sub;
          } else {
            const oldT = record.live.submittedAtISO ? new Date(record.live.submittedAtISO).getTime() : 0;
            const newT = sub.submittedAtISO ? new Date(sub.submittedAtISO).getTime() : 0;
            if (newT > oldT) record.live = sub;
          }
        } else {
          if (!record.practice) {
            record.practice = sub;
          } else {
            const oldT = record.practice.submittedAtISO ? new Date(record.practice.submittedAtISO).getTime() : 0;
            const newT = sub.submittedAtISO ? new Date(sub.submittedAtISO).getTime() : 0;
            if (newT > oldT) record.practice = sub;
          }
        }
      });

      const examItems: ExamResultItem[] = [];

      examMap.forEach((rec, examKey) => {
        const exam = exams[examKey];
        const live = rec.live;
        const practice = rec.practice;

        const liveTime = live?.submittedAtISO ? new Date(live.submittedAtISO).getTime() : 0;
        const practiceTime = practice?.submittedAtISO ? new Date(practice.submittedAtISO).getTime() : 0;
        const latestTime = Math.max(liveTime, practiceTime);
        const latestDate = latestTime > 0 ? new Date(latestTime).toISOString() : undefined;

        const liveScore = live?.score ?? 0;
        const practiceScore = practice?.score ?? 0;
        const maxScore = Math.max(live ? liveScore : 0, practice ? practiceScore : 0);

        const totalQ = exam?.questions?.length || live?.totalQuestions || practice?.totalQuestions || 0;

        const examLiveEndStr = exam?.endTime || exam?.leaderboardEndTime || exam?.startTime;
        const examLiveEndMs = examLiveEndStr ? (parseBangladeshDateTime(examLiveEndStr)?.getTime() ?? 0) : 0;

        examItems.push({
          examKey,
          examTitle: exam?.title || live?.examTitle || practice?.examTitle || "মডেল টেস্ট",
          subject: exam?.subject,
          courseName,
          totalQuestions: totalQ,
          liveSubmission: live,
          latestPracticeSubmission: practice,
          latestSubmissionDate: latestDate,
          maxScore,
          liveEndMs: examLiveEndMs,
        });
      });

      // Sort exams: whose live ended latest comes first
      examItems.sort((a, b) => {
        if (b.liveEndMs !== a.liveEndMs) {
          return b.liveEndMs - a.liveEndMs;
        }
        const tA = a.latestSubmissionDate ? new Date(a.latestSubmissionDate).getTime() : 0;
        const tB = b.latestSubmissionDate ? new Date(b.latestSubmissionDate).getTime() : 0;
        return tB - tA;
      });

      setCourseExamsCache((prev) => ({
        ...prev,
        [courseName]: examItems,
      }));
    } catch (err) {
      console.error("Failed to load course exams:", err);
    } finally {
      setLoadingExamsForCourse(null);
    }
  };

  // If student is not logged in / no studentId
  if (!studentId) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4 text-indigo-600">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-1">আপনার পরীক্ষার ফলাফল দেখতে লগইন করুন</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
          আপনি যে যে কোর্সের পরীক্ষায় অংশগ্রহণ করেছেন, সেই সব কোর্সের বিস্তারিত ফলাফল ও মার্কশীট দেখতে লগইন থাকা আবশ্যক।
        </p>
        <button
          type="button"
          onClick={onLoginPrompt}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95"
        >
          <span>গুগল দিয়ে লগইন করুন</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // If loading initial course summaries
  if (loadingSummaries) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500 font-semibold">কোর্স ও ফলাফল লোড হচ্ছে...</p>
      </div>
    );
  }

  // If student has no course submissions
  if (courseSummaries.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center mx-auto mb-4 text-amber-600">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-1">এখনও কোনো পরীক্ষায় অংশগ্রহণ করা হয়নি</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mb-5 leading-relaxed">
          লাইভ এক্সাম কিংবা ফ্রি মডেল টেস্টে অংশগ্রহণ করে আপনার প্রস্তুতি যাচাই করুন। পরীক্ষা দেওয়া শেষ হলেই এখানে কোর্স অনুযায়ী ফলাফল সাজিয়ে দেওয়া হবে।
        </p>
        {onOpenEnrollModal && (
          <button
            type="button"
            onClick={() => onOpenEnrollModal()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-sm transition cursor-pointer"
          >
            <span>কোর্সে ভর্তি হোন ও পরীক্ষা দিন</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {courseSummaries.map((course) => {
          const isExpanded = expandedCourse === course.courseName;
          const examsInCourse = courseExamsCache[course.courseName] || [];
          const isLoadingExams = loadingExamsForCourse === course.courseName;

          return (
            <div
              key={course.courseName}
              className={`bg-white rounded-3xl border transition-all overflow-hidden ${
                isExpanded
                  ? "border-indigo-400 shadow-md ring-1 ring-indigo-200"
                  : "border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              {/* Course Card Header - Click to open/close exams */}
              <div
                onClick={() => toggleCourse(course.courseName)}
                className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        কোর্স
                      </span>
                      <span className="text-xs text-slate-300 font-semibold">
                        অংশগ্রহণকৃত পরীক্ষা: {toBengaliDigits(course.totalExamsTaken)}টি
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-white truncate group-hover:text-amber-300 transition-colors">
                      {course.courseName}
                    </h3>
                  </div>
                </div>

                {/* Right: Course Overall Stats Pill + Toggle Icon */}
                <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                  <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-2 rounded-2xl">
                    <div className="text-left sm:text-right pr-2 border-r border-white/20">
                      <div className="text-[10px] text-slate-300 font-bold">সর্বোচ্চ নম্বর</div>
                      <div className="text-xs sm:text-sm font-black text-amber-300">
                        {toBengaliDigits(course.highestScore)}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] text-slate-300 font-bold">গড় স্কোর</div>
                      <div className="text-xs sm:text-sm font-black text-emerald-400">
                        {toBengaliDigits(course.averageScore)}
                      </div>
                    </div>
                  </div>

                  {/* Expand / Collapse Button Indicator */}
                  <div className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border border-white/15 transition">
                    <ChevronRight
                      className={`w-5 h-5 transition-transform duration-200 ${
                        isExpanded ? "rotate-90 text-amber-400" : "rotate-0 text-slate-300"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Course Exams Submissions List - Lazy loaded on click */}
              {isExpanded && (
                <div className="p-3.5 sm:p-5 bg-slate-50/70 border-t border-slate-200/80 animate-in fade-in duration-200">
                  <div className="text-xs font-bold text-slate-500 mb-3 px-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-indigo-600" />
                      <span>এই কোর্সের দেওয়া পরীক্ষাসমূহ:</span>
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      সর্বমোট {toBengaliDigits(course.totalExamsTaken)}টি পরীক্ষা
                    </span>
                  </div>

                  {isLoadingExams ? (
                    <div className="py-8 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-500 font-semibold">পরীক্ষার তালিকা আনা হচ্ছে...</p>
                    </div>
                  ) : examsInCourse.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      কোনো পরীক্ষার রেকর্ড পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {examsInCourse.map((item) => {
                        const exam = exams[item.examKey];
                        const canShowResult = exam ? isAnswerTimeReached(exam) : true;
                        const live = item.liveSubmission;
                        const practice = item.latestPracticeSubmission;

                        return (
                          <div
                            key={item.examKey}
                            className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 hover:border-indigo-300 hover:shadow-xs transition flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                          >
                            {/* Exam Title & Subject / Date Info */}
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                                <FileText className="w-4 h-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate">
                                  {item.examTitle}
                                </h4>

                                <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-500 font-semibold flex-wrap">
                                  {item.subject && (
                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                      {item.subject}
                                    </span>
                                  )}
                                  {item.latestSubmissionDate && (
                                    <span className="flex items-center gap-1 text-slate-400">
                                      <Calendar className="w-3 h-3" />
                                      {formatBangladeshDate(item.latestSubmissionDate)}
                                    </span>
                                  )}
                                  {item.totalQuestions > 0 && (
                                    <span className="text-slate-400">
                                      • মোট প্রশ্ন: {toBengaliDigits(item.totalQuestions)}টি
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Submission Badges & Action Buttons */}
                            <div className="flex items-center gap-2.5 flex-wrap md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                              {/* 1. LIVE SUBMISSION BUTTON / BADGE */}
                              {live && (
                                canShowResult ? (
                                  <button
                                    type="button"
                                    onClick={() => onSelectSubmissionDetail(live)}
                                    className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50/80 hover:bg-red-100/90 border border-red-200 text-red-950 transition cursor-pointer active:scale-95 shadow-xs"
                                    title="লাইভ পরীক্ষার মার্কশীট ও সমাধান"
                                  >
                                    <span className="px-1.5 py-0.5 rounded-md bg-red-600 text-white font-black text-[9px] tracking-wide uppercase">
                                      লাইভ
                                    </span>
                                    <div className="text-left">
                                      <div className="text-[9px] text-red-600/80 font-bold leading-none">প্রাপ্ত নম্বর</div>
                                      <div className="text-xs sm:text-sm font-black text-red-700 leading-tight">
                                        {toBengaliDigits(live.score)}
                                      </div>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-red-500 group-hover:translate-x-0.5 transition-transform" />
                                  </button>
                                ) : (
                                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl">
                                    লাইভ: ফলাফল অপেক্ষমাণ
                                  </span>
                                )
                              )}

                              {/* 2. LATEST PRACTICE ATTEMPT BUTTON / BADGE */}
                              {practice && (
                                <button
                                  type="button"
                                  onClick={() => onSelectSubmissionDetail(practice)}
                                  className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50/80 hover:bg-emerald-100/90 border border-emerald-200 text-emerald-950 transition cursor-pointer active:scale-95 shadow-xs"
                                  title="সর্বশেষ প্র্যাকটিস এটেম্পটের মার্কশীট ও সমাধান"
                                >
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-black text-[9px] tracking-wide">
                                    প্র্যাকটিস
                                  </span>
                                  <div className="text-left">
                                    <div className="text-[9px] text-emerald-600/80 font-bold leading-none">সর্বশেষ স্কোর</div>
                                    <div className="text-xs sm:text-sm font-black text-emerald-700 leading-tight">
                                      {toBengaliDigits(practice.score)}
                                    </div>
                                  </div>
                                  <ChevronRight className="w-3.5 h-3.5 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                              )}
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
        })}
      </div>
    </div>
  );
};
