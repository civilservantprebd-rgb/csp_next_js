"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CourseRoutineItem } from "@/types/pdf";
import { toBengaliDigits, formatBangladeshDate } from "@/lib/utils";
import {
  getCachedPdfRoutineData,
  fetchPdfsAndRoutines,
  subscribePdfRoutineStore,
  optimizeDriveUrl,
} from "@/lib/pdf-routine-store";
import {
  Calendar,
  Search,
  ExternalLink,
  BookOpen,
  Loader2,
  X,
  Sparkles,
  Clock,
  CalendarDays,
  ChevronRight,
  ArrowLeft,
  Folder
} from "lucide-react";

interface RoutineLibraryViewProps {
  courses: string[];
  initialCourse?: string;
}

export function RoutineLibraryView({ courses, initialCourse }: RoutineLibraryViewProps) {
  // Read cache immediately for 0ms initial render
  const initialCache = getCachedPdfRoutineData();
  const [allRoutines, setAllRoutines] = useState<CourseRoutineItem[]>(initialCache?.allRoutines || []);
  const [loading, setLoading] = useState(!initialCache || initialCache.allRoutines.length === 0);

  // Drilldown state:
  // Level 1: Course list (selectedCourse = null)
  // Level 2: Routines inside the selected course (selectedCourse = string)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(initialCourse || null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let alive = true;
    const cached = getCachedPdfRoutineData();
    if (!cached || cached.allRoutines.length === 0) {
      setLoading(true);
    }

    fetchPdfsAndRoutines()
      .then((res) => {
        if (alive) {
          setAllRoutines(res.allRoutines || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load routines:", err);
        if (alive) setLoading(false);
      });

    // Subscribe to background store updates
    const unsubscribe = subscribePdfRoutineStore((data) => {
      if (alive) {
        setAllRoutines(data.allRoutines || []);
        setLoading(false);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  // Derived available courses
  const availableCourses = useMemo(() => {
    const set = new Set<string>(courses);
    allRoutines.forEach((r) => {
      if (r.course) set.add(r.course);
    });
    return Array.from(set).filter(Boolean);
  }, [courses, allRoutines]);

  // Routines under selected course
  const courseRoutines = useMemo(() => {
    if (!selectedCourse) return [];
    return allRoutines.filter((r) => r.course === selectedCourse);
  }, [allRoutines, selectedCourse]);

  // Global search matches
  const globalSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allRoutines.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.course?.toLowerCase().includes(q)
    );
  }, [allRoutines, searchQuery]);

  // Routines filtered by search within course
  const displayedCourseRoutines = useMemo(() => {
    if (!searchQuery.trim()) return courseRoutines;
    const q = searchQuery.toLowerCase().trim();
    return courseRoutines.filter(
      (r) =>
        r.title?.toLowerCase().includes(q) ||
        r.course?.toLowerCase().includes(q)
    );
  }, [courseRoutines, searchQuery]);

  const latestRoutine = displayedCourseRoutines.length > 0 ? displayedCourseRoutines[0] : null;
  const previousRoutines = displayedCourseRoutines.length > 1 ? displayedCourseRoutines.slice(1) : [];

  const handleSelectCourse = (course: string) => {
    setSelectedCourse(course);
    setSearchQuery("");
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setSearchQuery("");
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 font-bengali">
      {/* Main Container */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-5">

        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-500">রুটিনসমূহ লোড হচ্ছে...</p>
          </div>
        ) : searchQuery.trim() && !selectedCourse ? (
          /* SEARCH RESULTS VIEW (when user searches globally at course level) */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 pb-2 border-b border-slate-100">
              <span>
                &ldquo;{searchQuery}&rdquo; এর জন্য {toBengaliDigits(globalSearchResults.length)}টি রুটিন পাওয়া গেছে
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-indigo-600 hover:underline"
              >
                অনুসন্ধান মুছুন
              </button>
            </div>

            {globalSearchResults.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-700">কোনো রুটিন পাওয়া যায়নি</p>
                <p className="text-xs text-slate-400">ভিন্ন কি-ওয়ার্ড দিয়ে আবার অনুসন্ধান করুন।</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {globalSearchResults.map((routine, idx) => (
                  <div
                    key={routine.id || `${routine.course}_${idx}`}
                    onClick={() => window.open(optimizeDriveUrl(routine.driveLink), "_blank", "noopener,noreferrer")}
                    className="group p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 transition flex flex-col justify-between gap-3 cursor-pointer shadow-xs hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                        <Calendar className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-900 transition leading-snug">
                          {routine.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          {routine.course && (
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px]">
                              {routine.course}
                            </span>
                          )}
                          {routine.createdAt && (
                            <span className="text-[10px] text-slate-400">
                              {formatBangladeshDate(routine.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">গুগল ড্রাইভ ভিউয়ার</span>
                      <a
                        href={optimizeDriveUrl(routine.driveLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-xs shadow-emerald-600/20 active:scale-95 cursor-pointer shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> ড্রাইভ ওপেন করুন
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !selectedCourse ? (
          /* ======================================================== */
          /* LEVEL 1: COURSE SELECTION GRID                           */
          /* ======================================================== */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" /> কোর্স নির্বাচন করুন
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  যে কোর্সের রুটিন দেখতে চান সেটিতে ক্লিক করুন
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-bold text-slate-500 shrink-0">
                  মোট {toBengaliDigits(availableCourses.length)}টি কোর্স
                </span>

                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="রুটিনের নাম বা কোর্স খুঁজুন..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-white transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {availableCourses.map((course) => {
                const routinesInCourse = allRoutines.filter((r) => r.course === course);
                const count = routinesInCourse.length;
                const latest = routinesInCourse[0];

                return (
                  <div
                    key={course}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => handleSelectCourse(course)}
                      className="p-3.5 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 cursor-pointer select-none group"
                    >
                      <div className="min-w-0 flex-1 text-center flex flex-col items-center justify-center">
                        <h3 className="font-bold text-white text-base sm:text-lg leading-tight truncate group-hover:text-amber-300 transition-colors">
                          {course}
                        </h3>
                        <p className="text-xs text-slate-300 font-normal mt-1 truncate">
                          রুটিন সংখ্যা: {toBengaliDigits(count)}টি
                        </p>
                      </div>

                      {/* Right: Course Overall Stats Pill + Toggle Icon */}
                      <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                        <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-2xl flex-1 sm:flex-initial justify-around sm:justify-start">
                          <div className="text-left sm:text-right pr-2 border-r border-white/20">
                            <div className="text-[10px] text-slate-300 font-medium">রুটিন সংখ্যা</div>
                            <div className="text-xs sm:text-sm font-medium text-amber-300">
                              {toBengaliDigits(count)}টি
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] text-slate-300 font-medium">সর্বশেষ আপডেট</div>
                            <div className="text-xs sm:text-sm font-medium text-emerald-400">
                              {latest?.createdAt ? formatBangladeshDate(latest.createdAt) : "উপলব্ধ"}
                            </div>
                          </div>
                        </div>

                        {/* Chevron Indicator */}
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-white border border-white/15 transition shrink-0">
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* LEVEL 2: ROUTINES INSIDE THE SELECTED COURSE             */
          /* ======================================================== */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToCourses}
                  className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center justify-center"
                  title="কোর্স তালিকায় ফিরুন"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <span>{selectedCourse}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    মোট {toBengaliDigits(displayedCourseRoutines.length)}টি রুটিন উপলব্ধ
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBackToCourses}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200 transition"
              >
                অন্য কোর্স নির্বাচন করুন
              </button>
            </div>

            {displayedCourseRoutines.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-700">এই কোর্সে কোনো রুটিন পাওয়া যায়নি</p>
                <p className="text-xs text-slate-400">
                  {searchQuery
                    ? "অনুসন্ধানের সাথে মিলে এমন কোনো রুটিন নেই।"
                    : "শিক্ষক প্যানেল থেকে এই কোর্সে এখনো কোনো রুটিন ফাইল আপলোড করা হয়নি।"}
                </p>
                <button
                  type="button"
                  onClick={handleBackToCourses}
                  className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl border border-indigo-200 transition"
                >
                  অন্য কোর্স দেখুন
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Highlight: Latest / Current Routine */}
                {latestRoutine && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span className="flex items-center gap-1.5 text-indigo-700 uppercase tracking-wider font-black">
                        <Sparkles className="w-4 h-4 text-amber-500" /> সর্বশেষ ও চলমান রুটিন
                      </span>
                      <span>Google Drive</span>
                    </div>

                    <div
                      onClick={() => window.open(optimizeDriveUrl(latestRoutine.driveLink), "_blank", "noopener,noreferrer")}
                      className="group bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 text-amber-300 flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition">
                          <CalendarDays className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-0.5 rounded-md shadow-2xs">
                              চলমান রুটিন
                            </span>
                            {latestRoutine.createdAt && (
                              <span className="text-[11px] text-slate-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {formatBangladeshDate(latestRoutine.createdAt)}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors leading-snug">
                            {latestRoutine.title}
                          </h3>
                          <p className="text-xs text-slate-300">
                            ক্লিক করে গুগল ড্রাইভে সম্পূর্ণ শিডিউল ও সিলেবাস দেখুন
                          </p>
                        </div>
                      </div>

                      <a
                        href={optimizeDriveUrl(latestRoutine.driveLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow-sm active:scale-[0.98] cursor-pointer shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" /> রুটিন দেখুন
                      </a>
                    </div>
                  </div>
                )}

                {/* Previous Routines List */}
                {previousRoutines.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b border-slate-100 pb-2">
                      <span className="text-slate-700">
                        পূর্ববর্তী সকল রুটিনসমূহ ({toBengaliDigits(previousRoutines.length)})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {previousRoutines.map((routine, idx) => (
                        <div
                          key={routine.id || `${routine.course}_${idx}`}
                          onClick={() => window.open(optimizeDriveUrl(routine.driveLink), "_blank", "noopener,noreferrer")}
                          className="group p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-400 bg-white hover:bg-indigo-50/20 transition flex flex-col justify-between gap-3 cursor-pointer shadow-xs hover:shadow-sm active:scale-[0.99]"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                              <Calendar className="w-5 h-5" />
                            </span>
                            <div className="min-w-0 space-y-1">
                              <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-900 transition leading-snug">
                                {routine.title}
                              </h4>
                              {routine.createdAt && (
                                <span className="text-[10px] text-slate-400 block">
                                  {formatBangladeshDate(routine.createdAt)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">
                              ড্রাইভ শিডিউল ভিউয়ার
                            </span>
                            <a
                              href={optimizeDriveUrl(routine.driveLink)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-xs shadow-emerald-600/20 active:scale-[0.98] cursor-pointer shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> ড্রাইভ ওপেন করুন
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
