"use client";
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Search, X, Trophy } from "lucide-react";
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

/**
 * Search bar + dropdown to pick any exam (by name / course / subject) and view
 * its leaderboard — "কোন কোর্সের কোন পরীক্ষার র্যাংক" এক ক্লিকেই।
 */
export const LeaderboardExamSearch: React.FC<LeaderboardExamSearchProps> = ({
  exams,
  activeExamKey,
  onSelect,
}) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeExam = exams[activeExamKey];

  // Close the dropdown when clicking anywhere outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Object.entries(exams).sort((a, b) =>
      (a[1].title || "").localeCompare(b[1].title || "", "bn")
    );
    if (!q) return list.slice(0, 8);
    return list
      .filter(
        ([k, ex]) =>
          (ex.title || "").toLowerCase().includes(q) ||
          (ex.course || "").toLowerCase().includes(q) ||
          (ex.subject || "").toLowerCase().includes(q) ||
          k.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [exams, query]);

  const totalMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return Object.keys(exams).length;
    return Object.entries(exams).filter(
      ([k, ex]) =>
        (ex.title || "").toLowerCase().includes(q) ||
        (ex.course || "").toLowerCase().includes(q) ||
        (ex.subject || "").toLowerCase().includes(q) ||
        k.toLowerCase().includes(q)
    ).length;
  }, [exams, query]);

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

  return (
    <div ref={containerRef} className="relative font-bengali">
      {/* Search input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={
            activeExam ? `খুঁজুন: ${activeExam.title}` : "পরীক্ষা খুঁজুন (নাম / কোর্স / বিষয়)..."
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
                      onSelect(k);
                      setIsOpen(false);
                      setQuery("");
                      inputRef.current?.blur();
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
                        <span className="truncate max-w-[45%]">{ex.course}</span>
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
              {totalMatches > filtered.length && " — আরও ফলাফলের জন্য টাইপ করুন"}
            </span>
            <span className="hidden sm:inline">Enter ↵ দিয়ে প্রথমটি নির্বাচন করুন</span>
          </div>
        </div>
      )}
    </div>
  );
};
