"use client";

import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  BookOpen,
  UserPlus,
  ChevronRight,
  Layers,
  Pin,
  Video,
  PlayCircle,
  ArrowRight,
  FileText
} from "lucide-react";
import { Exam, SubjectItem } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";
import { getCourseVideos } from "@/actions/video-actions";

interface CourseCardGridProps {
  courses: string[];
  subjects: SubjectItem[];
  exams: Record<string, Exam>;
  pinnedCourses?: string[];
  onOpenCourse: (courseName: string) => void;
  onOpenEnrollModal: (courseName?: string) => void;
}

/**
 * Front-page course directory: শুধু কোর্সের ইনফরমেশন — কোর্সে ট্যাপ করলে
 * কোর্সের স্টাডি পেজে নিয়ে যায় (সেখানে ভিডিও ক্লাস + পরীক্ষা)।
 */
export const CourseCardGrid: React.FC<CourseCardGridProps> = ({
  courses,
  subjects,
  exams,
  pinnedCourses = [],
  onOpenCourse,
  onOpenEnrollModal,
}) => {
  // Video count per course (shown on cards)
  const [videoCounts, setVideoCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getCourseVideos().then((all) => {
      const counts: Record<string, number> = {};
      all.forEach((v) => {
        counts[v.course] = (counts[v.course] || 0) + 1;
      });
      setVideoCounts(counts);
    });
  }, []);

  // Pinned courses appear first
  const sortedCourses = [...courses].sort((a, b) => {
    const pa = pinnedCourses.includes(a) ? 0 : 1;
    const pb = pinnedCourses.includes(b) ? 0 : 1;
    return pa - pb;
  });

  return (
    <section className="font-bengali rounded-3xl bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/50 border-2 border-indigo-400 shadow-md shadow-indigo-100/60 ring-1 ring-indigo-300/20 p-5 sm:p-7 transition-all duration-300 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-indigo-100">
        <div className="space-y-2.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100/90 text-indigo-950 border border-indigo-200 text-xs font-bold shadow-2xs">
            <Layers className="w-3.5 h-3.5 text-indigo-700" />
            <span>আমাদের ব্যাচ</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-indigo-950">
            কোর্স বেছে নিন — ভিডিও ক্লাস ও পরীক্ষা এক জায়গায়
          </h3>
          <p className="text-xs sm:text-sm text-black font-bold">
            যেকোনো কোর্সে ট্যাপ করলে ভিডিও লাইব্রেরি, বিষয়ভিত্তিক ক্লাস ও পরীক্ষাসমূহ দেখতে পাবেন
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedCourses.map((courseName) => {
          const courseSubjects = subjects.filter((s) => s.course === courseName);
          const examCount = Object.values(exams).filter((ex) => ex.course === courseName).length;
          const videoCount = videoCounts[courseName] || 0;

          return (
            <div
              key={courseName}
              onClick={() => onOpenCourse(courseName)}
              className="group bg-white rounded-3xl border-2 border-slate-200/80 hover:border-indigo-500 shadow-md hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col cursor-pointer active:scale-[0.99]"
            >
              {/* Course header */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 text-white p-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-400 p-0.5 shadow-md shrink-0 group-hover:scale-105 transition-transform">
                    <div className="w-full h-full bg-slate-900/90 rounded-[14px] flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-amber-300" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg sm:text-xl font-black text-white leading-tight line-clamp-2">
                        {courseName}
                      </h4>
                      {pinnedCourses.includes(courseName) && (
                        <span className="inline-flex items-center gap-0.5 bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0">
                          <Pin className="w-3 h-3" /> পিন
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      মোট {toBengaliDigits(examCount)}টি পরীক্ষা · {toBengaliDigits(videoCount)}টি ভিডিও
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEnrollModal(courseName);
                  }}
                  className="mt-4 w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md hover:shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Enroll Now</span>
                </button>
              </div>

              {/* Course body — quick stats */}
              <div className="p-5 space-y-4 flex-grow">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <FileText className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                    <span className="block text-base font-black text-slate-900">{toBengaliDigits(examCount)}</span>
                    <span className="block text-[9px] text-slate-500 font-bold">পরীক্ষা</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <Video className="w-4 h-4 text-rose-600 mx-auto mb-1" />
                    <span className="block text-base font-black text-slate-900">{toBengaliDigits(videoCount)}</span>
                    <span className="block text-[9px] text-slate-500 font-bold">ভিডিও ক্লাস</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                    <BookOpen className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                    <span className="block text-base font-black text-slate-900">{toBengaliDigits(courseSubjects.length)}</span>
                    <span className="block text-[9px] text-slate-500 font-bold">বিষয়</span>
                  </div>
                </div>

                {courseSubjects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {courseSubjects.slice(0, 8).map((s) => (
                      <span
                        key={s.name}
                        className="bg-indigo-50 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200"
                      >
                        {s.name}
                      </span>
                    ))}
                    {courseSubjects.length > 8 && (
                      <span className="text-[10px] text-slate-400 font-bold px-1 py-0.5">
                        +{toBengaliDigits(courseSubjects.length - 8)}টি
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="px-5 pb-5">
                <div className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3 px-5 rounded-2xl text-xs sm:text-sm transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                  <PlayCircle className="w-5 h-5" />
                  <span>কোর্স খুলুন</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
