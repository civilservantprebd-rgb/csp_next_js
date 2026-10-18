"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  UserX,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCw,
  KeyRound,
  Shield,
  Info
} from "lucide-react";
import {
  getAdminAccessList,
  grantAdminAccess,
  revokeAdminAccess,
  DynamicAdminUser
} from "@/actions/admin-management-actions";

export const AdminAccessManager: React.FC = () => {
  const [envAdmins, setEnvAdmins] = useState<string[]>([]);
  const [dynamicAdmins, setDynamicAdmins] = useState<DynamicAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await getAdminAccessList();
      setEnvAdmins(res.envAdmins || []);
      setDynamicAdmins(res.dynamicAdmins || []);
    } catch (err: any) {
      setErrorMsg(err.message || "অ্যাডমিন তালিকা লোড করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setSubmitting(true);
    setNotice("");
    setErrorMsg("");

    try {
      const res = await grantAdminAccess(newEmail.trim());
      if (res.success) {
        setNotice(res.message);
        setNewEmail("");
        await loadData();
        setTimeout(() => setNotice(""), 5000);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "এক্সেস দিতে সমস্যা হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (email: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${email}"-এর অ্যাডমিন প্যানেল এক্সেস বাতিল করতে চান?`)) {
      return;
    }

    setRevokingEmail(email);
    setNotice("");
    setErrorMsg("");

    try {
      const res = await revokeAdminAccess(email);
      if (res.success) {
        setNotice(res.message);
        await loadData();
        setTimeout(() => setNotice(""), 5000);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "এক্সেস বাতিল করতে সমস্যা হয়েছে।");
    } finally {
      setRevokingEmail(null);
    }
  };

  return (
    <div className="space-y-6 font-bengali">
      {/* Toast Messages */}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm p-4 rounded-2xl flex items-center gap-2.5 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm p-4 rounded-2xl flex items-center gap-2.5 shadow-xs animate-fade-in">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900">
              অ্যাডমিন ও শিক্ষক এক্সেস নিয়ন্ত্রণ
            </h3>
            <p className="text-xs text-slate-500">
              সরাসরি ইমেইল দিয়ে যে কাউকে শিক্ষক/অ্যাডমিন এক্সেস দিন অথবা বাতিল করুন
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          <span>রিফ্রেশ</span>
        </button>
      </div>

      {/* Add New Admin Form */}
      <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/30 rounded-3xl border border-indigo-100 p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-indigo-600" />
          <h4 className="text-sm font-bold text-slate-900">
            নতুন শিক্ষক / অ্যাডমিন যুক্ত করুন
          </h4>
        </div>
        <form onSubmit={handleGrantAccess} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              placeholder="শিক্ষক বা অ্যাডমিনের ইমেইল এড্রেস লিখুন (যেমন: teacher@gmail.com)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !newEmail.trim()}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shrink-0 shadow-sm cursor-pointer active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> এক্সেস দেওয়া হচ্ছে...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" /> এক্সেস দিন
              </>
            )}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-16 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-bold">অ্যাডমিন তালিকা লোড হচ্ছে...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: SYSTEM MASTER ADMINS */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-bold text-slate-900">
                  সিস্টেমের মূল (Master) অ্যাডমিন
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                সার্ভার কনফিগারেশন
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {envAdmins.map((email) => (
                <div
                  key={email}
                  className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                      ★
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-800 truncate block">
                        {email}
                      </span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 inline-block mt-0.5">
                        মাস্টার সুপার অ্যাডমিন
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium shrink-0">
                    স্থায়ী
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 2: DYNAMIC ADMINS */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  যুক্ত করা শিক্ষক ও অ্যাডমিন তালিকা ({dynamicAdmins.length} জন)
                </h4>
              </div>
            </div>

            {dynamicAdmins.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
                <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  এখনো কোনো অতিরিক্ত অ্যাডমিন যুক্ত করা হয়নি
                </p>
                <p className="text-[11px] text-slate-400">
                  উপরের ফর্ম থেকে ইমেইল লিখে এক্সেস দিতে পারেন
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {dynamicAdmins.map((admin) => (
                  <div
                    key={admin.email}
                    className="p-4 bg-white hover:bg-slate-50/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-black text-xs shrink-0">
                        {admin.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {admin.email}
                          </span>
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                            সক্রিয়
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          যুক্ত করেছেন: <strong className="text-slate-600">{admin.addedBy}</strong> •{" "}
                          {admin.addedAt
                            ? new Date(admin.addedAt).toLocaleDateString("bn-BD")
                            : "পূর্বে"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={revokingEmail === admin.email}
                      onClick={() => handleRevoke(admin.email)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer self-end sm:self-auto shrink-0"
                      title="অ্যাডমিন এক্সেস বাতিল করুন"
                    >
                      {revokingEmail === admin.email ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <UserX className="w-3.5 h-3.5" />
                      )}
                      <span>এক্সেস বাতিল করুন</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Guide Card */}
          <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-xs text-indigo-950">
            <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 leading-relaxed">
              <p className="font-bold text-sm">💡 এটি কীভাবে কাজ করে?</p>
              <ul className="list-disc list-inside space-y-1 text-indigo-900/90 text-xs">
                <li>যাকে অ্যাডমিন করতে চান, তার <strong>Google একাউন্টের ইমেইল</strong> উপরের বক্সে লিখে এক্সেস দিন।</li>
                <li>এরপর তিনি <code>/admin</code> পেজে গিয়ে <strong>"Google দিয়ে সাইন ইন"</strong> করলেই সরাসরি পুরো শিক্ষক/অ্যাডমিন প্যানেল দেখতে পাবেন।</li>
                <li>যেকোনো সময় চাইলে আপনি এখান থেকে ১-ক্লিকেই তার এক্সেস বাতিল করে দিতে পারেন। কোনো ডিপ্লয়মেন্টের প্রয়োজন নেই।</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
