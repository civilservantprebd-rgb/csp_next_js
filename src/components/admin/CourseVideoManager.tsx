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
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ChevronRight
} from "lucide-react";
import { CourseVideo } from "@/types/video";
import { SubjectItem } from "@/types/exam";
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
  subjects: SubjectItem[];
}

const EMPTY_FORM = {
  course: "",
  subject: "",
  title: "",
  youtubeUrl: "",
  description: "",
  sortOrder: "0"
};

export const CourseVideoManager: React.FC<CourseVideoManagerProps> = ({ courses, subjects }) => {
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
      subject: form.subject.trim(),
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

  /** প্লেলিস্টের ভেতরে ভিডিওর ক্রম বদল — শুধু sort_order অদলবদল */
  const moveVideo = async (v: CourseVideo, dir: -1 | 1) => {
    const group = videos
      .filter((x) => x.course === v.course && (x.subject || "সাধারণ") === (v.subject || "সাধারণ"))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = group.findIndex((x) => x.id === v.id);
    const target = group[idx + dir];
    if (!target) return;

    const vRes = await updateCourseVideo(v.id, {
      course: v.course,
      subject: v.subject,
      title: v.title,
      youtubeUrl: v.youtubeId,
      description: v.description,
      sortOrder: target.sortOrder ?? 0
    });
    const tRes = await updateCourseVideo(target.id, {
      course: target.course,
      subject: target.subject,
      title: target.title,
      youtubeUrl: target.youtubeId,
      description: target.description,
      sortOrder: v.sortOrder ?? 0
    });
    if (vRes.success && tRes.success) loadData();
    else alert("ক্রম বদলাতে সমস্যা হয়েছে।");
  };

  const filtered = filterCourse === "ALL" ? videos : videos.filter((v) => v.course === filterCourse);
  const availableCourses = Array.from(new Set(videos.map((v) => v.course)));

  // কোর্স → সাবজেক্ট → ভিডিও (প্লেলিস্ট)
  const playlistTree: { course: string; subjects: { subject: string; items: CourseVideo[] }[] }[] = [];
  {
    const byCourse = new Map<string, Map<string, CourseVideo[]>>();
    filtered.forEach((v) => {
      const courseMap = byCourse.get(v.course) || new Map<string, CourseVideo[]>();
      const subj = v.subject || "সাধারণ";
      const arr = courseMap.get(subj) || [];
      arr.push(v);
      courseMap.set(subj, arr);
      byCourse.set(v.course, courseMap);
    });
    byCourse.forEach((subjectMap, course) => {
      const subjectsArr: { subject: string; items: CourseVideo[] }[] = [];
      subjectMap.forEach((items, subject) => {
        items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        subjectsArr.push({ subject, items });
      });
      playlistTree.push({ course, subjects: subjectsArr });
    });
  }

  // নির্বাচিত কোর্সের সাবজেক্ট (datalist সাজেশন)
  const courseSubjects = subjects.filter((s) => s.course === form.course).map((s) => s.name);
  const ytPreviewId = extractYoutubeId(form.youtubeUrl);

  return (
    <div className="space-y-6 font-bengali">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Video className="w-5 h-5 text-rose-600" /> কোর্স ভিডিও ম্যানেজার (সাবজেক্ট প্লেলিস্ট)
          </h3>
          <p className="text-xs text-slate-500">
            ভিডিও YouTube-এ Unlisted করে আপলোড করুন, তারপর কোর্স + সাবজেক্ট প্লেলিস্টে যোগ করুন — এনরোল্ড স্টুডেন্টরাই দেখতে পাবে
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
          {editingId ? <><Edit2 className="w-4 h-4 text-indigo-600" /> ভিডিও এডিট করুন</> : <><Plus className="w-4 h-4 text-emerald-600" /> নতুন ভিডিও যোগ করুন (প্লেলিস্টে)</>}
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
              onChange={(e) => setForm((f) => ({ ...f, course: e.target.value, subject: "" }))}
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">সাবজেক্ট / প্লেলিস্ট *</label>
            <input
              type="text"
              list="subject-options"
              placeholder="যেমন: বাংলা সাহিত্য"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
              required
            />
            <datalist id="subject-options">
              {courseSubjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
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
            <label className="block text-[11px] font-medium text-slate-600 mb-1">প্লেলিস্টে ক্রম (ছোট = আগে)</label>
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
            {editingId ? <><Save className="w-4 h-4" /> আপডেট করুন</> : <><Plus className="w-4 h-4" /> প্লেলিস্টে যোগ করুন</>}
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

      {/* Playlist tree: course → subject → videos */}
      {isLoading ? (
        <p className="text-xs text-slate-400 text-center py-6">লোড হচ্ছে...</p>
      ) : playlistTree.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <Video className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">
            এখনো কোনো ভিডিও যোগ করা হয়নি। উপরের ফর্ম দিয়ে প্রথম ভিডিও যোগ করুন।
          </p>
        </div>
      ) : (
        playlistTree.map((courseNode) => (
          <div key={courseNode.course} className="space-y-4">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2 pt-1">
              <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg border border-indigo-200">📁 {courseNode.course}</span>
              <span className="text-slate-400 text-[11px] font-semibold">
                ({toBengaliDigits(courseNode.subjects.length)}টি প্লেলিস্ট)
              </span>
            </h4>

            <div className="space-y-3">
              {courseNode.subjects.map((playlist) => (
                <div key={playlist.subject} className="bg-slate-50/70 border border-slate-200 rounded-2xl overflow-hidden">
                  {/* Playlist header */}
                  <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-gradient-to-r from-sky-50 to-indigo-50 border-b border-slate-200">
                    <div className="flex items-center gap-2 min-w-0">
                      <PlayCircle className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="font-black text-slate-900 text-xs sm:text-sm truncate">{playlist.subject}</span>
                      <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-sky-200 shrink-0">
                        {toBengaliDigits(playlist.items.length)}টি ভিডিও
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>

                  {/* Playlist videos */}
                  <div className="divide-y divide-slate-100">
                    {playlist.items.map((v, vIdx) => (
                      <div key={v.id} className="px-3.5 py-2.5 flex items-center gap-3 bg-white">
                        <span className="text-[10px] font-black text-slate-300 w-5 text-center shrink-0">{toBengaliDigits(vIdx + 1)}</span>
                        <img
                          src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
                          alt=""
                          className="w-20 h-11 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-xs truncate">{v.title}</p>
                          <p className="text-slate-400 text-[10px] font-mono mt-0.5">{v.youtubeId}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveVideo(v, -1)}
                            disabled={vIdx === 0}
                            className="p-1 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="উপরে (আগে)"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveVideo(v, 1)}
                            disabled={vIdx === playlist.items.length - 1}
                            className="p-1 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title="নিচে (পরে)"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`https://www.youtube.com/watch?v=${v.youtubeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-rose-600 hover:text-rose-800 font-bold px-1.5 py-1 rounded-md transition cursor-pointer"
                          >
                            YT
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
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
