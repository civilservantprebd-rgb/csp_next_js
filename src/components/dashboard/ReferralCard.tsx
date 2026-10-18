"use client";

import React, { useState, useEffect } from "react";
import { Share2, Users, Gift, Copy, Check, Sparkles, Smartphone, CheckCircle2, Clock } from "lucide-react";
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
    const text = `বিসিএস ও সরকারি চাকরির সেরা মডেল টেস্ট প্ল্যাটফর্ম 'আরোহণ'-এ এনরোল করার সময় আমার রেফারেল কোড "${referralCode}" ব্যবহার করলেই পাচ্ছেন ৫০ টাকা সরাসরি ছাড়! লিংক: ${shareUrl}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "আরোহণ — রেফারেল অফার",
          text: text,
          url: shareUrl,
        });
      } catch (e) {
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
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-violet-950 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-indigo-500/20 relative overflow-hidden font-bengali">
      {/* Decorative Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-violet-500/20 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-indigo-500/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-500 p-0.5 shadow-lg shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
              <Gift className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                বন্ধুকে রেফার করুন ও রিওয়ার্ড জিতুন
              </h3>
              <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400/30">
                <Sparkles className="w-3 h-3" /> ৫০ টাকা অফার
              </span>
            </div>
            <p className="text-xs text-indigo-200 mt-0.5">
              আপনার রেফারেল কোড ব্যবহার করে বন্ধু এনরোল করলেই তিনি পাবেন ৫০ টাকা ছাড় এবং আপনি পাবেন ৫০ টাকা রিওয়ার্ড!
            </p>
          </div>
        </div>
      </div>

      {/* Referral Code Box & Share Action */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm">
          <p className="text-xs font-semibold text-indigo-200 mb-1.5">আপনার ব্যক্তিগত রেফারেল কোড:</p>
          <div className="flex items-center justify-between bg-slate-950/60 border border-indigo-400/30 rounded-xl px-3 py-2">
            <span className="font-mono text-base sm:text-lg font-black tracking-wider text-amber-400">
              {loading ? "লোড হচ্ছে..." : referralCode || "BCS-REF"}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!referralCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
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

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 px-4 rounded-2xl shadow-lg shadow-amber-500/20 transition cursor-pointer text-xs sm:text-sm active:scale-[0.98]"
          >
            <Share2 className="w-4 h-4" />
            <span>বন্ধুদের সাথে শেয়ার করুন</span>
          </button>
        </div>
      </div>

      {/* bKash Number Setting Card */}
      <div className="mt-4 bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-indigo-950/40 border border-pink-500/20 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-4 h-4 text-pink-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white">টাকা পাওয়ার বিকাশ নাম্বার:</span>
                <span className="text-[10px] bg-pink-500/20 text-pink-300 font-bold px-2 py-0.5 rounded-full border border-pink-500/30">
                  bKash Personal
                </span>
              </div>
              <p className="text-[11px] text-pink-200/80 mt-0.5">
                আপনার রেফারেল রিওয়ার্ড শিক্ষক এই বিকাশ নাম্বারে পাঠিয়ে দিবেন।
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveBkash} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="tel"
              placeholder="017xxxxxxxx"
              value={bkashNumber}
              onChange={(e) => setBkashNumber(e.target.value)}
              className="bg-slate-950/80 border border-pink-400/30 text-white placeholder-slate-500 text-xs sm:text-sm px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 flex-1 sm:w-44 font-mono"
            />
            <button
              type="submit"
              disabled={savingBkash}
              className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition shadow-md shadow-pink-600/30 disabled:opacity-50 shrink-0 cursor-pointer active:scale-95"
            >
              {savingBkash ? "সেভ হচ্ছে..." : "সংরক্ষণ"}
            </button>
          </form>
        </div>

        {bkashMsg && (
          <p className={`mt-2 text-[11px] font-bold ${bkashMsg.type === "success" ? "text-emerald-400" : "text-rose-400"}`}>
            {bkashMsg.text}
          </p>
        )}
      </div>

      {/* Referral Stats Counters - 4 Columns */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <p className="text-[11px] text-indigo-200 font-medium">মোট রেফারেল</p>
          <p className="text-base sm:text-xl font-black text-white mt-0.5">
            {profile ? toBengaliDigits(profile.totalReferrals) : "০"}টি
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <p className="text-[11px] text-emerald-300 font-medium">সফল এনরোল</p>
          <p className="text-base sm:text-xl font-black text-emerald-400 mt-0.5">
            {profile ? toBengaliDigits(profile.completedReferrals) : "০"}টি
          </p>
        </div>
        <div className="bg-white/5 border border-emerald-500/20 bg-emerald-950/20 rounded-2xl p-3">
          <p className="text-[11px] text-emerald-300 font-medium">পরিশোধিত (পেয়েছেন)</p>
          <p className="text-base sm:text-xl font-black text-emerald-400 mt-0.5">
            ৳{profile ? toBengaliDigits(profile.paidEarnings) : "০"}
          </p>
        </div>
        <div className="bg-white/5 border border-amber-500/20 bg-amber-950/20 rounded-2xl p-3">
          <p className="text-[11px] text-amber-300 font-medium">পরিশোধ বাকি (বকেয়া)</p>
          <p className="text-base sm:text-xl font-black text-amber-400 mt-0.5">
            ৳{profile ? toBengaliDigits(profile.unpaidEarnings) : "০"}
          </p>
        </div>
      </div>

      {/* Referral History Details */}
      {profile && profile.referrals && profile.referrals.length > 0 && (
        <div className="mt-5 pt-5 border-t border-indigo-500/20">
          <h4 className="text-xs font-bold text-indigo-200 mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> রেফারেলকৃত সহপাঠীদের তালিকা ({toBengaliDigits(profile.referrals.length)})
          </h4>
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {profile.referrals.map((ref) => {
              const isPaid = ref.paymentStatus === "paid";
              return (
                <div
                  key={ref.id}
                  className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{ref.referredUserName}</p>
                    <p className="text-[11px] text-indigo-300 truncate">
                      কোর্স: {ref.course} | {formatBangladeshClock(ref.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {ref.status === "completed" ? (
                      isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> বিকাশে পরিশোধিত (+৳{toBengaliDigits(ref.rewardAmount)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Clock className="w-3 h-3 text-amber-400" /> পরিশোধ অপেক্ষমান (+৳{toBengaliDigits(ref.rewardAmount)})
                        </span>
                      )
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
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

