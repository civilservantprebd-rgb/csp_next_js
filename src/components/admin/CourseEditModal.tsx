"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Trash2,
  Plus,
  Loader2,
  Pencil,
  Video,
  FileText,
  Tag,
  ExternalLink
} from "lucide-react";
import { renameCourse } from "@/actions/admin-actions";
import { saveCoursePrice, getCoursePrices } from "@/actions/course-actions";
import {
  getCourseVideosAdmin,
  addCourseVideo,
  deleteCourseVideo
} from "@/actions/video-actions";
import type { CourseVideo } from "@/types/video";
import type { Exam, SubjectItem } from "@/types/exam";
import { toBengaliDigits } from "@/lib/utils";

interface CourseEditModalProps {
  course: string;
  exams: Record<string, Exam>;
  subjects: SubjectItem[];
  onClose: () => void;
  onChanged: () => void;
  onManageExams: (course: string) => void;
}

export const CourseEditModal: React.FC<CourseEditModalProps> = ({
  course,
  exams,
  subjects,
  onClose,
  onChanged,
  onManageExams,
}) => {
  // নাম
  const [name, setName] = useState(course);
  const [renaming, setRenaming] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // দাম + পরিকল্পিত মোট
  const [price, setPrice] = useState("");
  const [offer, setOffer] = useState("");
  const [plannedExams, setPlannedExams] = useState("");
  const [plannedVideos, setPlannedVideos] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // ভিডিও
  const [videos, setVideos] = useState<CourseVideo[]>([]);
  const [videoLoading, setVideoLoading] = useState(true);
  const [vTitle, setVTitle] = useState("");
  const [vSubject, setVSubject] = useState("");
  const [vUrl, setVUrl] = useState("");
  const [vBusy, setVBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const courseSubjects = (subjects || []).filter((s) => s.course === course).map((s) => s.name);
  const courseExams = Object.values(exams || {}).filter((ex) => ex.course === course);

  useEffect(() => {
    getCoursePrices().then((prices) => {
      const p = prices[course];
      setPrice(p?.price !== undefined ? String(p.price) : "");
      setOffer(p?.offerPrice !== undefined ? String(p.offerPrice) : "");
      setPlannedExams(p?.plannedExams !== undefined ? String(p.plannedExams) : "");
      setPlannedVideos(p?.plannedVideos !== undefined ? String(p.plannedVideos) : "");
    });
    loadVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  const loadVideos = async () => {
    setVideoLoading(true);
    const list = await getCourseVideosAdmin();
    setVideos((list || []).filter((v) => v.course === course));
    setVideoLoading(false);
  };

  const flash = (type: "ok" | "err", text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleRename = async () => {
    const newName = name.trim();
    if (!newName || newName === course) {
      flash("err", "নতুন নাম লিখুন (বর্তমান নামের চেয়ে আলাদা)।");
      return;
    }
    setRenaming(true);
    const res = await renameCourse(course, newName);
    setRenaming(false);
    if (res.success) {
      flash("ok", "নাম পরিবর্তন হয়েছে ✓ (দামও সাথে নেওয়া হয়েছে)");
      onChanged();
    } else {
      flash("err", res.message || "নাম বদলানো যায়নি।");
    }
  };

  const handleSavePrice = async () => {
    setSavingPrice(true);
    const res = await saveCoursePrice(
      course,
      price === "" ? null : Number(price),
      offer === "" ? null : Number(offer),
      plannedExams === "" ? null : Number(plannedExams),
      plannedVideos === "" ? null : Number(plannedVideos)
    );
    setSavingPrice(false);
    if (res.success) {
      flash("ok", res.message);
      onChanged();
    } else {
      flash("err", res.message);
    }
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vTitle.trim() || !vUrl.trim()) {
      flash("err", "ভিডিওর নাম ও YouTube লিংক দিন।");
      return;
    }
    setVBusy(true);
    const res = await addCourseVideo({
      course,
      subject: vSubject || undefined,
      title: vTitle.trim(),
      youtubeUrl: vUrl.trim()
    });
    setVBusy(false);
    if (res.success) {
      setVTitle("");
      setVUrl("");
      flash("ok", "ভিডিও যোগ হয়েছে ✓");
      await loadVideos();
      onChanged();
    } else {
      flash("err", res.message);
    }
  };

  const handleDeleteVideo = async (v: CourseVideo) => {
    if (!confirm(`"${v.title}" ভিডিওটি মুছে ফেলবেন?`)) return;
    setDeletingId(v.id);
    const res = await deleteCourseVideo(v.id);
    setDeletingId(null);
    if (res.success) {
      flash("ok", "ভিডিও মুছে ফেলা হয়েছে।");
      await loadVideos();
      onChanged();
    } else {
      flash("err", res.message);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-5">
        <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col my-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-black text-slate-900 text-sm sm:text-base truncate flex items-center gap-2">
              <Pencil className="w-4 h-4 text-indigo-600" /> কোর্স এডিট: {course}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="বন্ধ করুন"
              className="p-2 rounded-lg bg-white hover:bg-slate-200 text-slate-600 cursor-pointer border border-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
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

            {/* ১. নাম */}
            <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Pencil className="w-3.5 h-3.5 text-indigo-600" /> কোর্সের নাম
              </h4>
              <div className="flex gap-2">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                <button
                  type="button"
                  disabled={renaming}
                  onClick={handleRename}
                  className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-4 rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                >
                  {renaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} সংরক্ষণ
                </button>
              </div>
              <p className="text-[11px] text-slate-400">নাম বদলালে দাম, সাবজেক্ট, পরীক্ষা — সব নতুন নামে চলে যাবে</p>
            </div>

            {/* ২. দাম */}
            <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-600" /> দাম ও ছাড়
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-500 mb-1">মূল্য (৳)</span>
                  <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="যেমন: 2000" className={inputCls} />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-500 mb-1">ছাড়ের পর মূল্য (৳)</span>
                  <input type="number" min={0} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="যেমন: 1500" className={inputCls} />
                </label>
              </div>
              {offer && price && Number(offer) < Number(price) && (
                <p className="text-[11px] text-emerald-700 font-bold">
                  {toBengaliDigits(Math.round((1 - Number(offer) / Number(price)) * 100))}% ছাড় — হোমে দেখাবে
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-500 mb-1">মোট পরীক্ষা (যতটা দেয়া হবে)</span>
                  <input type="number" min={0} value={plannedExams} onChange={(e) => setPlannedExams(e.target.value)} placeholder="যেমন: ৩০" className={inputCls} />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-500 mb-1">মোট ভিডিও (যতটা দেয়া হবে)</span>
                  <input type="number" min={0} value={plannedVideos} onChange={(e) => setPlannedVideos(e.target.value)} placeholder="যেমন: ৬০" className={inputCls} />
                </label>
              </div>
              <p className="text-[11px] text-slate-400">হোমের কোর্স কার্ডে এই সংখ্যাই দেখাবে — যোগ/এডিট/বাদ সব এখান থেকে</p>
              <button
                type="button"
                disabled={savingPrice}
                onClick={handleSavePrice}
                className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                {savingPrice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} দাম সংরক্ষণ
              </button>
            </div>

            {/* ৩. ভিডিও */}
            <div className="rounded-2xl border border-slate-200 p-3.5 space-y-3">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-rose-600" /> ভিডিও ({toBengaliDigits(videos.length)}টি)
              </h4>

              <form onSubmit={handleAddVideo} className="space-y-2 rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="text" value={vTitle} onChange={(e) => setVTitle(e.target.value)} placeholder="ভিডিওর নাম" className={inputCls} />
                  <select value={vSubject} onChange={(e) => setVSubject(e.target.value)} className={inputCls}>
                    <option value="">সাবজেক্ট নেই (কোর্স-লেভেল)</option>
                    {courseSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={vUrl} onChange={(e) => setVUrl(e.target.value)} placeholder="YouTube লিংক/ID" className={inputCls} />
                  <button
                    type="submit"
                    disabled={vBusy}
                    className="shrink-0 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-bold px-4 rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {vBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} যোগ
                  </button>
                </div>
              </form>

              {videoLoading ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-600" /> ভিডিও লোড হচ্ছে...
                </div>
              ) : videos.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-3">এই কোর্সে এখনো কোনো ভিডিও নেই</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {videos.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 bg-white">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate">{v.title}</p>
                        <p className="text-[11px] text-slate-400">{v.subject || "কোর্স-লেভেল"}</p>
                      </div>
                      <button
                        type="button"
                        disabled={deletingId === v.id}
                        onClick={() => handleDeleteVideo(v)}
                        className="shrink-0 p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer disabled:opacity-50"
                        title="মুছুন"
                      >
                        {deletingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ৪. পরীক্ষা */}
            <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2.5">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" /> পরীক্ষা ({toBengaliDigits(courseExams.length)}টি)
              </h4>
              {courseExams.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">এই কোর্সে এখনো কোনো পরীক্ষা নেই</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {courseExams.map((ex) => (
                    <div key={ex.id} className="flex items-center justify-between gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50">
                      <p className="text-xs font-bold text-slate-800 truncate">{ex.title}</p>
                      <span className="text-[11px] font-bold text-slate-500 shrink-0">
                        {toBengaliDigits(ex.questions?.length || 0)}টি প্রশ্ন
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onManageExams(course);
                }}
                className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> পরীক্ষা যোগ/এডিট করুন (Exam ট্যাবে যান)
              </button>
            </div>
          </div>

          <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2 rounded-xl text-xs cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
