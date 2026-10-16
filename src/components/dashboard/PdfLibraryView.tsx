"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CoursePdfItem } from "@/types/pdf";
import { getAllPdfsAndRoutines } from "@/actions/pdf-actions";
import { toBengaliDigits, formatBangladeshDate } from "@/lib/utils";
import {
  FileText,
  Search,
  ExternalLink,
  BookOpen,
  FolderOpen,
  Loader2,
  X,
  ChevronRight,
  ArrowLeft,
  Folder,
  Layers,
  Sparkles
} from "lucide-react";

interface PdfLibraryViewProps {
  courses: string[];
  initialCourse?: string;
}

export function PdfLibraryView({ courses, initialCourse }: PdfLibraryViewProps) {
  const [allPdfs, setAllPdfs] = useState<CoursePdfItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Drilldown navigation state:
  // Level 1: Course list (selectedCourse = null)
  // Level 2: Subject list inside course (selectedCourse = string, selectedSubject = null)
  // Level 3: PDF files inside subject (selectedCourse = string, selectedSubject = string)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(initialCourse || null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAllPdfsAndRoutines()
      .then((res) => {
        if (alive) {
          setAllPdfs(res.allPdfs || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load PDFs:", err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // List of all unique courses from config + database
  const availableCourses = useMemo(() => {
    const set = new Set<string>(courses);
    allPdfs.forEach((p) => {
      if (p.course) set.add(p.course);
    });
    return Array.from(set).filter(Boolean);
  }, [courses, allPdfs]);

  // PDFs for currently selected course
  const coursePdfs = useMemo(() => {
    if (!selectedCourse) return [];
    return allPdfs.filter((p) => p.course === selectedCourse);
  }, [allPdfs, selectedCourse]);

  // Unique subjects for the selected course
  const courseSubjects = useMemo(() => {
    if (!selectedCourse) return [];
    const map = new Map<string, number>();
    coursePdfs.forEach((p) => {
      const s = String(p.subject || "সাধারণ").trim() || "সাধারণ";
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [coursePdfs, selectedCourse]);

  // PDFs for currently selected subject
  const subjectPdfs = useMemo(() => {
    if (!selectedCourse) return [];
    if (!selectedSubject || selectedSubject === "ALL") return coursePdfs;
    return coursePdfs.filter((p) => (p.subject || "সাধারণ") === selectedSubject);
  }, [coursePdfs, selectedCourse, selectedSubject]);

  // Search filtered results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allPdfs.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.subject?.toLowerCase().includes(q) ||
        p.course?.toLowerCase().includes(q)
    );
  }, [allPdfs, searchQuery]);

  // Filtered PDFs when in subject view with search
  const displayedSubjectPdfs = useMemo(() => {
    if (!searchQuery.trim()) return subjectPdfs;
    const q = searchQuery.toLowerCase().trim();
    return subjectPdfs.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.subject?.toLowerCase().includes(q)
    );
  }, [subjectPdfs, searchQuery]);

  // Navigation handlers
  const handleSelectCourse = (course: string) => {
    setSelectedCourse(course);
    setSelectedSubject(null);
    setSearchQuery("");
  };

  const handleSelectSubject = (subject: string) => {
    setSelectedSubject(subject);
    setSearchQuery("");
  };

  const handleBackToCourses = () => {
    setSelectedCourse(null);
    setSelectedSubject(null);
    setSearchQuery("");
  };

  const handleBackToSubjects = () => {
    setSelectedSubject(null);
    setSearchQuery("");
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 font-bengali">
      {/* Main Content Area */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-5">


        {/* Loading Spinner */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-amber-600" />
            <p className="text-xs font-bold text-slate-500">পিডিএফ লাইব্রেরি লোড হচ্ছে...</p>
          </div>
        ) : searchQuery.trim() && !selectedSubject ? (
          /* SEARCH RESULTS VIEW (when user searches from Course/Subject level) */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 pb-2 border-b border-slate-100">
              <span>
                &ldquo;{searchQuery}&rdquo; এর জন্য {toBengaliDigits(searchResults.length)}টি ফলাফল পাওয়া গেছে
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-amber-700 hover:underline"
              >
                অনুসন্ধান মুছুন
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-700">কোনো ফাইল পাওয়া যায়নি</p>
                <p className="text-xs text-slate-400">ভিন্ন কি-ওয়ার্ড দিয়ে আবার অনুসন্ধান করুন।</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((pdf, idx) => (
                  <div
                    key={pdf.id || `${pdf.examId}_${idx}`}
                    onClick={() => window.open(pdf.driveLink, "_blank", "noopener,noreferrer")}
                    className="group p-3.5 rounded-2xl border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50/20 transition flex flex-col justify-between gap-3 cursor-pointer shadow-xs hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-900 transition leading-snug">
                          {pdf.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          {pdf.course && (
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px]">
                              {pdf.course}
                            </span>
                          )}
                          {pdf.subject && (
                            <span className="inline-flex items-center gap-1 font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px]">
                              {pdf.subject}
                            </span>
                          )}
                          {pdf.createdAt && (
                            <span className="text-[10px] text-slate-400">
                              {formatBangladeshDate(pdf.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">গুগল ড্রাইভ ভিউয়ার</span>
                      <a
                        href={pdf.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs transition shadow-2xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> ওপেন করুন
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
                  <BookOpen className="w-4 h-4 text-amber-600" /> কোর্স নির্বাচন করুন
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  যে কোর্সের পিডিএফ ফাইল দেখতে চান সেটিতে ক্লিক করুন
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
                    placeholder="পিডিএফ বা কোর্স খুঁজুন..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white transition"
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

            <div className="space-y-2.5">
              {availableCourses.map((course) => {
                const count = allPdfs.filter((p) => p.course === course).length;
                const subjectsCount = new Set(
                  allPdfs.filter((p) => p.course === course).map((p) => p.subject || "সাধারণ")
                ).size;

                return (
                  <div
                    key={course}
                    onClick={() => handleSelectCourse(course)}
                    className="group bg-white hover:bg-amber-50/40 rounded-2xl p-4 sm:p-5 border border-slate-200/90 hover:border-amber-400 shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-between gap-3.5 sm:gap-5 active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center font-black text-sm sm:text-base group-hover:scale-105 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shrink-0 shadow-2xs">
                        <Folder className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-black text-sm sm:text-base text-slate-900 group-hover:text-amber-900 transition leading-snug truncate">
                          {course}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/70 border border-amber-200/70 px-2 py-0.5 rounded-md">
                            <FileText className="w-3 h-3 text-amber-700" />
                            {toBengaliDigits(count)}টি পিডিএফ
                          </span>
                          {count > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-md">
                              <Layers className="w-3 h-3 text-indigo-600" />
                              {toBengaliDigits(subjectsCount)}টি বিষয়
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="hidden sm:inline-block text-xs font-bold text-slate-500 group-hover:text-amber-800 transition">
                        বিষয় ও ফাইল দেখুন
                      </span>
                      <span className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-600 flex items-center justify-center transition shadow-2xs">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !selectedSubject ? (
          /* ======================================================== */
          /* LEVEL 2: SUBJECT SELECTION GRID (INSIDE SELECTED COURSE) */
          /* ======================================================== */
          <div className="space-y-4">
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
                    <FolderOpen className="w-5 h-5 text-indigo-600" />
                    <span>{selectedCourse}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    কাঙ্ক্ষিত বিষয়টি বেছে নিয়ে লেকচার শিট ও নোট দেখুন
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectSubject("ALL")}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                >
                  সব বিষয় একসাথে ({toBengaliDigits(coursePdfs.length)})
                </button>
              </div>
            </div>

            {coursePdfs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-700">এই কোর্সে এখনো কোনো পিডিএফ যুক্ত করা হয়নি</p>
                <p className="text-xs text-slate-400">
                  শিক্ষক প্যানেল থেকে ফাইল যুক্ত করা হলে এখানে প্রদর্শিত হবে।
                </p>
                <button
                  type="button"
                  onClick={handleBackToCourses}
                  className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl border border-indigo-200 transition"
                >
                  অন্য কোর্স নির্বাচন করুন
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {courseSubjects.map(({ name, count }) => (
                  <div
                    key={name}
                    onClick={() => handleSelectSubject(name)}
                    className="group bg-gradient-to-br from-slate-50 to-white hover:from-indigo-50/50 hover:to-purple-50/30 rounded-3xl p-5 border border-slate-200 hover:border-indigo-400 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between gap-4 active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-base shadow-2xs group-hover:scale-105 transition shrink-0">
                        <BookOpen className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-black text-sm sm:text-base text-slate-900 group-hover:text-indigo-900 transition leading-snug">
                          {name}
                        </h4>
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                          <FileText className="w-3 h-3 text-indigo-600" />
                          {toBengaliDigits(count)}টি পিডিএফ ফাইল
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700 group-hover:text-indigo-800">
                      <span>ফাইলগুলো দেখুন</span>
                      <span className="w-7 h-7 rounded-full bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white text-indigo-700 flex items-center justify-center transition">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* LEVEL 3: PDF FILES LIST (INSIDE SELECTED SUBJECT)        */
          /* ======================================================== */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToSubjects}
                  className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center justify-center"
                  title="বিষয় তালিকায় ফিরুন"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-amber-600" />
                    <span>{selectedSubject === "ALL" ? "সকল বিষয়" : selectedSubject}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedCourse} · মোট {toBengaliDigits(displayedSubjectPdfs.length)}টি ফাইল
                  </p>
                </div>
              </div>

              {/* Subject quick switcher tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedSubject("ALL")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
                    selectedSubject === "ALL"
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  সব বিষয় ({toBengaliDigits(coursePdfs.length)})
                </button>
                {courseSubjects.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSelectedSubject(s.name)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
                      selectedSubject === s.name
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {s.name} ({toBengaliDigits(s.count)})
                  </button>
                ))}
              </div>
            </div>

            {displayedSubjectPdfs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-700">কোনো পিডিএফ ফাইল পাওয়া যায়নি</p>
                <p className="text-xs text-slate-400">
                  {searchQuery
                    ? "অনুসন্ধানের সাথে মিলছে এমন ফাইল নেই।"
                    : "এই বিষয়ে এখনো কোনো ফাইল আপলোড করা হয়নি।"}
                </p>
                <button
                  type="button"
                  onClick={handleBackToSubjects}
                  className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl border border-indigo-200 transition"
                >
                  অন্য বিষয় বেছে নিন
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {displayedSubjectPdfs.map((pdf, idx) => (
                  <div
                    key={pdf.id || `${pdf.examId}_${idx}`}
                    onClick={() => window.open(pdf.driveLink, "_blank", "noopener,noreferrer")}
                    className="group p-4 rounded-2xl border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50/20 transition flex flex-col justify-between gap-3 cursor-pointer shadow-xs hover:shadow-sm active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-amber-900 transition leading-snug">
                          {pdf.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          {pdf.subject && (
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px]">
                              {pdf.subject}
                            </span>
                          )}
                          {pdf.createdAt && (
                            <span className="text-[10px] text-slate-400">
                              {formatBangladeshDate(pdf.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold">
                        PDF ফাইল · গুগল ড্রাইভ ভিউয়ার
                      </span>
                      <a
                        href={pdf.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3.5 py-1.5 rounded-xl text-xs transition shadow-2xs active:scale-[0.98] cursor-pointer shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> ওপেন করুন
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
