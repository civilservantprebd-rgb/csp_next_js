"use client";

import React, { useState, useEffect } from "react";
import {
  Share2,
  Users,
  Gift,
  Copy,
  Check,
  Sparkles,
  Smartphone,
  CheckCircle2,
  Clock,
  ArrowRight
} from "lucide-react";
import { getStudentReferralProfile, saveStudentBkashNumber } from "@/actions/referral-actions";
import { StudentReferralProfile } from "@/types/referral";
import { toBengaliDigits, formatBangladeshClock } from "@/lib/utils";

interface ReferralCardProps {
  studentId: string;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({ studentId }) => {
  const [profile, setProfile] = useState<StudentReferralProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareSupported, setShareSupported] = useState(false);

  // bKash number management state
  const [bkashNumber, setBkashNumber] = useState("");
  const [savingBkash, setSavingBkash] = useState(false);
  const [bkashMsg, setBkashMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setShareSupported(true);
    }

    if (!studentId) return;

    let isMounted = true;
    getStudentReferralProfile(studentId)
      .then((data) => {
        if (isMounted) {
          setProfile(data);
          if (data?.bkashNumber) {
            setBkashNumber(data.bkashNumber);
          }
        }
      })
      .catch((err) => console.error("Referral fetch error:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const referralCode = profile?.referralCode || "";
  const shareUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/?ref=${referralCode}` 
    : `https://arohon.app/?ref=${referralCode}`;

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleShare = async () => {
    const text = `বিসিএস ও সরকারি চাকরির সেরা মডেল টেস্ট প্ল্যাটফর্ম 'আরোহণ'-এ এনরোল করার সময় আমার রেফারেল কোড "${referralCode}" ব্যবহার করলেই পাচ্ছেন আকর্ষণীয় ছাড়! লিংক: ${shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "আরোহণ — রেফারেল অফার",
          text: text,
          url: shareUrl,
        });
      } catch {
        // user dismissed
      }
    } else {
      handleCopyCode();
    }
  };

  const handleSaveBkash = async (e: React.FormEvent) => {
    e.preventDefault();
    setBkashMsg(null);
    if (!bkashNumber.trim()) {
      setBkashMsg({ text: "দয়া করে বিকাশ নাম্বার লিখুন।", type: "error" });
      return;
    }
    setSavingBkash(true);
    try {
      const res = await saveStudentBkashNumber(studentId, bkashNumber);
      if (res.success) {
        setBkashMsg({ text: res.message, type: "success" });
        if (profile) {
          setProfile({ ...profile, bkashNumber: bkashNumber.trim() });
        }
      } else {
        setBkashMsg({ text: res.message, type: "error" });
      }
    } catch {
      setBkashMsg({ text: "বিকাশ নাম্বার সেভ করা সম্ভব হয়নি।", type: "error" });
    } finally {
      setSavingBkash(false);
    }
  };

  return (
    <div className="bg-white text-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xs border border-slate-200/80 font-bengali space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 text-indigo-600 shadow-xs">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                বন্ধুকে রেফার করুন ও রিওয়ার্ড জিতুন
              </h3>
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-amber-200/70 shadow-2xs">
                <Sparkles className="w-3 h-3 text-amber-600" /> রেফারেল অফার
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              আপনার রেফারেল কোড ব্যবহার করে বন্ধু এনরোল করলেই তিনি পাবেন কোর্স ফি-তে সরাসরি ছাড় এবং আপনি পাবেন রিওয়ার্ড ক্যাশব্যাক!
            </p>
          </div>
        </div>
      </div>

      {/* Referral Code Box & Share Action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-600 mb-2">আপনার ব্যক্তিগত রেফারেল কোড:</p>
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 shadow-2xs">
            <span className="font-mono text-base sm:text-lg font-black tracking-wider text-indigo-700">
              {loading ? "লোড হচ্ছে..." : referralCode || "BCS-REF"}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!referralCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-200" />
                  <span>কপি হয়েছে</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>কোড কপি</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 flex flex-col justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-900">সোশ্যাল মিডিয়ায় শেয়ার করুন</p>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              মেসেঞ্জার, হোয়াটসঅ্যাপ বা ফেসবুকে লিংকটি বন্ধুদের পাঠিয়ে দিন।
            </p>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer text-xs sm:text-sm active:scale-[0.99]"
          >
            <Share2 className="w-4 h-4 text-amber-400" />
            <span>বন্ধুদের সাথে শেয়ার করুন</span>
          </button>
        </div>
      </div>

      {/* bKash Number Setting Card */}
      <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-rose-200/70 flex items-center justify-center shrink-0 text-rose-600 shadow-2xs mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900">টাকা পাওয়ার বিকাশ নাম্বার:</span>
                <span className="text-[10px] bg-white text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200 shadow-2xs">
                  bKash Personal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                আপনার রেফারেল রিওয়ার্ডের টাকা এই বিকাশ নাম্বারে সেন্ডমানি বা পেমেন্ট করা হবে।
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveBkash} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="tel"
              placeholder="017xxxxxxxx"
              value={bkashNumber}
              onChange={(e) => setBkashNumber(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 flex-1 sm:w-44 font-mono shadow-2xs"
            />
            <button
              type="submit"
              disabled={savingBkash}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 shrink-0 cursor-pointer active:scale-95"
            >
              {savingBkash ? "সেভ হচ্ছে..." : "সংরক্ষণ"}
            </button>
          </form>
        </div>

        {bkashMsg && (
          <p className={`mt-2.5 text-[11px] font-bold ${bkashMsg.type === "success" ? "text-emerald-700" : "text-rose-700"}`}>
            {bkashMsg.text}
          </p>
        )}
      </div>

      {/* Referral Stats Counters - 4 Columns */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5">
          <p className="text-[11px] text-slate-500 font-semibold">মোট রেফারেল</p>
          <p className="text-base sm:text-xl font-black text-slate-900 mt-0.5">
            {profile ? toBengaliDigits(profile.totalReferrals) : "০"}টি
          </p>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-3.5">
          <p className="text-[11px] text-emerald-700 font-semibold">সফল এনরোল</p>
          <p className="text-base sm:text-xl font-black text-emerald-800 mt-0.5">
            {profile ? toBengaliDigits(profile.completedReferrals) : "০"}টি
          </p>
        </div>
        <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-3.5">
          <p className="text-[11px] text-indigo-700 font-semibold">পরিশোধিত (পেয়েছেন)</p>
          <p className="text-base sm:text-xl font-black text-indigo-900 mt-0.5">
            ৳{profile ? toBengaliDigits(profile.paidEarnings) : "০"}
          </p>
        </div>
        <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3.5">
          <p className="text-[11px] text-amber-800 font-semibold">পরিশোধ বাকি (বকেয়া)</p>
          <p className="text-base sm:text-xl font-black text-amber-900 mt-0.5">
            ৳{profile ? toBengaliDigits(profile.unpaidEarnings) : "০"}
          </p>
        </div>
      </div>

      {/* Referral History Details */}
      {profile && profile.referrals && profile.referrals.length > 0 && (
        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-600" /> রেফারেলকৃত সহপাঠীদের তালিকা ({toBengaliDigits(profile.referrals.length)})
          </h4>
          <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
            {profile.referrals.map((ref) => {
              const isPaid = ref.paymentStatus === "paid";
              return (
                <div
                  key={ref.id}
                  className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{ref.referredUserName}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      কোর্স: {ref.course} • {formatBangladeshClock(ref.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {ref.status === "completed" ? (
                      isPaid ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> বিকাশে পরিশোধিত (+৳{toBengaliDigits(ref.rewardAmount)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" /> পরিশোধ অপেক্ষমান (+৳{toBengaliDigits(ref.rewardAmount)})
                        </span>
                      )
                    ) : (
                      <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                        এনরোল অপেক্ষমান
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
