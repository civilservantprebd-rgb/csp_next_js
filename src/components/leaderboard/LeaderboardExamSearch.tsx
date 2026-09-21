"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Search, X, Trophy, ChevronDown, BookOpen } from "lucide-react";
import { Exam } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";
import { parseBangladeshDateTime, getTrueDate } from "@/lib/bangladesh-time";

interface LeaderboardExamSearchProps {
  exams: Record<string, Exam>;
  activeExamKey: string;
  onSelect: (examKey: string) => void;
}

function examStatus(ex: Exam): { label: string; cls: string } {
  const now = getTrueDate().getTime();
  const start = ex.startTime ? parseBangladeshDateTime(ex.startTime) : null;
  const end = ex.endTime
    ? parseBangladeshDateTime(ex.endTime)
    : ex.leaderboardEndTime
      ? parseBangladeshDateTime(ex.leaderboardEndTime)
      : null;
  if (!start) return { label: "অনুশীলন", cls: "bg-indigo-100 text-indigo-800 border-indigo-200" };
  if (now < start.getTime()) return { label: "আসন্ন", cls: "bg-sky-100 text-sky-800 border-sky-200" };
  if (end && now > end.getTime()) return { label: "সমাপ্ত", cls: "bg-slate-200 text-slate-700 border-slate-300" };
  return { label: "Live", cls: "bg-rose-100 text-rose-800 border-rose-300" };
}

function courseOf(ex: Exam): string {
  return String(ex.course || "").trim();
}

/**
 * Search bar + dropdown to pick any exam and view its leaderboard.
 *
 * দুটি ধাপে খোঁজা যায় (আগে ছিল শুধু এক টেক্সট বাক্স):
 *   ১. **কোর্স** — উপরের চিপ থেকে একটি কোর্স বেছে নিন (বা "সব কোর্স")
 *   ২. **পরীক্ষার নাম** — নির্বাচিত কোর্সের ভেতরে নাম/বিষয় দিয়ে খুঁজুন
 * ফলে "কোন কোর্সের কোন পরীক্ষার র্যাংক" খুব দ্রুত বের করা যায়, আর একই নামের
 * পরীক্ষা একাধিক কোর্সে থাকলেও গুলিয়ে যায় না।
 */
