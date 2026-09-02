"use client";

import React, { useState, useEffect } from "react";
import {
  Video,
  Plus,
  Save,
  Trash2,
  Edit2,
  X,
  PlayCircle,
  RotateCw,
  Link2,
  AlertTriangle
} from "lucide-react";
import { CourseVideo } from "@/types/video";
import { toBengaliDigits } from "@/lib/utils";
import { extractYoutubeId } from "@/lib/youtube";
import {
  getCourseVideosAdmin,
  addCourseVideo,
  updateCourseVideo,
  deleteCourseVideo
} from "@/actions/video-actions";

interface CourseVideoManagerProps {
  courses: string[];
}

const EMPTY_FORM = {
  course: "",
  subject: "",
  title: "",
  youtubeUrl: "",
  description: "",
  sortOrder: "0"
};

export const CourseVideoManager: React.FC<CourseVideoManagerProps> = ({ courses }) => {
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [tableMissing, setTableMissing] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    const list = await getCourseVideosAdmin();
    setVideos(list);
    setTableMissing(false);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startEdit = (v: CourseVideo) => {
    setEditingId(v.id);
    setForm({
      course: v.course,
      subject: v.subject || "",
      title: v.title,
      youtubeUrl: v.youtubeId,
      description: v.description || "",
      sortOrder: String(v.sortOrder ?? 0)
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.course || !form.title.trim()) {
      alert("কোর্স ও ভিডিওর নাম দিন।");
      return;
    }
    const payload = {
      course: form.course,
      subject: form.subject,
      title: form.title,
      youtubeUrl: form.youtubeUrl,
      description: form.description,
      sortOrder: Number(form.sortOrder) || 0
    };

    const res = editingId
      ? await updateCourseVideo(editingId, payload)
      : await addCourseVideo(payload);

    alert(res.message);
    if (res.success) {
      resetForm();
      loadData();
    } else if (/course_videos টেবিল/.test(res.message)) {
      setTableMissing(true);
    }
  };

  const handleDelete = async (v: CourseVideo) => {
    if (!confirm(`"${v.title}" ভিডিওটি মুছে ফেলবেন?`)) return;
    const res = await deleteCourseVideo(v.id);
    alert(res.message);
    if (res.success) loadData();
  };

  const filtered = filterCourse === "ALL" ? videos : videos.filter((v) => v.course === filterCourse);
  const availableCourses = Array.from(new Set(videos.map((v) => v.course)));

  // বিষয় অনুযায়ী গ্রুপ
  const grouped = new Map<string, CourseVideo[]>();
  filtered.forEach((v) => {
    const key = v.course;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(v);
  });

  const ytPreviewId = extractYoutubeId(form.youtubeUrl);

  return (
    <div className="space-y-6 font-bengali">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Video className="w-5 h-5 text-rose-600" /> কোর্স ভিডিও ম্যানেজার (YouTube)
          </h3>
          <p className="text-xs text-slate-500">
            ভিডিও YouTube-এ Unlisted করে আপলোড করুন, তারপর এখানে URL/ID দিন — এনরোল্ড স্টুডেন্টরাই দেখতে পাবে
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading}
          className="text-indigo-700 hover:text-indigo-900 text-xs flex items-center gap-1 cursor-pointer font-medium"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> রিফ্রেশ
        </button>
      </div>

      {/* Table-missing warning */}
      {tableMissing && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>course_videos টেবিল এখনো তৈরি হয়নি।</strong> Supabase Dashboard → SQL Editor খুলে প্রজেক্টের{" "}
            <code className="bg-white px-1.5 py-0.5 rounded border border-rose-200">supabase/course_videos.sql</code>{" "}
            ফাইলের কোড Run করুন, তারপর রিফ্রেশ চাপুন।
          </div>
        </div>
      )}

      {/* Add / Edit Form */}
      <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
          {editingId ? <><Edit2 className="w-4 h-4 text-indigo-600" /> ভিডিও এডিট করুন</> : <><Plus className="w-4 h-4 text-emerald-600" /> নতুন ভিডিও যোগ করুন</>}
          {editingId && (
            <button type="button" onClick={resetForm} className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer">
              <X className="w-3 h-3" /> বাতিল
            </button>
          )}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">কোর্স *</label>
            <select
              value={form.course}
              onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white cursor-pointer"
              required
            >
              <option value="">— কোর্স নির্বাচন —</option>
              {courses.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">বিষয়</label>
            <input
              type="text"
              placeholder="যেমন: বাংলা সাহিত্য"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">ভিডিওর নাম *</label>
            <input
              type="text"
              placeholder="যেমন: চর্যাপদ — ক্লাস ০১"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> YouTube লিংক / ভিডিও ID *
            </label>
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=xxxx  বা  youtu.be/xxxx"
              value={form.youtubeUrl}
              onChange={(e) => setForm((f) => ({ ...f, youtubeUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
              required
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">বিবরণ (ঐচ্ছিক)</label>
            <input
              type="text"
              placeholder="এই ক্লাসে যা যা শেখানো হবে..."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">ক্রম (ছোট = আগে)</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer flex items-center gap-1.5"
          >
            {editingId ? <><Save className="w-4 h-4" /> আপডেট করুন</> : <><Plus className="w-4 h-4" /> ভিডিও যোগ করুন</>}
          </button>
          {ytPreviewId && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
              প্রিভিউ: <span className="font-mono font-bold">{ytPreviewId}</span>
            </span>
          )}
        </div>
      </form>

      {/* Course filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilterCourse("ALL")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            filterCourse === "ALL" ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
          }`}
        >
          সব কোর্স ({toBengaliDigits(videos.length)})
        </button>
        {availableCourses.map((c) => {
          const count = videos.filter((v) => v.course === c).length;
          const isSel = filterCourse === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCourse(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                isSel ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {c} ({toBengaliDigits(count)})
            </button>
          );
        })}
      </div>

      {/* Grouped video list */}
      {isLoading ? (
        <p className="text-xs text-slate-400 text-center py-6">লোড হচ্ছে...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Video className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">
            এখনো কোনো ভিডিও যোগ করা হয়নি। উপরের ফর্ম দিয়ে প্রথম ভিডিও যোগ করুন।
          </p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([courseName, courseVideos]) => (
          <div key={courseName} className="space-y-2">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2 pt-2">
              <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200">
                📁 {courseName}
              </span>
              <span className="text-slate-400 text-[11px] font-semibold">({toBengaliDigits(courseVideos.length)}টি)</span>
            </h4>
            <div className="space-y-2">
              {courseVideos.map((v) => (
                <div
                  key={v.id}
                  className="bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3 text-xs sm:text-sm shadow-2xs"
                >
                  <img
                    src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
                    alt=""
                    className="w-24 h-14 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate">{v.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {v.subject && (
                        <span className="bg-sky-50 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-200">
                          {v.subject}
                        </span>
                      )}
                      <span className="text-slate-400 text-[10px] font-mono">{v.youtubeId}</span>
                      <span className="text-slate-400 text-[10px]">ক্রম: {toBengaliDigits(v.sortOrder)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-rose-600 hover:text-rose-800 font-bold px-2 py-1.5 rounded-lg transition cursor-pointer border border-rose-200 bg-rose-50 flex items-center gap-1"
                    >
                      <PlayCircle className="w-3.5 h-3.5" /> YouTube
                    </a>
                    <button
                      onClick={() => startEdit(v)}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold p-1.5 rounded-lg transition cursor-pointer border border-indigo-200"
                      title="এডিট"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(v)}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold p-1.5 rounded-lg transition cursor-pointer border border-rose-200"
                      title="মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
