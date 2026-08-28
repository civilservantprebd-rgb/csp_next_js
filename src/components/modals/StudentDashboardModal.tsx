"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  GraduationCap,
  History,
  ChevronRight,
  Calendar,
  FileText,
  Lock,
  Loader2
} from "lucide-react";
import { getStudentSubmissions } from "@/actions/student-actions";
import { Submission } from "@/types/submission";
import { toBengaliDigits } from "@/lib/utils";
import { isAnswerTimeReached } from "@/actions/exam-actions";
import { Exam } from "@/types/exam";

interface StudentDashboardModalProps {
  isOpen: boolean;
  studentId: string;
  exams: Record<string, Exam>;
  routineUrl?: string;
  syllabusUrl?: string;
  onClose: () => void;
  onSelectSubmissionDetail: (submission: Submission) => void;
}

export const StudentDashboardModal: React.FC<StudentDashboardModalProps> = ({
  isOpen,
  studentId,
  exams,
  routineUrl = "https://drive.google.com",
  syllabusUrl = "https://drive.google.com",
  onClose,
  onSelectSubmissionDetail,
}) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && studentId) {
      setIsLoading(true);
      getStudentSubmissions(studentId).then((data) => {
        setSubmissions(data);
        setIsLoading(false);
      });
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  const releasedSubs = submissions.filter((s) => {
    const ex = exams[s.examKey];
    return ex ? isAnswerTimeReached(ex) : true;
  });

  let bestScore = 0;
  let totalScore = 0;
  let totalAccSum = 0;

  releasedSubs.forEach((s) => {
    const sc = typeof s.score === "number" ? s.score : parseFloat(s.score as any) || 0;
    if (sc > bestScore) bestScore = sc;
    totalScore += sc;
    const acc = s.totalQuestions ? (s.correct / s.totalQuestions) * 100 : 0;
    totalAccSum += isNaN(acc) ? 0 : acc;
  });

  const avgScore = releasedSubs.length > 0 ? (totalScore / releasedSubs.length).toFixed(1) : "০";
  const avgAcc = releasedSubs.length > 0 ? Math.round(totalAccSum / releasedSubs.length) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 font-bengali">
      <div className="bg-white rounded-3xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col relative">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center space-x-3">
            <div className="bg-violet-100 text-violet-700 w-10 h-10 rounded-xl flex items-center justify-center font-bold">
              <GraduationCap className="w-6 h-6 text-violet-700" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">স্টুডেন্ট ড্যাশবোর্ড</h3>
              <p className="text-xs text-slate-500 font-mono">স্টুডেন্ট আইডি: {studentId}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow pr-1 space-y-4">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-200 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div>
              <h4 className="font-bold text-emerald-950 text-sm">রুটিন ও সিলেবাস ডাউনলোড</h4>
              <p className="text-[11px] text-emerald-700">গুগল ড্রাইভ থেকে আপডেটেড সিলেবাস ও পরীক্ষার রুটিন পান</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <a
                href={routineUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none text-center bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" /> রুটিন
              </a>
              <a
                href={syllabusUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-none text-center bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> সিলেবাস
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
              <span className="text-[10px] sm:text-xs text-slate-500 block">অংশগ্রহণকৃত এক্সাম</span>
              <span className="text-base sm:text-lg font-bold text-slate-800">{toBengaliDigits(submissions.length)}</span>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[10px] sm:text-xs text-emerald-600 block">গড় পারসেন্টেজ</span>
              <span className="text-base sm:text-lg font-bold text-emerald-700">{toBengaliDigits(avgAcc)}%</span>
            </div>
            <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-200 text-center">
              <span className="text-[10px] sm:text-xs text-indigo-600 block">সর্বোচ্চ স্কোর</span>
              <span className="text-base sm:text-lg font-bold text-indigo-700">{toBengaliDigits(bestScore)}</span>
            </div>
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-center">
              <span className="text-[10px] sm:text-xs text-amber-600 block">গড় স্কোর</span>
              <span className="text-base sm:text-lg font-bold text-amber-700">{toBengaliDigits(avgScore)}</span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-violet-600" /> সাম্প্রতিক পরীক্ষার পারফরম্যান্স
              </span>
              <span className="text-[11px] text-slate-400 font-normal">(ক্লিক করে সমাধান দেখুন)</span>
            </h4>

            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-6 text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> পারফরম্যান্স লোড হচ্ছে...
                </div>
              ) : submissions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">আপনার কোনো পরীক্ষার রেকর্ড পাওয়া যায়নি।</p>
              ) : (
                submissions.map((sub, sIdx) => {
                  const ex = exams[sub.examKey];
                  const canShow = ex ? isAnswerTimeReached(ex) : true;

                  return (
                    <button
                      key={sIdx}
                      onClick={() => onSelectSubmissionDetail(sub)}
                      className="w-full text-left p-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-violet-50/60 transition flex justify-between items-center group shadow-xs cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-violet-700 transition">
                            {toBengaliDigits(sIdx + 1)}. {sub.examTitle}
                          </h4>
                          {sub.isLiveSubmission === false && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              অনুশীলন
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">সময়কাল: {sub.timeSpent}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {canShow ? (
                          <span className="bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-xl text-xs font-mono">
                            স্কোর: {toBengaliDigits(sub.score)}
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1">
                            <Lock className="w-3 h-3" /> ফলাফল গোপন
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 transition" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 mt-4 text-right">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-6 py-2.5 rounded-xl text-xs sm:text-sm transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
