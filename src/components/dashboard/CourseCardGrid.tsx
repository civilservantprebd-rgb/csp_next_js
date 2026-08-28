"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  BookOpen,
  PlayCircle,
  UserPlus,
  Clock,
  CircleHelp,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Layers
} from "lucide-react";
import { Exam, SubjectItem } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";

interface CourseCardGridProps {
  courses: string[];
  subjects: SubjectItem[];
  exams: Record<string, Exam>;
  onStartExam: (examKey: string) => void;
  onOpenEnrollModal: (courseName?: string) => void;
}

export const CourseCardGrid: React.FC<CourseCardGridProps> = ({
  courses,
  subjects,
  exams,
  onStartExam,
  onOpenEnrollModal,
}) => {
  // Store selected subject per course { [courseName]: selectedSubjectName }
  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, string>>({});
  // Store selected exam per course { [courseName]: selectedExamKey }
  const [selectedExams, setSelectedExams] = useState<Record<string, string>>({});

  const handleSubjectSelect = (courseName: string, subjectName: string) => {
    setSelectedSubjects((prev) => ({
      ...prev,
      [courseName]: subjectName,
    }));
    // Reset or auto-select first exam for this subject
    const matchingExams = Object.entries(exams).filter(([_, ex]) => {
      if (ex.course !== courseName) return false;
      if (subjectName !== "ALL" && ex.subject !== subjectName) return false;
      return true;
    });
    if (matchingExams.length > 0) {
      setSelectedExams((prev) => ({
        ...prev,
        [courseName]: matchingExams[0][0],
      }));
    } else {
      setSelectedExams((prev) => ({
        ...prev,
        [courseName]: "",
      }));
    }
  };

  const handleExamSelect = (courseName: string, examKey: string) => {
    setSelectedExams((prev) => ({
      ...prev,
      [courseName]: examKey,
    }));
  };

  return (
    <section className="font-bengali rounded-3xl bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/50 border-2 border-indigo-400 shadow-md shadow-indigo-100/60 ring-1 ring-indigo-300/20 p-5 sm:p-7 transition-all duration-300 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-indigo-100">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100/90 text-indigo-950 border border-indigo-200 text-xs font-bold shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-indigo-700" />
            <span>উপলব্ধ সকল কোর্সসমূহ</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-indigo-950">
            আমাদের ব্যাচ
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {courses.map((courseName) => {
          // Course subjects
          const courseSubjects = subjects.filter((s) => s.course === courseName);
          const activeSubject = selectedSubjects[courseName] || "ALL";

          // Course exams
          const courseAllExams = Object.entries(exams).filter(([_, ex]) => ex.course === courseName);
          const filteredExams = courseAllExams.filter(([_, ex]) => {
            if (activeSubject !== "ALL" && ex.subject !== activeSubject) return false;
            return true;
          });

          // Active selected exam for this card
          const activeExamKey = selectedExams[courseName] || (filteredExams.length > 0 ? filteredExams[0][0] : "");
          const activeExamObj = activeExamKey ? exams[activeExamKey] : null;

          return (
            <div
              key={courseName}
              className="bg-white rounded-3xl border-2 border-slate-200/80 hover:border-indigo-400 shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col justify-between"
            >
              {/* Course Card Top Header */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shadow-md shrink-0">
                      <div className="w-full h-full bg-slate-900/90 rounded-[14px] flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-amber-300" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg sm:text-xl font-black text-white leading-tight">
                          {courseName}
                        </h4>
                      </div>
                      <p className="text-xs text-indigo-200 mt-0.5">
                        মোট {toBengaliDigits(courseAllExams.length)}টি পরীক্ষা উপলব্ধ
                      </p>
                    </div>
                  </div>

                  {/* Enroll in this course button */}
                  <button
                    onClick={() => onOpenEnrollModal(courseName)}
                    className="self-start sm:self-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md hover:shadow-emerald-500/20 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>কোর্স এনরোল করুন</span>
                  </button>
                </div>
              </div>

              {/* Course Card Body */}
              <div className="p-5 sm:p-6 space-y-5 flex-grow">
                {/* Subject Selector Chips */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> সাবজেক্ট নির্বাচন করুন:
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      {courseSubjects.length > 0
                        ? `${toBengaliDigits(courseSubjects.length)}টি বিষয়`
                        : "বিষয় যোগ হয়নি"}
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => handleSubjectSelect(courseName, "ALL")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        activeSubject === "ALL"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      সকল বিষয় ({toBengaliDigits(courseAllExams.length)})
                    </button>
                    {courseSubjects.map((s, sIdx) => {
                      const count = courseAllExams.filter(([_, ex]) => ex.subject === s.name).length;
                      const isSelected = activeSubject === s.name;
                      return (
                        <button
                          key={`${s.name}_${sIdx}`}
                          type="button"
                          onClick={() => handleSubjectSelect(courseName, s.name)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-sm font-bold"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <span>{s.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                              isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {toBengaliDigits(count)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Exam List Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                    <span>পরীক্ষা নির্বাচন করুন:</span>
                    <span className="text-[11px] text-indigo-600 font-semibold">
                      {filteredExams.length > 0
                        ? `${toBengaliDigits(filteredExams.length)}টি পরীক্ষা পাওয়া গেছে`
                        : "পরীক্ষা নেই"}
                    </span>
                  </label>

                  {filteredExams.length === 0 ? (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500">
                      এই বিষয়ে বর্তমানে কোনো পরীক্ষা যুক্ত নেই। শীঘ্রই যুক্ত করা হবে।
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {filteredExams.map(([eKey, ex]) => {
                        const isSelected = activeExamKey === eKey;
                        const qCount = ex.questions?.length || 0;
                        return (
                          <div
                            key={eKey}
                            onClick={() => handleExamSelect(courseName, eKey)}
                            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? "bg-indigo-50/70 border-indigo-600 shadow-sm"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70"
                            }`}
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-bold text-slate-900 text-sm truncate">{ex.title}</h5>
                                {ex.isFree && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                    <Sparkles className="w-2.5 h-2.5" /> ফ্রি
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3 text-slate-400" /> {ex.subject}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-500" /> {toBengaliDigits(ex.timerMinutes)} মি.
                                </span>
                                <span className="flex items-center gap-1">
                                  <CircleHelp className="w-3 h-3 text-indigo-500" /> {toBengaliDigits(qCount)} টি প্রশ্ন
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <span
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Course Card Bottom - Start Exam Button */}
              <div className="p-5 sm:p-6 pt-0">
                <button
                  type="button"
                  disabled={!activeExamKey}
                  onClick={() => activeExamKey && onStartExam(activeExamKey)}
                  className={`w-full py-3.5 px-5 rounded-2xl font-black text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
                    activeExamKey
                      ? "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 shadow-amber-500/20 active:scale-[0.99]"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  }`}
                >
                  <PlayCircle className="w-5 h-5" />
                  <span>
                    {activeExamObj ? `পরীক্ষা শুরু করুন (${activeExamObj.title})` : "পরীক্ষা শুরু করুন"}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
