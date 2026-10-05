"use client";

import React, { useState, useEffect } from "react";
import { 
  Gift, 
  Users, 
  CheckCircle2, 
  Clock, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Settings2, 
  Percent, 
  Save, 
  Sparkles,
  Sliders,
  DollarSign
} from "lucide-react";
import { 
  getAllReferralRecordsForAdmin, 
  getReferralSettings, 
  saveReferralSettings 
} from "@/actions/referral-actions";
import { 
  ReferralRecord, 
  ReferralSettings, 
  CourseReferralConfig,
  DEFAULT_REFERRAL_SETTINGS 
} from "@/types/referral";
import { toBengaliDigits, formatBangladeshClock } from "@/lib/utils";

interface ReferralManagerProps {
  courses?: string[];
}

export const ReferralManager: React.FC<ReferralManagerProps> = ({ courses = [] }) => {
  const [records, setRecords] = useState<ReferralRecord[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");

  // সেটিংস স্টেট
  const [settings, setSettings] = useState<ReferralSettings>(DEFAULT_REFERRAL_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "records">("settings");

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, fetchedSettings] = await Promise.all([
        getAllReferralRecordsForAdmin(),
        getReferralSettings()
      ]);
      setRecords(data.records);
      setTotalEarnings(data.totalEarningsIssued);
      setCompletedCount(data.completedCount);
      setPendingCount(data.pendingCount);
      if (fetchedSettings) {
        setSettings(fetchedSettings);
      }
    } catch (err) {
      console.error("Load admin referrals error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await saveReferralSettings(settings);
      if (res.success) {
        setSettingsMsg({ type: "success", text: res.message || "সেটিংস সংরক্ষিত হয়েছে!" });
      } else {
        setSettingsMsg({ type: "error", text: res.message || "সেভ করতে সমস্যা হয়েছে।" });
      }
    } catch (err: any) {
      setSettingsMsg({ type: "error", text: err?.message || "ব্যর্থ হয়েছে।" });
    } finally {
      setSavingSettings(false);
      setTimeout(() => setSettingsMsg(null), 5000);
    }
  };

  const handleUpdateCourseConfig = (
    courseName: string, 
    field: "rewardPercent" | "discountPercent", 
    value: number
  ) => {
    setSettings((prev) => {
      const currentConfig = prev.courseConfigs[courseName] || {
        rewardPercent: prev.defaultRewardPercent ?? 10,
        discountPercent: prev.defaultDiscountPercent ?? 10
      };
      return {
        ...prev,
        courseConfigs: {
          ...prev.courseConfigs,
          [courseName]: {
            ...currentConfig,
            [field]: Math.max(0, Math.min(100, value))
          }
        }
      };
    });
  };

  const filteredRecords = records.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      r.referrerName?.toLowerCase().includes(q) ||
      r.referrerEmail?.toLowerCase().includes(q) ||
      r.referredUserName?.toLowerCase().includes(q) ||
      r.referredUserEmail?.toLowerCase().includes(q) ||
      r.referralCode?.toLowerCase().includes(q) ||
      r.course?.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (statusFilter === "completed") return r.status === "completed";
    if (statusFilter === "pending") return r.status === "pending";
    return true;
  });

  // অনন্য কোর্সের তালিকা তৈরি (যদি props-এ না থাকে তবে রেকর্ড থেকে বের করা)
  const displayCourses = Array.from(new Set([
    ...courses,
    ...Object.keys(settings.courseConfigs || {}),
    ...records.map(r => r.course)
  ])).filter(Boolean);

  return (
    <div className="space-y-6 font-bengali">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-amber-300">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              রেফারেল ও কোর্স কমিশন ব্যবস্থাপনা
            </h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              কোর্স-ভিত্তিক রেফারার রিওয়ার্ড %, শিক্ষার্থী ছাড় % নির্ধারণ এবং রেফারেল ট্র্যাকিং রিপোর্ট
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>রিফ্রেশ</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-slate-500">মোট রেফারেল রিকোয়েস্ট</span>
          <p className="text-2xl font-black text-slate-800 mt-1">
            {toBengaliDigits(records.length)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600">অনুমোদিত (সফল)</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {toBengaliDigits(completedCount)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-amber-600">অপেক্ষমান (Pending)</span>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {toBengaliDigits(pendingCount)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <span className="text-xs font-semibold text-indigo-600">মোট অর্জিত রিওয়ার্ড</span>
          <p className="text-2xl font-black text-indigo-700 mt-1">
            ৳{toBengaliDigits(totalEarnings)}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "settings"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>কোর্স-ভিত্তিক পার্সেন্টেজ (%) কনফিগারেশন</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("records")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activeTab === "records"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>রেফারেল হিস্ট্রি ও ট্র্যাকিং তালিকা ({toBengaliDigits(records.length)})</span>
        </button>
      </div>

      {/* Tab 1: Course-wise Referral % Configuration */}
      {activeTab === "settings" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Percent className="w-5 h-5 text-indigo-600" />
                কোর্স-ভিত্তিক রেফারেল রিওয়ার্ড ও ডিসকাউন্ট রেট
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                প্রতিটি কোর্সের ফি থেকে রেফারার শিক্ষার্থী কত % কমিশন পাবে এবং নতুন শিক্ষার্থী কত % ছাড় পাবে তা নির্ধারণ করুন।
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>রেফারেল সিস্টেম চালু আছে</span>
              </label>

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>সংরক্ষণ করুন</span>
              </button>
            </div>
          </div>

          {settingsMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                settingsMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {settingsMsg.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{settingsMsg.text}</span>
            </div>
          )}

          {/* Default Global Rates */}
          <div className="bg-indigo-50/60 border border-indigo-100/80 rounded-2xl p-4.5 space-y-3">
            <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              ডিফল্ট গ্লোবাল রেট (যদি কোনো কোর্সের নির্দিষ্ট রেট না থাকে)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ডিফল্ট রেফারার রিওয়ার্ড (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.defaultRewardPercent ?? 10}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultRewardPercent: Math.max(0, Math.min(100, Number(e.target.value)))
                      })
                    }
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">কোর্স ফি-এর কত শতাংশ রেফারার পাবে</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ডিফল্ট শিক্ষার্থী ছাড় (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={settings.defaultDiscountPercent ?? 10}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultDiscountPercent: Math.max(0, Math.min(100, Number(e.target.value)))
                      })
                    }
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">রেফারেল কোড ব্যবহারে বন্ধু কত শতাংশ ছাড় পাবে</p>
              </div>
            </div>
          </div>

          {/* Course-Wise Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              কোর্স-ভিত্তিক পার্সেন্টেজ তালিকা
            </h4>

            {displayCourses.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                কোনো কোর্স পাওয়া যায়নি।
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">কোর্সের নাম</th>
                      <th className="py-3 px-4 w-44">রেফারার রিওয়ার্ড %</th>
                      <th className="py-3 px-4 w-44">বন্ধু/শিক্ষার্থী ছাড় %</th>
                      <th className="py-3 px-4 text-slate-500">উদাহরণ (৳১,০০০ কোর্সের জন্য)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayCourses.map((cName) => {
                      const cfg = settings.courseConfigs[cName] || {
                        rewardPercent: settings.defaultRewardPercent ?? 10,
                        discountPercent: settings.defaultDiscountPercent ?? 10
                      };
                      const rewardAmountEx = Math.round((1000 * cfg.rewardPercent) / 100);
                      const discountAmountEx = Math.round((1000 * cfg.discountPercent) / 100);

                      return (
                        <tr key={cName} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-800">
                            {cName}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="relative w-32">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={cfg.rewardPercent}
                                onChange={(e) =>
                                  handleUpdateCourseConfig(cName, "rewardPercent", Number(e.target.value))
                                }
                                className="w-full pl-3 pr-7 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-emerald-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <span className="absolute right-2.5 top-2 text-[11px] text-slate-400 font-bold">%</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="relative w-32">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={cfg.discountPercent}
                                onChange={(e) =>
                                  handleUpdateCourseConfig(cName, "discountPercent", Number(e.target.value))
                                }
                                className="w-full pl-3 pr-7 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-indigo-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <span className="absolute right-2.5 top-2 text-[11px] text-slate-400 font-bold">%</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                            রেফারার পাবে: <span className="font-bold text-emerald-600">৳{rewardAmountEx}</span> | 
                            শিক্ষার্থী ছাড়: <span className="font-bold text-indigo-600">৳{discountAmountEx}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-50 cursor-pointer"
            >
              {savingSettings ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>সব পরিবর্তন সংরক্ষণ করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Referral History Records */}
      {activeTab === "records" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="শিক্ষার্থী, কোড বা কোর্স খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                সকল ({toBengaliDigits(records.length)})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "completed"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800"
                }`}
              >
                অনুমোদিত ({toBengaliDigits(completedCount)})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "pending"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 hover:bg-amber-100 text-amber-800"
                }`}
              >
                পেন্ডিং ({toBengaliDigits(pendingCount)})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                রেফারেল ডেটা লোড হচ্ছে...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                কোনো রেফারেল রেকর্ড পাওয়া যায়নি।
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">রেফারার শিক্ষার্থী</th>
                      <th className="py-3 px-4">রেফারেল কোড</th>
                      <th className="py-3 px-4">নতুন শিক্ষার্থী (বন্ধু)</th>
                      <th className="py-3 px-4">কোর্স</th>
                      <th className="py-3 px-4">স্ট্যাটাস</th>
                      <th className="py-3 px-4">রিওয়ার্ড অ্যামাউন্ট</th>
                      <th className="py-3 px-4">তারিখ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{r.referrerName || "অজ্ঞাত"}</p>
                          <p className="text-[11px] text-slate-400">{r.referrerEmail || r.referrerId}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                            {r.referralCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{r.referredUserName}</p>
                          <p className="text-[11px] text-slate-400">{r.referredUserEmail || r.referredUserId}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700">{r.course}</span>
                        </td>
                        <td className="py-3 px-4">
                          {r.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              <CheckCircle2 className="w-3 h-3" /> সফল এনরোল
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              <Clock className="w-3 h-3" /> অপেক্ষমান
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-700">
                          ৳{toBengaliDigits(r.rewardAmount)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {formatBangladeshClock(r.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
