"use client";

import React, { useState, useEffect } from "react";
import { ArchivedQuestion, Exam } from "@/types/exam";
import {
  getArchivedQuestions,
  permanentDeleteArchivedQuestions,
  restoreArchivedQuestions
} from "@/actions/admin-actions";
import {
  Archive,
  Trash2,
  RotateCcw,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  Layers,
  FileText,
  Clock,
  Sparkles,
  HelpCircle,
  RefreshCw
} from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

interface ArchiveManagerProps {
  exams: Record<string, Exam>;
  onRefresh: () => void;
}

export const ArchiveManager: React.FC<ArchiveManagerProps> = ({
  exams,
  onRefresh,
}) => {
  const [archived, setArchived] = useState<ArchivedQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<"ALL" | "exam" | "bank">("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetExamKey, setTargetExamKey] = useState<string>("");

  const loadArchive = async () => {
    setIsLoading(true);
    const data = await getArchivedQuestions();
    setArchived(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    loadArchive();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (filteredList: ArchivedQuestion[]) => {
    if (selectedIds.length === filteredList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredList.map((q) => q.id));
    }
  };

  const handlePermanentDelete = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    const confirmMsg =
      idsToDelete.length === 1
        ? "আপনি কি নিশ্চিতভাবে এই প্রশ্নটি চিরতরে ডাটাবেজ থেকে মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।"
        : `আপনি কি নিশ্চিতভাবে নির্বাচিত ${toBengaliDigits(idsToDelete.length)}টি প্রশ্ন চিরতরে ডাটাবেজ থেকে মুছে ফেলতে চান?`;

    if (!confirm(confirmMsg)) return;

    setIsProcessing(true);
    const ok = await permanentDeleteArchivedQuestions(idsToDelete);
    setIsProcessing(false);

    if (ok) {
      alert("সফলভাবে ডাটাবেজ থেকে চিরতরে মুছে ফেলা হয়েছে।");
      setSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
      await loadArchive();
      onRefresh();
    } else {
      alert("মুছে ফেলতে সমস্যা হয়েছে।");
    }
  };

  const handleRestore = async (idsToRestore: string[]) => {
    if (idsToRestore.length === 0) return;

    setIsProcessing(true);
    const ok = await restoreArchivedQuestions(idsToRestore, targetExamKey || undefined);
    setIsProcessing(false);

    if (ok) {
      alert(`সফলভাবে ${toBengaliDigits(idsToRestore.length)}টি প্রশ্ন রিস্টোর করা হয়েছে!`);
      setSelectedIds((prev) => prev.filter((id) => !idsToRestore.includes(id)));
      await loadArchive();
      onRefresh();
    } else {
      alert("রিস্টোর করতে সমস্যা হয়েছে।");
    }
  };

  const filteredQuestions = archived.filter((q) => {
    if (filterSource !== "ALL" && q.sourceType !== filterSource) return false;
    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase();
      const matchQ = q.q.toLowerCase().includes(qLower);
      const matchTopic = q.topic?.toLowerCase().includes(qLower);
      const matchExam = q.sourceExamTitle?.toLowerCase().includes(qLower);
      return matchQ || matchTopic || matchExam;
    }
    return true;
  });

  return (
    <div className="space-y-5 font-bengali">
      {/* Header Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              আর্কাইভ / ট্র্যাশ বিন (Archived Questions)
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              টিচার প্যানেল থেকে যেকোনো প্রশ্ন ডিলিট করলে প্রথমে এখানে জমা হয়। এখান থেকে ডিলিট করলে স্থায়ীভাবে ডাটাবেজ থেকে মুছে যাবে।
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadArchive}
          disabled={isLoading}
          className="self-end sm:self-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>রিফ্রেশ</span>
        </button>
      </div>

      {/* Control Bar: Search & Batch Action Controls */}
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          {/* Search & Filter */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="আর্কাইভে প্রশ্ন খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={filterSource}
              onChange={(e: any) => setFilterSource(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white cursor-pointer"
            >
              <option value="ALL">সকল উৎস</option>
              <option value="exam">এক্সাম থেকে ডিলিটকৃত</option>
              <option value="bank">প্রশ্ন ব্যাংক থেকে ডিলিটকৃত</option>
            </select>
          </div>

          {/* Counts */}
          <div className="text-xs text-slate-600 font-medium">
            মোট আর্কাইভ প্রশ্ন: <strong className="text-amber-700">{toBengaliDigits(archived.length)}</strong> টি
          </div>
        </div>

        {/* Batch Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSelectAll(filteredQuestions)}
              className="text-xs font-bold text-slate-700 hover:text-indigo-600 flex items-center gap-1.5 cursor-pointer"
            >
              {selectedIds.length > 0 && selectedIds.length === filteredQuestions.length ? (
                <CheckSquare className="w-4 h-4 text-indigo-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>সব সিলেক্ট করুন ({toBengaliDigits(selectedIds.length)} টি নির্বাচিত)</span>
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <select
                value={targetExamKey}
                onChange={(e) => setTargetExamKey(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs bg-white cursor-pointer"
              >
                <option value="">মূল উৎসে রিস্টোর</option>
                {Object.values(exams).map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    রিস্টোর করুন: {ex.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleRestore(selectedIds)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>রিস্টোর ({toBengaliDigits(selectedIds.length)})</span>
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handlePermanentDelete(selectedIds)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>স্থায়ীভাবে মুছুন ({toBengaliDigits(selectedIds.length)})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-3xl space-y-2">
            <Archive className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-bold text-slate-600">আর্কাইভে কোনো প্রশ্ন নেই।</p>
            <p className="text-[11px] text-slate-400">টিচার প্যানেল থেকে কোনো প্রশ্ন মুছে ফেললে তা এখানে জমা থাকবে।</p>
          </div>
        ) : (
          filteredQuestions.map((item, idx) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id || idx}
                className={`p-4 rounded-2xl border transition ${
                  isSelected
                    ? "bg-amber-50/50 border-amber-300 shadow-xs"
                    : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                } space-y-3`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => toggleSelect(item.id)}
                      className="mt-0.5 text-slate-400 hover:text-indigo-600 cursor-pointer"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          {toBengaliDigits(idx + 1)}. {item.q}
                        </span>
                      </div>

                      {/* Metadata badges */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold ${
                            item.sourceType === "exam"
                              ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {item.sourceType === "exam" ? "এক্সাম প্রশ্ন" : "প্রশ্ন ব্যাংক"}
                        </span>

                        {item.sourceExamTitle && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                            এক্সাম: {item.sourceExamTitle}
                          </span>
                        )}

                        {item.topic && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                            <Layers className="w-3 h-3 text-amber-600" /> {item.topic}
                          </span>
                        )}

                        {item.deletedAt && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.deletedAt).toLocaleDateString("bn-BD")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Single Item Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleRestore([item.id])}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      title="পুনরুদ্ধার করুন"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">রিস্টোর</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handlePermanentDelete([item.id])}
                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 p-1.5 rounded-lg text-xs transition cursor-pointer"
                      title="স্থায়ীভাবে মুছুন"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Options and Explanation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  {item.opts.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`p-1.5 rounded-lg flex items-center gap-1.5 ${
                        Number(item.correct) === oIdx
                          ? "bg-emerald-100 text-emerald-900 font-bold border border-emerald-300"
                          : "bg-white border border-slate-200"
                      }`}
                    >
                      <span className="text-slate-400 font-mono text-[10px]">
                        {toBengaliDigits(oIdx + 1)})
                      </span>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>

                {item.exp && (
                  <p className="text-xs text-indigo-800 bg-indigo-50/70 p-2 rounded-xl border border-indigo-100">
                    💡 <strong>ব্যাখ্যা:</strong> {item.exp}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
