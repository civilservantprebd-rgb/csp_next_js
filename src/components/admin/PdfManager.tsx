"use client";

import React, { useState, useEffect, useMemo } from "react";
import { CoursePdfItem } from "@/types/pdf";
import { getAllPdfsAndRoutines, deleteCoursePdf } from "@/actions/pdf-actions";
import { AddCoursePdfModal } from "./AddCoursePdfModal";
import { toBengaliDigits, formatBangladeshDate } from "@/lib/utils";
import {
  FileText,
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Edit3,
  Loader2,
  BookOpen,
  GraduationCap,
  Filter,
  Layers,
  Sparkles,
  RotateCcw
} from "lucide-react";

interface PdfManagerProps {
  courses: string[];
  subjects: { name: string; course: string }[];
}

export const PdfManager: React.FC<PdfManagerProps> = ({ courses, subjects }) => {
  const [pdfs, setPdfs] = useState<CoursePdfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPdf, setEditingPdf] = useState<CoursePdfItem | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getAllPdfsAndRoutines();
      setPdfs(res.allPdfs || []);
    } catch (err) {
      console.error("Failed to load PDFs in manager:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingPdf(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pdf: CoursePdfItem) => {
    setEditingPdf(pdf);
    setIsModalOpen(true);
  };

  const handleDelete = async (pdf: CoursePdfItem) => {
    if (!confirm(`আপনি কি "${pdf.title}" পিডিএফ ফাইলটি মুছে ফেলতে চান?`)) {
      return;
    }
    try {
      const res = await deleteCoursePdf(pdf.course, pdf.id);
      if (res.success) {
        setPdfs((prev) => prev.filter((p) => p.id !== pdf.id));
      } else {
        alert(res.message || "মুছতে ব্যর্থ হয়েছে।");
      }
    } catch (err: any) {
      alert(err?.message || "মুছতে ব্যর্থ হয়েছে।");
    }
  };

  // Filtered list
  const filteredPdfs = useMemo(() => {
    return pdfs.filter((p) => {
      if (selectedCourse !== "ALL" && p.course !== selectedCourse) return false;
      if (selectedSubject !== "ALL" && (p.subject || "সাধারণ") !== selectedSubject) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const titleMatch = p.title?.toLowerCase().includes(q);
        const subjMatch = p.subject?.toLowerCase().includes(q);
        const courseMatch = p.course?.toLowerCase().includes(q);
        return titleMatch || subjMatch || courseMatch;
      }
      return true;
    });
  }, [pdfs, selectedCourse, selectedSubject, search]);

  // Unique subjects for the selected course
  const availableSubjectsForCourse = useMemo(() => {
    if (selectedCourse === "ALL") {
      const set = new Set<string>();
      subjects.forEach((s) => set.add(s.name));
      return Array.from(set);
    }
    return subjects.filter((s) => s.course === selectedCourse).map((s) => s.name);
  }, [subjects, selectedCourse]);

  return (
    <div className="space-y-5 font-bengali">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 rounded-3xl p-5 sm:p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-amber-100" />
            </span>
            <h2 className="text-lg sm:text-xl font-black">কোর্স পিডিএফ লাইব্রেরি</h2>
            <span className="text-xs font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full border border-white/25">
              মোট {toBengaliDigits(pdfs.length)}টি ফাইল
            </span>
          </div>
          <p className="text-xs text-amber-100/90 leading-relaxed max-w-xl">
            এখানে যুক্ত করা প্রতিটি পিডিএফ সংশ্লিষ্ট কোর্সের শিক্ষার্থী প্যানেলে এবং মূল পিডিএফ লাইব্রেরিতে বিষয় অনুযায়ী সাজানো থাকবে।
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white transition cursor-pointer flex items-center justify-center border border-white/20 active:scale-95 disabled:opacity-50"
            title="রিফ্রেশ করুন"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="bg-white hover:bg-amber-50 text-amber-900 font-black px-4 py-2.5 rounded-2xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md cursor-pointer shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4 text-amber-700" />
            <span>নতুন পিডিএফ যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1">
            {/* Course Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
              <select
                value={selectedCourse}
                onChange={(e) => {
                  setSelectedCourse(e.target.value);
                  setSelectedSubject("ALL");
                }}
                className="bg-transparent border-0 focus:outline-none text-slate-900 font-bold cursor-pointer"
              >
                <option value="ALL">সকল কোর্স ({toBengaliDigits(pdfs.length)})</option>
                {courses.map((c) => {
                  const count = pdfs.filter((p) => p.course === c).length;
                  return (
                    <option key={c} value={c}>
                      {c} ({toBengaliDigits(count)})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Subject Filter */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-transparent border-0 focus:outline-none text-slate-900 font-bold cursor-pointer"
              >
                <option value="ALL">সকল বিষয়</option>
                {availableSubjectsForCourse.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="পিডিএফ বা বিষয় খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* PDF List Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <p className="text-xs font-bold">পিডিএফ ফাইল লোড হচ্ছে...</p>
        </div>
      ) : filteredPdfs.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-slate-200 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-sm sm:text-base">
              কোনো পিডিএফ ফাইল পাওয়া যায়নি
            </h4>
            <p className="text-xs text-slate-500">
              {search || selectedCourse !== "ALL" || selectedSubject !== "ALL"
                ? "ফিল্টারে কোনো ফলাফল পাওয়া যায়নি। ফিল্টার রিসেট করে দেখুন।"
                : "উপরে 'নতুন পিডিএফ যোগ করুন' বাটনে ক্লিক করে প্রথম ফাইল যুক্ত করুন।"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন পিডিএফ যোগ করুন</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {filteredPdfs.map((pdf, idx) => (
            <div
              key={pdf.id || idx}
              className="p-4 rounded-2xl border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50/20 transition flex flex-col justify-between gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <h4 className="font-bold text-sm text-slate-900 leading-snug">
                    {pdf.title}
                  </h4>
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    {pdf.course && (
                      <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px]">
                        <GraduationCap className="w-3 h-3" />
                        <span>{pdf.course}</span>
                      </span>
                    )}
                    {pdf.subject && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px]">
                        <BookOpen className="w-3 h-3" />
                        <span>{pdf.subject}</span>
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

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <a
                  href={pdf.driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ড্রাইভ লিংক খুলুন</span>
                </a>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(pdf)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="এডিট করুন"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>এডিট</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(pdf)}
                    className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>মুছুন</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit PDF Modal */}
      {isModalOpen && (
        <AddCoursePdfModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          courses={courses}
          subjects={subjects}
          initialPdf={editingPdf}
          defaultCourse={selectedCourse !== "ALL" ? selectedCourse : undefined}
          defaultSubject={selectedSubject !== "ALL" ? selectedSubject : undefined}
          onSaved={(savedPdf) => {
            setPdfs((prev) => {
              const idx = prev.findIndex((p) => p.id === savedPdf.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = savedPdf;
                return next;
              }
              return [savedPdf, ...prev];
            });
            setIsModalOpen(false);
          }}
          onDeleted={(deletedId) => {
            setPdfs((prev) => prev.filter((p) => p.id !== deletedId));
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};
