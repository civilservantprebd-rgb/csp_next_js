"use client";

import React, { useState, useEffect } from "react";
import { Newspaper, Plus, Pencil, Trash2, X, Check, Loader2, CalendarDays, AlertCircle, Eye } from "lucide-react";
import { getDailyNews, addDailyNews, updateDailyNews, deleteDailyNews, DailyNewsItem } from "@/actions/news-actions";
import { toBengaliDigits, formatBangladeshDate } from "@/lib/utils";

/**
 * শিক্ষক প্যানেলের "দৈনিক সংবাদ" ম্যানেজার:
 * নতুন সংবাদ যোগ (হেডিং + ৩-৪ লাইন), তালিকা দেখানো, এডিট ও মুছে ফেলা।
 */
export const NewsManager: React.FC = () => {
  const [news, setNews] = useState<DailyNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // নতুন সংবাদ ফর্ম
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");

  // এডিটিং স্টেট
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHeading, setEditHeading] = useState("");
  const [editBody, setEditBody] = useState("");

  const load = async () => {
    setLoading(true);
    const list = await getDailyNews();
    setNews(list || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice("");
    setErrorMsg("");
    const res = await addDailyNews(heading, body);
    if (res.success) {
      setNotice(res.message);
      setHeading("");
      setBody("");
      load();
      setTimeout(() => setNotice(""), 3000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const startEdit = (n: DailyNewsItem) => {
    setEditingId(n.id);
    setEditHeading(n.heading);
    setEditBody(n.body);
    setErrorMsg("");
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setErrorMsg("");
    const res = await updateDailyNews(editingId, editHeading, editBody);
    if (res.success) {
      setEditingId(null);
      load();
      setNotice(res.message);
      setTimeout(() => setNotice(""), 3000);
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleDelete = async (n: DailyNewsItem) => {
    if (!confirm(`“${n.heading}” — এই সংবাদটি মুছে ফেলবেন?`)) return;
    setErrorMsg("");
    const res = await deleteDailyNews(n.id);
    if (res.success) {
      load();
      setNotice(res.message);
      setTimeout(() => setNotice(""), 3000);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="space-y-5 font-bengali">
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* নতুন সংবাদ যোগ */}
      <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
        <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> নতুন সংবাদ যোগ করুন
        </h3>
        <form onSubmit={handleAdd} className="space-y-2.5">
          <input
            type="text"
            required
            maxLength={120}
            placeholder="সংবাদের হেডিং (১ লাইন)"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
          />
          <textarea
            required
            rows={4}
            maxLength={1000}
            placeholder="সংবাদের বিস্তারিত (৩-৪ লাইন)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white resize-y"
          />
          <button
            type="submit"
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer"
          >
            সংবাদ যোগ করুন
          </button>
        </form>
        <p className="text-[11px] text-indigo-400 font-semibold">
          💡 যোগ করার পর স্টুডেন্টদের হোম পেজে “দৈনিক সংবাদ” সেকশনে ও পপআপে দেখা যাবে।
        </p>
      </div>

      {/* সংবাদ তালিকা */}
      <div>
        <h4 className="font-bold text-slate-800 text-xs sm:text-sm mb-2.5">
          মোট {toBengaliDigits(news.length)}টি সংবাদ
        </h4>

        {loading ? (
          <div className="flex items-center gap-2 justify-center py-8 text-slate-400 text-xs font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> লোড হচ্ছে...
          </div>
        ) : news.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 font-bold">
            এখনো কোনো সংবাদ যোগ করা হয়নি।
          </div>
        ) : (
          <div className="space-y-2">
            {news.map((n, idx) => {
              const isEditing = editingId === n.id;
              return (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isEditing ? "border-indigo-400 bg-indigo-50/30" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        maxLength={120}
                        value={editHeading}
                        onChange={(e) => setEditHeading(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white"
                        placeholder="হেডিং"
                      />
                      <textarea
                        rows={3}
                        maxLength={1000}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm bg-white resize-y"
                        placeholder="বিস্তারিত"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> সংরক্ষণ
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> বাতিল
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[11px] font-black text-slate-500">
                              {toBengaliDigits(idx + 1)}.
                            </span>
                            <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1">
                              <CalendarDays className="w-3 h-3" /> {n.createdAt ? formatBangladeshDate(n.createdAt) : "—"}
                            </span>
                            <span className="text-[10px] font-black text-black bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full flex items-center gap-1 ml-auto">
                              <Eye className="w-3 h-3" /> {toBengaliDigits(n.readCount ?? 0)} বার পড়া
                            </span>
                          </div>
                          <h5 className="font-black text-black text-xs sm:text-sm">{n.heading}</h5>
                          <p className="text-[11px] sm:text-xs text-slate-700 mt-1 leading-relaxed whitespace-pre-line line-clamp-2">
                            {n.body}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(n)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 font-bold text-xs px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 transition"
                            title="এডিট করুন"
                          >
                            <Pencil className="w-3 h-3" /> এডিট
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(n)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 font-semibold text-xs px-2 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 transition"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> মুছুন
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
