"use client";

import React, { useState, useEffect } from "react";
import { Exam } from "@/types/exam";
import { CoursePdfItem } from "@/types/pdf";
import { saveExamPdf, deleteExamPdf } from "@/actions/pdf-actions";
import {
  FileText,
  X,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Link2
} from "lucide-react";

interface ExamPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  initialPdf?: CoursePdfItem | null;
  onSaved: (savedPdf: CoursePdfItem) => void;
  onDeleted: (examId: string) => void;
}

export const ExamPdfModal: React.FC<ExamPdfModalProps> = ({
  isOpen,
  onClose,
  exam,
  initialPdf,
  onSaved,
  onDeleted
}) => {
  const [title, setTitle] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (exam) {
      setTitle(initialPdf?.title || exam.title || "");
      setDriveLink(initialPdf?.driveLink || "");
      setError("");
      setSuccess("");
    }
  }, [exam, initialPdf, isOpen]);

  if (!isOpen || !exam) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("পিডিএফের টাইটেল দিন।");
      return;
    }
    if (!driveLink.trim()) {
      setError("গুগল ড্রাইভ লিংক দিন।");
      return;
    }

    setLoading(true);
    try {
      const res = await saveExamPdf({
        examId: exam.id,
        course: exam.course,
        subject: exam.subject,
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
    if (!confirm("আপনি কি নিশ্চিতভাবে এই এক্সামের পিডিএফ লিংকটি মুছে ফেলতে চান?")) {
      return;
    }

    setDeleteLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await deleteExamPdf(exam.course, exam.id);
      if (!res.success) {
        setError(res.message);
      } else {
        setSuccess(res.message);
        onDeleted(exam.id);
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 font-bengali animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-amber-100" />
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-base sm:text-lg leading-tight truncate">
                পিডিএফ ও গুগল ড্রাইভ লিংক
              </h3>
              <p className="text-[11px] text-amber-100 font-semibold truncate mt-0.5">
                {exam.course} · {exam.subject}
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
          {/* এক্সাম বিবরণ ব্যানার */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
              <BookOpen className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>এক্সাম: {exam.title}</span>
            </div>
            <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
              এই গুগল ড্রাইভ লিংকটি সংশ্লিষ্ট কোর্সের ভেতরে <b>&quot;পিডিএফ&quot;</b> বাটনে যুক্ত হবে এবং শিক্ষার্থীরা সরাসরি ট্যাপ করে পড়তে পারবে।
            </p>
          </div>

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

          {/* টাইটেল ইনপুট */}
          <div className="space-y-1">
            <label className="block text-xs sm:text-sm font-bold text-slate-700">
              পিডিএফের টাইটেল বা নাম <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="যেমন: বাংলা ব্যাকরণ ও সাহিত্য লেকচার শিট ০১"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition bg-white"
            />
          </div>

          {/* গুগল ড্রাইভ লিংক ইনপুট */}
          <div className="space-y-1">
            <label className="block text-xs sm:text-sm font-bold text-slate-700">
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
            <p className="text-[11px] text-slate-400 font-medium pt-0.5">
              💡 ড্রাইভ ফাইলের শেয়ার সেটিংস <b>&quot;Anyone with the link&quot;</b> রাখা নিশ্চিত করুন।
            </p>
          </div>

          {/* ড্রাইভ লিংক প্রিভিউ / টেস্ট বাটন */}
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

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
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
