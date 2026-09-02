"use client";

import React, { useState, useEffect } from "react";
import { X, Save, Trash2, Loader2, FileText } from "lucide-react";
import { fetchCourseDetails, saveCourseDetails } from "@/actions/course-actions";

interface CourseDetailsModalProps {
  course: string | null;
  onClose: () => void;
}

/**
 * কোর্সের বিস্তারিত — লিখুন / এডিট / ডিলিট (শিক্ষক প্যানেল)।
 * কোর্স পেজের ভেতরে (কোর্সের বিস্তারিত সেকশনে) যা দেখা যাবে তা এখান থেকে লেখা হয়।
 */
export const CourseDetailsModal: React.FC<CourseDetailsModalProps> = ({ course, onClose }) => {
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!course) return;
    setDetails("");
    setMsg(null);
    setLoading(true);
    fetchCourseDetails(course)
      .then(setDetails)
      .finally(() => setLoading(false));
  }, [course]);

  if (!course) return null;

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const res = await saveCourseDetails(course, details);
    setSaving(false);
    setMsg({ type: res.success ? "ok" : "err", text: res.message });
  };

  const handleDelete = async () => {
    if (!confirm(`"${course}" কোর্সের বিস্তারিত কি মুছে ফেলবেন? (দাম/ছাড় অক্ষত থাকবে)`)) return;
    setSaving(true);
    setMsg(null);
    const res = await saveCourseDetails(course, "");
    setSaving(false);
    setDetails("");
    setMsg({ type: res.success ? "ok" : "err", text: res.message });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm font-bengali animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-xl flex flex-col shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 truncate">কোর্সের বিস্তারিত</h3>
              <p className="text-xs text-slate-500 font-semibold truncate">{course}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-grow">
          <p className="text-xs text-slate-500 leading-relaxed">
            কোর্স পেজের ভেতরে (কোর্সের বিস্তারিত সেকশনে) এই লেখাটি শিক্ষার্থীদের দেখানো হবে।
            যত খুশি লম্বা লিখতে পারেন — নতুন লাইন ঠিক রাখতে এক লাইনের শেষে এন্টার চাপুন।
          </p>

          {msg && (
            <p
              className={`text-xs font-bold p-2.5 rounded-xl ${
                msg.type === "ok"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              {msg.text}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> লোড হচ্ছে...
            </div>
          ) : (
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={12}
              placeholder="এই কোর্সে কী কী আছে, কার জন্য, কীভাবে পড়তে হবে — বিস্তারিত লিখুন..."
              className="w-full p-3 rounded-xl border border-slate-300 text-sm text-slate-800 leading-relaxed bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving || loading || !details.trim()}
            className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-50 text-rose-700 disabled:text-slate-300 border border-rose-200 disabled:border-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> ডিলিট
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer transition"
            >
              বন্ধ
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-5 py-2.5 rounded-xl text-xs cursor-pointer transition"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> সংরক্ষণ হচ্ছে...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> সংরক্ষণ করুন
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