export const LeaderboardExamSearch: React.FC<LeaderboardExamSearchProps> = ({
  exams,
  activeExamKey,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState<string>(""); // "" = সব কোর্স
  const [isOpen, setIsOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const courseRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeExam = exams[activeExamKey];

  // কোর্সের তালিকা + প্রতিটিতে কতটি পরীক্ষা (বাংলা বর্ণানুক্রমে)
  const courseList = useMemo(() => {
    const counts = new Map<string, number>();
    const now = getTrueDate().getTime();
    Object.values(exams).forEach((ex) => {
      const endStr = ex.endTime || ex.leaderboardEndTime;
      if (endStr) {
        const end = parseBangladeshDateTime(endStr);
        if (end && now <= end.getTime()) {
          return; // Skip future exams
        }
      }
      const c = courseOf(ex);
      if (!c) return;
      counts.set(c, (counts.get(c) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "bn"));
  }, [exams]);

  const totalExams = Object.keys(exams).length;

  // Active exam-এর কোর্স জানা থাকলে dropdown-এ সেটি হাইলাইট করি
  const activeCourse = activeExam ? courseOf(activeExam) : "";

  // Close the dropdowns when clicking anywhere outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
      if (courseRef.current && !courseRef.current.contains(e.target as Node)) {
        setCourseOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const matchesQuery = (key: string, ex: Exam, q: string): boolean => {
    if (!q) return true;
    return (
      (ex.title || "").toLowerCase().includes(q) ||
      (ex.subject || "").toLowerCase().includes(q) ||
      courseOf(ex).toLowerCase().includes(q) ||
      key.toLowerCase().includes(q)
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    
    // Helper to get a timestamp for sorting (newest first)
    const getExamTime = (ex: Exam) => {
      const t = ex.startTime || ex.endTime || ex.leaderboardEndTime;
      if (!t) return 0;
      const parsed = parseBangladeshDateTime(t);
      return parsed ? parsed.getTime() : 0;
    };

    const list = Object.entries(exams)
      .filter(([, ex]) => {
        // "leaderboard e sei xm gula rakho jadr live exm deyar time sesh. future exm gula leaderboard e rekho na"
        const now = getTrueDate().getTime();
        const endStr = ex.endTime || ex.leaderboardEndTime;
        if (!endStr) return true; // Practice exams have no end time
        const end = parseBangladeshDateTime(endStr);
        // If it's a scheduled exam and its end time hasn't passed, hide it
        if (end && now <= end.getTime()) {
          return false;
        }
        return true;
      })
      .filter(([, ex]) => !course || courseOf(ex) === course)
      .filter(([k, ex]) => matchesQuery(k, ex, q))
      .sort((a, b) => {
        // Sort by date descending (newest first)
        const timeA = getExamTime(a[1]);
        const timeB = getExamTime(b[1]);
        if (timeA !== timeB) return timeB - timeA;
        // Fallback to title
        return (a[1].title || "").localeCompare(b[1].title || "", "bn");
      });
      
    // Remove the slice(0, 8) to show all matching exams
    return list;
  }, [exams, query, course]);

  const totalMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(exams).filter(
      ([k, ex]) => (!course || courseOf(ex) === course) && matchesQuery(k, ex, q)
    ).length;
  }, [exams, query, course]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (filtered.length > 0) {
        onSelect(filtered[0][0]);
        setIsOpen(false);
        inputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const pickExam = (key: string) => {
    onSelect(key);
    setIsOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div className="font-bengali space-y-2">
      {/* ── ধাপ ১: কোর্স নির্বাচন ─────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div ref={courseRef} className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setCourseOpen((v) => !v)}
            className="w-full flex items-center gap-2 pl-3.5 pr-3 py-3 rounded-2xl border border-slate-300 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition cursor-pointer"
            aria-haspopup="listbox"
            aria-expanded={courseOpen}
          >
            <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 min-w-0 text-left text-xs sm:text-sm font-semibold truncate">
              <span className="text-slate-400">কোর্স: </span>
              <span className={course ? "text-slate-900" : "text-slate-700"}>
                {course || "সব কোর্স"}
              </span>
              {course && (
                <span className="text-slate-400 font-normal">
                  {" "}
                  ({toBengaliDigits(courseList.find(([c]) => c === course)?.[1] || 0)}টি)
                </span>
              )}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${courseOpen ? "rotate-180" : ""}`}
            />
          </button>

          {courseOpen && (
            <div
              className="absolute z-40 mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
              role="listbox"
            >
              <div className="max-h-72 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCourse("");
                    setCourseOpen(false);
                    inputRef.current?.focus();
                  }}
                  className={`w-full text-left px-4 py-2.5 border-b border-slate-100 last:border-b-0 transition cursor-pointer ${
                    !course ? "bg-indigo-50/70" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="block font-bold text-slate-900 text-xs sm:text-sm">
                    সব কোর্স
                  </span>
                  <span className="block text-xs text-slate-500 font-semibold">
                    {toBengaliDigits(totalExams)}টি পরীক্ষা
                  </span>
                </button>
                {courseList.map(([c, n]) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCourse(c);
                      setCourseOpen(false);
                      setIsOpen(true);
                      inputRef.current?.focus();
                    }}
                    className={`w-full text-left px-4 py-2.5 border-b border-slate-100 last:border-b-0 transition cursor-pointer ${
                      course === c ? "bg-indigo-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="block font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {c}
                      {activeCourse === c && (
                        <span className="ml-2 text-xs font-black text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-md align-middle">
                          বর্তমান
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500 font-semibold">
                      {toBengaliDigits(n)}টি পরীক্ষা
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* দ্রুত ফিল্টার-মুছে ফেলার জন্য */}
        {course && (
          <button
            type="button"
            onClick={() => setCourse("")}
            className="shrink-0 px-3 py-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition cursor-pointer"
          >
            সব কোর্স
          </button>
        )}
      </div>

      {/* ── ধাপ ২: পরীক্ষার নাম দিয়ে খোঁজা (নির্বাচিত কোর্সের ভেতরে) ── */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={
              course
                ? `"${course}"-এর মধ্যে পরীক্ষা খুঁজুন...`
                : activeExam
                  ? `খুঁজুন: ${activeExam.title}`
                  : "পরীক্ষা খুঁজুন (নাম / বিষয়)..."
            }
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-9 py-3 rounded-2xl border border-slate-300 text-xs sm:text-sm bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer"
              aria-label="মুছুন"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-40 mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="max-h-80 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-400 font-semibold">
                  {course ? `"${course}"-এ ` : ""}
                  &ldquo;{(query || "").trim()}&rdquo; — কোনো পরীক্ষা পাওয়া যায়নি
                </div>
              ) : (
                filtered.map(([k, ex]) => {
                  const status = examStatus(ex);
                  const isActive = k === activeExamKey;
                  return (
                    <button
                      key={k}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickExam(k);
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 border-b border-slate-100 last:border-b-0 transition cursor-pointer ${
                        isActive ? "bg-indigo-50/70" : "hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                          isActive
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}
                      >
                        <Trophy className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {ex.title}
                          {isActive && (
                            <span className="ml-2 text-xs font-black text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded-md align-middle">
                              বর্তমান
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold mt-0.5 flex-wrap">
                          <span className="truncate max-w-[45%]">{courseOf(ex) || "—"}</span>
                          <span>·</span>
                          <span className="truncate max-w-[30%]">{ex.subject || "সাধারণ"}</span>
                          <span className={`text-xs font-black px-1.5 py-0.5 rounded-md border ${status.cls}`}>
                            {status.label}
                          </span>
                          {ex.isFree && (
                            <span className="text-xs font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              ফ্রি
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 font-semibold flex items-center justify-between">
              <span>
                {toBengaliDigits(totalMatches)}টি পরীক্ষা
                {course ? ` — ${course}` : ""}
                {totalMatches > filtered.length && " — আরও ফলাফলের জন্য টাইপ করুন"}
              </span>
              <span className="hidden sm:inline">Enter ↵ দিয়ে প্রথমটি নির্বাচন করুন</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
