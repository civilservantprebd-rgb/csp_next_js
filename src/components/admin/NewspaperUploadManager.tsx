"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Newspaper as NewspaperIcon
} from "lucide-react";
import {
  uploadNewspapers,
  getNewspaperUploads,
  deleteNewspaperUpload,
  NewspaperUpload
} from "@/actions/newspaper-actions";
import { toBengaliDigits } from "@/lib/utils";

function todayBd(): string {
  const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const STATUS_UI: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "অপেক্ষমাণ (রাত ৩টা)", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  processing: { label: "প্রসেস হচ্ছে...", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Loader2 },
  done: { label: "সম্পন্ন", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  error: { label: "ত্রুটি", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle }
};

/**
 * শিক্ষক প্যানেল — "পত্রিকা আপলোড":
 * দিনের পত্রিকার ডিজিটাল (টেক্সট) PDF আপলোড করলে রাত ০৩:০০-তে GitHub Actions
 * (DeepSeek) সেটা থেকে টপ নিউজ + BCS-উপযোগী সম্পাদকীয় বের করে সাইটে প্রকাশ করে।
 * ফাইলগুলো Storage-এ থাকে (ডাটাবেজে নয়) — DB-তে শুধু ছোট মেটা রেকর্ড।
 */
export const NewspaperUploadManager: React.FC = () => {
  const [paperName, setPaperName] = useState("");
  const [date, setDate] = useState(todayBd());
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploads, setUploads] = useState<NewspaperUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async () => {
    const list = await getNewspaperUploads(80);
    setUploads(list || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErrorMsg("");
    setNotice("");
    setUploading(true);
    try {
      const res = await uploadNewspapers(paperName, date, fd);
      if (res.success) {
        setNotice(res.message + (res.failures.length > 0 ? ` (${res.failures.length}টি ব্যর্থ)` : ""));
        setPaperName("");
        setFileNames([]);
        form.reset();
        load();
      } else {
        setErrorMsg(res.message + (res.failures.length > 0 ? ` ${res.failures[0].name}: ${res.failures[0].error}` : ""));
      }
    } catch (err) {
      setErrorMsg(String((err as any)?.message || err).slice(0, 200));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (u: NewspaperUpload) => {
    if (!confirm(`"${u.paperName}" (${u.uploadDate})-এর আপলোডটি মুছে ফেলবেন? প্রসেস হয়ে থাকলে সাইটের আউটপুট থাকবে।`)) return;
    const res = await deleteNewspaperUpload(u.id);
    setNotice(res.message);
    load();
    setTimeout(() => setNotice(""), 4000);
  };

  return (
    <div className="space-y-5 font-bengali">
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* আপলোড ফর্ম */}
      <div className="bg-indigo-50 p-4 sm:p-5 rounded-2xl border border-indigo-100 space-y-3">
        <h3 className="font-bold text-indigo-900 text-xs sm:text-sm flex items-center gap-1.5">
          <UploadCloud className="w-4 h-4" /> দিনের পত্রিকা আপলোড (ডিজিটাল PDF)
        </h3>
        <form onSubmit={handleUpload} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-indigo-700 mb-1">পত্রিকার নাম *</label>
              <input
                type="text"
                required
                maxLength={80}
                placeholder="যেমন: প্রথম আলো"
                value={paperName}
                onChange={(e) => setPaperName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-indigo-700 mb-1">সংস্করণের তারিখ (বাংলাদেশ)</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 text-xs sm:text-sm bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-indigo-700 mb-1">
              PDF ফাইল (একাধিক নিতে পারেন — প্রতিটি ৪০MB পর্যন্ত, ডিজিটাল/টেক্সট PDF)
            </label>
            <input
              type="file"
              name="files"
              accept=".pdf,application/pdf"
              multiple
              required
              onChange={(e) => setFileNames(Array.from(e.target.files || []).map((f) => f.name))}
              className="w-full text-xs sm:text-sm bg-white rounded-xl border border-indigo-200 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:text-xs file:font-bold file:cursor-pointer hover:file:bg-indigo-700 cursor-pointer"
            />
            {fileNames.length > 0 && (
              <p className="text-[11px] text-indigo-500 font-bold mt-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> {toBengaliDigits(fileNames.length)}টি ফাইল: {fileNames.slice(0, 3).join(", ")}
                {fileNames.length > 3 ? "…" : ""}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition shadow cursor-pointer flex items-center justify-center gap-1.5"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {uploading ? "আপলোড হচ্ছে..." : "আপলোড করুন"}
          </button>
        </form>
        <p className="text-[11px] text-indigo-400 font-semibold leading-relaxed">
          💡 রাত ০৩:০০-তে DeepSeek অটো-প্রসেস করবে: টপ নিউজ → ফ্রন্ট পেজের "দৈনিক পত্রিকা" সেকশনে,
          আর BCS-উপযোগী সম্পাদকীয়/মতামত/বিশ্লেষণ → "দৈনিক সম্পাদকীয়" PDF-এ। ফাইল Storage-এ থাকে,
          ডাটাবেজে নয়।
        </p>
      </div>

      {/* আপলোড তালিকা */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
            <NewspaperIcon className="w-4 h-4 text-indigo-600" />
            সাম্প্রতিক আপলোড ({toBengaliDigits(uploads.length)}টি)
          </h4>
          <button
            type="button"
            onClick={load}
            className="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> রিফ্রেশ
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 justify-center py-8 text-slate-400 text-xs font-bold">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> লোড হচ্ছে...
          </div>
        ) : uploads.length === 0 ? (
          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-xs text-slate-400 font-bold">
            এখনো কোনো পত্রিকা আপলোড করা হয়নি। উপরের ফর্ম দিয়ে আজকের পত্রিকার PDF দিন।
          </div>
        ) : (
          <div className="space-y-2">
            {uploads.map((u) => {
              const st = STATUS_UI[u.status] || STATUS_UI.pending;
              const StIcon = st.icon;
              return (
                <div
                  key={u.id}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    u.status === "error" ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-black text-xs sm:text-sm">{u.paperName}</span>
                      <span className="text-[11px] text-slate-500 font-bold">{u.uploadDate}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${st.cls}`}>
                        <StIcon className={`w-3 h-3 ${u.status === "processing" ? "animate-spin" : ""}`} />
                        {st.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-3 flex-wrap">
                      <span>নিউজ: {toBengaliDigits(u.topNewsCount)}</span>
                      <span>সম্পাদকীয়: {toBengaliDigits(u.editorialCount)}</span>
                      <span>পাতা: {toBengaliDigits(u.pageCount)}</span>
                      {u.error && <span className="text-rose-600 font-bold break-all">{u.error}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(u)}
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 font-semibold text-xs px-2 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 transition self-end sm:self-center"
                    title="আপলোডটি মুছে ফেলুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> মুছুন
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
