"use client";

import React, { useState, useEffect } from "react";
import { CoursePdfItem } from "@/types/pdf";
import { saveCoursePdf, deleteCoursePdf } from "@/actions/pdf-actions";
import {
  FileText,
  X,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  BookOpen,
  GraduationCap,
  Sparkles,
  Plus
} from "lucide-react";

interface AddCoursePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: string[];
  subjects: { name: string; course: string }[];
  initialPdf?: CoursePdfItem | null;
  defaultCourse?: string;
  defaultSubject?: string;
  onSaved: (pdf: CoursePdfItem) => void;
  onDeleted?: (pdfId: string) => void;
}

const PRESET_TITLES = [
  "লেকচার শিট",
  "প্রশ্নপত্র",
  "ব্যাখ্যাসহ সমাধান শিট",
  "রিভিশন নোট",
  "হ্যান্ডনোট",
  "স্পেশাল সাজেশন",
  "শর্টকাট টেকনিক"
];

export const AddCoursePdfModal: React.FC<AddCoursePdfModalProps> = ({
  isOpen,
  onClose,
  courses,
  subjects,
  initialPdf,
  defaultCourse,
  defaultSubject,
  onSaved,
  onDeleted
}) => {
  const [course, setCourse] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filter subjects based on selected course
  const availableSubjects = subjects.filter((s) => s.course === course);

  useEffect(() => {
    if (!isOpen) return;

    setError("");
    setSuccess("");

    if (initialPdf) {
      setCourse(initialPdf.course || courses[0] || "");
      setSubject(initialPdf.subject || "সাধারণ");
      setTitle(initialPdf.title || "");
      setDriveLink(initialPdf.driveLink || "");
    } else {
      const selectedC = defaultCourse && courses.includes(defaultCourse) ? defaultCourse : courses[0] || "";
      setCourse(selectedC);

      const matchedSubs = subjects.filter((s) => s.course === selectedC);
      const selectedS = defaultSubject && matchedSubs.some((s) => s.name === defaultSubject)
        ? defaultSubject
        : matchedSubs[0]?.name || "সাধারণ";
      setSubject(selectedS);

      setTitle("");
      setDriveLink("");
    }
  }, [isOpen, initialPdf, defaultCourse, defaultSubject, courses, subjects]);

  // When course changes, adjust subject
  const handleCourseChange = (newCourse: string) => {
    setCourse(newCourse);
    const matchedSubs = subjects.filter((s) => s.course === newCourse);
    if (matchedSubs.length > 0) {
      setSubject(matchedSubs[0].name);
    } else {
      setSubject("সাধারণ");
    }
  };

  const handleApplyPreset = (preset: string) => {
    if (!title.trim()) {
      setTitle(`${subject !== "সাধারণ" ? subject + " - " : ""}${preset}`);
    } else {
      setTitle(`${title.trim()} (${preset})`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!course.trim()) {
      setError("কোর্স নির্বাচন করুন।");
      return;
    }
    if (!subject.trim()) {
      setError("সাবজেক্ট নির্বাচন করুন।");
      return;
    }
    if (!title.trim()) {
      setError("শিক্ষার্থীরা যে নামে দেখবে সেই টাইটেল দিন।");
      return;
    }
    if (!driveLink.trim()) {
      setError("গুগল ড্রাইভ লিংক দিন।");
      return;
    }

    setLoading(true);
    try {
      const res = await saveCoursePdf({
        id: initialPdf?.id,
        course: course.trim(),
        subject: subject.trim(),
        title: title.trim(),
        driveLink: driveLink.trim()
      });

      if (!res.success) {
        setError(res.message);
      } else {
        setSuccess(res.message);
        if (res.pdf) {
          onSaved(res.pdf);
        }
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setError(err?.message || "সংরক্ষণ ব্যর্থ হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialPdf) return;
    if (!confirm(`আপনি কি নিশ্চিতভাবে "${initialPdf.title}" পিডিএফ ফাইলটি মুছে ফেলতে চান?`)) {
      return;
    }

    setDeleteLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await deleteCoursePdf(initialPdf.course, initialPdf.id);
      if (!res.success) {
        setError(res.message);
      } else {
        setSuccess(res.message);
        if (onDeleted) {
          onDeleted(initialPdf.id);
        }
        setTimeout(() => {
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setError(err?.message || "মুছতে ব্যর্থ হয়েছে।");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 font-bengali animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-amber-100" />
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-base sm:text-lg leading-tight truncate">
                {initialPdf ? "পিডিএফ এডিট করুন" : "নতুন পিডিএফ যুক্ত করুন"}
              </h3>
              <p className="text-[11px] text-amber-100/90 font-medium truncate mt-0.5">
                কোর্স ও বিষয়ভিত্তিক শিক্ষার্থীদের পড়ার জন্য লেকচার/শিট
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* কোর্স ও সাবজেক্ট নির্বাচন */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                <span>কোর্স নির্বাচন করুন</span> <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={course}
                onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
              >
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                <span>সাবজেক্ট বা বিষয়</span> <span className="text-rose-500">*</span>
              </label>
              <select
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium cursor-pointer"
              >
                {availableSubjects.length > 0 ? (
                  availableSubjects.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))
                ) : (
                  <option value="সাধারণ">সাধারণ</option>
                )}
              </select>
            </div>
          </div>

          {/* টাইটেল ইনপুট — যা স্টুডেন্ট দেখবে */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              পিডিএফের নাম (শিক্ষার্থীরা যা দেখবে) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="যেমন: বাংলা ব্যাকরণ লেকচার ০১ - ধ্বনি ও বর্ণ প্রকরণ"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition bg-white"
            />

            {/* কুইক টাইটেল সাজেশন */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-0.5">
                <Sparkles className="w-3 h-3 text-amber-600" /> দ্রুত যোগ করুন:
              </span>
              {PRESET_TITLES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 rounded-lg text-[11px] font-bold transition border border-slate-200 cursor-pointer"
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          {/* গুগল ড্রাইভ লিংক ইনপুট */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              গুগল ড্রাইভ লিংক (URL) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="url"
                required
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition bg-white"
              />
            </div>
            {driveLink.trim() && (
              <div className="pt-1">
                <a
                  href={driveLink.startsWith("http") ? driveLink : `https://${driveLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>ড্রাইভ লিংকটি নতুন ট্যাবে টেস্ট করুন</span>
                </a>
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 font-medium">
            💡 ড্রাইভ ফাইলের শেয়ার সেটিংস <b>&quot;Anyone with the link can view&quot;</b> রাখা নিশ্চিত করুন, যাতে শিক্ষার্থীরা কোনো রিকোয়েস্ট এক্সেস ঝামেলা ছাড়াই সরাসরি দেখতে পারে।
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div>
              {initialPdf && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLoading || loading}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {deleteLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>পিডিএফ মুছুন</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs sm:text-sm font-bold transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2 rounded-xl text-xs sm:text-sm transition shadow-md shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>সংরক্ষণ হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>সংরক্ষণ করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
