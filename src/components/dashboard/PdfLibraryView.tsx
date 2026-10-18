"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CoursePdfItem } from "@/types/pdf";
import { toBengaliDigits, formatBangladeshDate } from "@/lib/utils";
import {
  getCachedPdfRoutineData,
  fetchPdfsAndRoutines,
  subscribePdfRoutineStore,
  optimizeDriveUrl,
} from "@/lib/pdf-routine-store";
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
  Lock,
  LogIn,
  ShoppingCart,
} from "lucide-react";
import { getLocalStudentUser, loginWithGoogle } from "@/lib/student-auth";
import { getCachedEnrollment } from "@/lib/access-cache";

interface PdfLibraryViewProps {
  courses: string[];
  initialCourse?: string;
  onOpenEnrollModal?: () => void;
}

export function PdfLibraryView({ courses, initialCourse, onOpenEnrollModal }: PdfLibraryViewProps) {
  // Read cache immediately for 0ms initial render
  const initialLocalUser = typeof window !== "undefined" ? getLocalStudentUser() : null;
  const initialEnrollSnap = typeof window !== "undefined" && initialLocalUser
    ? getCachedEnrollment(initialLocalUser.uid, initialLocalUser.email)
    : null;
  const [user, setUser] = useState<{ uid: string; name: string; email?: string } | null>(initialLocalUser);
  const [enrolled, setEnrolled] = useState<boolean | null>(initialEnrollSnap ? initialEnrollSnap.allowed : null);
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>(initialEnrollSnap?.courses || []);

  const initialCache = getCachedPdfRoutineData();
  const [allPdfs, setAllPdfs] = useState<CoursePdfItem[]>(initialCache?.allPdfs || []);
  const [loading, setLoading] = useState(!initialCache || initialCache.allPdfs.length === 0);

  // Drilldown navigation state:
  // Level 1: Course list (selectedCourse = null)
  // Level 2: Subject list inside course (selectedCourse = string, selectedSubject = null)
  // Level 3: PDF files inside subject (selectedCourse = string, selectedSubject = string)
  const [selectedCourse, setSelectedCourse] = useState<string | null>(initialCourse || null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const u = getLocalStudentUser();
    setUser(u);
    if (!u) {
      setEnrolled(false);
      return;
    }

    (async () => {
      try {
        const { checkEnrollmentCached } = await import("@/lib/access-cache");
        let allowed = false;
        let cList: string[] = [];
        const g = await checkEnrollmentCached(u.uid, u.email);
        if (g.allowed) {
          allowed = true;
          cList = g.courses || [];
        } else {
          const { getVerifiedStudent } = await import("@/lib/student-identity");
          const verified = getVerifiedStudent();
          if (verified && verified.id && verified.id !== u.uid) {
            const alt = await checkEnrollmentCached(verified.id, verified.email);
            if (alt.allowed) {
              allowed = true;
              cList = alt.courses || [];
            }
          }
        }
        setEnrolled(allowed);
        setEnrolledCourses(cList);
      } catch {
        setEnrolled(false);
      }
    })();
  }, []);

  useEffect(() => {
    let alive = true;
    const cached = getCachedPdfRoutineData();
    if (!cached || cached.allPdfs.length === 0) {
      setLoading(true);
    }

    // Fetch fresh data in background
    fetchPdfsAndRoutines()
      .then((res) => {
        if (alive) {
          setAllPdfs(res.allPdfs || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load PDFs:", err);
        if (alive) setLoading(false);
      });

    // Subscribe to background store updates
    const unsubscribe = subscribePdfRoutineStore((data) => {
      if (alive) {
        setAllPdfs(data.allPdfs || []);
        setLoading(false);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
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

  const isCourseEnrolled = (courseName?: string | null) => {
    if (!enrolled) return false;
    if (!courseName) return enrolled === true;
    if (!enrolledCourses || enrolledCourses.length === 0) return true;
    const norm = (s: string) => s.trim().toLowerCase();
    return enrolledCourses.some((c) => norm(c) === norm(courseName));
  };

  const handleOpenPdf = (pdf: CoursePdfItem) => {
    if (!user) {
      loginWithGoogle();
      return;
    }
    if (!enrolled || (pdf.course && !isCourseEnrolled(pdf.course))) {
      if (onOpenEnrollModal) onOpenEnrollModal();
      return;
    }
    window.open(optimizeDriveUrl(pdf.driveLink), "_blank", "noopener,noreferrer");
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
        {!user ? (
          /* লগইন না থাকলে */
          <div className="bg-gradient-to-br from-slate-50 to-amber-50 border border-amber-200 rounded-3xl p-8 sm:p-12 flex flex-col items-center text-center gap-4 max-w-xl mx-auto my-6 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-black text-slate-900">পিডিএফ পড়তে লগইন প্রয়োজন</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md">
                আমাদের সকল প্রিমিয়াম লেকচার শিট, হ্যান্ডনোট ও প্রশ্নব্যাংক পিডিএফ শুধুমাত্র এনরোল্ড শিক্ষার্থীদের জন্য সংরক্ষিত। অ্যাক্সেস করতে আপনার গুগল অ্যাকাউন্ট দিয়ে লগইন করুন।
              </p>
            </div>
            <button
              type="button"
              onClick={() => loginWithGoogle()}
              className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-3 rounded-xl text-xs sm:text-sm transition shadow-md active:scale-95 cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Google দিয়ে লগইন করুন
            </button>
          </div>
        ) : enrolled === null ? (
          /* এনরোলমেন্ট চেক হচ্ছে */
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-500">এনরোলমেন্ট যাচাই করা হচ্ছে...</p>
          </div>
        ) : enrolled === false ? (
          /* কোনো কোর্সে এনরোল না থাকলে */
          <div className="bg-gradient-to-br from-slate-50 to-amber-50 border border-amber-200 rounded-3xl p-8 sm:p-12 flex flex-col items-center text-center gap-4 max-w-xl mx-auto my-6 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
              <ShoppingCart className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-black text-slate-900">কোর্সে এনরোল প্রয়োজন</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md">
                আপনি এখনো কোনো সক্রিয় কোর্সে এনরোল করেননি অথবা আপনার এনরোলমেন্ট অনুমোদনের অপেক্ষায় আছে। পিডিএফ পড়তে যেকোনো একটি কোর্সে এনরোল করুন।
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenEnrollModal && onOpenEnrollModal()}
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs sm:text-sm transition shadow-md active:scale-95 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" /> কোর্স এনরোল করুন
            </button>
          </div>
        ) : loading ? (
          /* ডেটা লোডিং */
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-500">পিডিএফ লাইব্রেরি লোড হচ্ছে...</p>
          </div>
        ) : searchQuery.trim() && !selectedSubject ? (
          /* SEARCH RESULTS VIEW (when user searches from Course/Subject level) */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 pb-2 border-b border-slate-100">
              <span>
                &ldquo;{searchQuery}&rdquo; এর জন্য {toBengaliDigits(searchResults.length)}টি ফলাফল
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-indigo-600 hover:text-indigo-700 hover:underline font-semibold"
              >
                মুছুন
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-700">কোনো ফাইল পাওয়া যায়নি</p>
                <p className="text-xs text-slate-400">ভিন্ন কি-ওয়ার্ড দিয়ে আবার অনুসন্ধান করুন।</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((pdf, idx) => {
                  const courseAllowed = isCourseEnrolled(pdf.course);
                  return (
                    <div
                      key={pdf.id || `${pdf.examId}_${idx}`}
                      onClick={() => handleOpenPdf(pdf)}
                      className="group bg-white hover:bg-indigo-50/30 rounded-xl p-3 sm:p-3.5 border border-slate-200 hover:border-indigo-300 transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                          <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                        </span>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition leading-snug truncate">
                            {pdf.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                            {pdf.course && (
                              <span className="font-semibold text-indigo-700">
                                {pdf.course}
                              </span>
                            )}
                            {pdf.subject && (
                              <span>• {pdf.subject}</span>
                            )}
                            {pdf.createdAt && (
                              <span>• {formatBangladeshDate(pdf.createdAt)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {courseAllowed ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPdf(pdf);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 sm:px-3.5 py-1.5 rounded-xl text-xs transition shadow-xs shadow-emerald-600/20 active:scale-95 cursor-pointer shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>ড্রাইভ ওপেন করুন</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPdf(pdf);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 sm:px-3.5 py-1.5 rounded-xl text-xs transition shadow-xs active:scale-95 cursor-pointer shrink-0"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>এনরোল করুন</span>
                        </button>
                      )}
                    </div>
                  );
                })}
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
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" /> কোর্স নির্বাচন করুন
                </h3>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <span className="text-xs font-bold text-slate-500 shrink-0">
                  মোট {toBengaliDigits(availableCourses.length)}টি কোর্স
                </span>

                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="পিডিএফ খুঁজুন..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition"
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
                const count = allPdfs.filter((p) => p.course === course).length;
                const subjectsCount = new Set(
                  allPdfs.filter((p) => p.course === course).map((p) => p.subject || "সাধারণ")
                ).size;
                const courseAllowed = isCourseEnrolled(course);

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
                        <div className="flex items-center gap-2 justify-center">
                          <h3 className="font-bold text-white text-base sm:text-lg leading-tight truncate group-hover:text-amber-300 transition-colors">
                            {course}
                          </h3>
                          {!courseAllowed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded shrink-0">
                              <Lock className="w-3 h-3 text-amber-400" /> লকড
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 font-normal mt-1 truncate">
                          পিডিএফ শিট: {toBengaliDigits(count)}টি {count > 0 && `• ${toBengaliDigits(subjectsCount)}টি বিষয়`}
                        </p>
                      </div>

                      {/* Right: Course Overall Stats Pill + Toggle Icon */}
                      <div className="flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                        <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm border border-white/15 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-2xl flex-1 sm:flex-initial justify-around sm:justify-start">
                          <div className="text-left sm:text-right pr-2 border-r border-white/20">
                            <div className="text-[10px] text-slate-300 font-medium">পিডিএফ সংখ্যা</div>
                            <div className="text-xs sm:text-sm font-medium text-amber-300">
                              {toBengaliDigits(count)}টি
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] text-slate-300 font-medium">বিষয় সংখ্যা</div>
                            <div className="text-xs sm:text-sm font-medium text-emerald-400">
                              {toBengaliDigits(subjectsCount)}টি
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
        ) : !selectedSubject ? (
          /* ======================================================== */
          /* LEVEL 2: SUBJECT SELECTION LIST VIEW (INSIDE COURSE)     */
          /* ======================================================== */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={handleBackToCourses}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
                  title="কোর্স তালিকায় ফিরুন"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
                    <FolderOpen className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span className="truncate">{selectedCourse}</span>
                  </h3>
                </div>
              </div>

              {isCourseEnrolled(selectedCourse) && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectSubject("ALL")}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                  >
                    সব বিষয় একসাথে ({toBengaliDigits(coursePdfs.length)})
                  </button>
                </div>
              )}
            </div>

            {!isCourseEnrolled(selectedCourse) ? (
              /* এই কোর্সে এনরোল করা না থাকলে লকড মেসেজ */
              <div className="bg-gradient-to-br from-slate-50 to-amber-50 border border-amber-200 rounded-3xl p-6 sm:p-10 flex flex-col items-center text-center gap-4 my-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-lg font-black text-slate-900">{selectedCourse} এর পিডিএফ শিট লক করা</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    আপনি এই কোর্সে এনরোল করেননি। এই কোর্সের সকল প্রিমিয়াম লেকচার শিট, হ্যান্ডনোট ও প্রশ্নপত্রের গুগল ড্রাইভ লিংক দেখতে অনুগ্রহ করে কোর্সটিতে এনরোল করুন।
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBackToCourses}
                    className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    অন্য কোর্স বেছে নিন
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEnrollModal && onOpenEnrollModal()}
                    className="text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <ShoppingCart className="w-4 h-4" /> কোর্স এনরোল করুন
                  </button>
                </div>
              </div>
            ) : coursePdfs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-700">এই কোর্সে কোনো পিডিএফ নেই</p>
                <button
                  type="button"
                  onClick={handleBackToCourses}
                  className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl border border-indigo-200 transition"
                >
                  অন্য কোর্স নির্বাচন করুন
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {courseSubjects.map(({ name, count }) => (
                  <div
                    key={name}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm overflow-hidden transition-all"
                  >
                    <div
                      onClick={() => handleSelectSubject(name)}
                      className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between gap-3 cursor-pointer select-none group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/10 border border-white/15 text-amber-300 flex items-center justify-center font-bold text-base shadow-2xs group-hover:bg-amber-400 group-hover:text-slate-950 transition shrink-0">
                          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors leading-snug truncate">
                            {name}
                          </h4>
                          <span className="text-xs text-slate-300 font-medium">
                            {toBengaliDigits(count)}টি লেকচার শিট ও ফাইল
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="w-8 h-8 rounded-xl bg-white/10 group-hover:bg-white/20 text-slate-300 group-hover:text-amber-400 flex items-center justify-center border border-white/15 transition">
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ======================================================== */
          /* LEVEL 3: PDF FILES LIST VIEW (INSIDE SELECTED SUBJECT)   */
          /* ======================================================== */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={handleBackToSubjects}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer flex items-center justify-center shrink-0"
                  title="বিষয় তালিকায় ফিরুন"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 truncate">
                    <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                    <span className="truncate">{selectedSubject === "ALL" ? "সকল বিষয়" : selectedSubject}</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    মোট {toBengaliDigits(displayedSubjectPdfs.length)}টি ফাইল
                  </span>
                </div>
              </div>

              {/* Subject quick switcher tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedSubject("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
                    selectedSubject === "ALL"
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  সব ({toBengaliDigits(coursePdfs.length)})
                </button>
                {courseSubjects.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    onClick={() => setSelectedSubject(s.name)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border ${
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

            {!isCourseEnrolled(selectedCourse) ? (
              <div className="bg-gradient-to-br from-slate-50 to-amber-50 border border-amber-200 rounded-3xl p-6 sm:p-10 flex flex-col items-center text-center gap-4 my-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-lg font-black text-slate-900">{selectedCourse} এর পিডিএফ শিট লক করা</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    আপনি এই কোর্সে এনরোল করেননি। এই কোর্সের সকল প্রিমিয়াম লেকচার শিট, হ্যান্ডনোট ও প্রশ্নপত্রের গুগল ড্রাইভ লিংক দেখতে অনুগ্রহ করে কোর্সটিতে এনরোল করুন।
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBackToCourses}
                    className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    অন্য কোর্স বেছে নিন
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenEnrollModal && onOpenEnrollModal()}
                    className="text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <ShoppingCart className="w-4 h-4" /> কোর্স এনরোল করুন
                  </button>
                </div>
              </div>
            ) : displayedSubjectPdfs.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                <p className="text-sm font-bold text-slate-700">কোনো ফাইল পাওয়া যায়নি</p>
                <button
                  type="button"
                  onClick={handleBackToSubjects}
                  className="mt-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl border border-indigo-200 transition"
                >
                  অন্য বিষয় বেছে নিন
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {displayedSubjectPdfs.map((pdf, idx) => (
                  <div
                    key={pdf.id || `${pdf.examId}_${idx}`}
                    onClick={() => handleOpenPdf(pdf)}
                    className="group bg-white hover:bg-indigo-50/30 rounded-xl p-3 sm:p-3.5 border border-slate-200 hover:border-indigo-300 transition-all duration-150 flex items-center justify-between gap-3 cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition leading-snug truncate">
                          {pdf.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          {pdf.subject && selectedSubject === "ALL" && (
                            <span className="font-medium text-slate-600">
                              {pdf.subject}
                            </span>
                          )}
                          {pdf.createdAt && (
                            <span>
                              {selectedSubject === "ALL" && pdf.subject ? "• " : ""}
                              {formatBangladeshDate(pdf.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenPdf(pdf);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition shadow-xs shadow-emerald-600/20 active:scale-95 cursor-pointer shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>ড্রাইভ ওপেন করুন</span>
                    </button>
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
