"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  CheckCircle2,
  LogIn,
  AlertCircle,
  Loader2,
  BookOpen,
  Home,
  ShieldCheck,
  User
} from "lucide-react";
import { getGroupByInviteCode, joinStudyGroupByCode } from "@/actions/study-group-actions";
import { getLocalStudentUser, loginWithGoogle, StudentUser } from "@/lib/student-auth";
import { StudyGroup } from "@/types/study-group";
import { toBengaliDigits } from "@/lib/utils";

export default function JoinGroupPage() {
  const params = useParams();
  const router = useRouter();
  const code = Array.isArray(params?.code) ? params.code[0] : (params?.code as string);

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [studentUser, setStudentUser] = useState<StudentUser | null>(null);

  const [joining, setJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    // লোকালে লগইন করা স্টুডেন্ট আছে কি না চেক
    const user = getLocalStudentUser();
    if (user) {
      setStudentUser(user);
    }

    if (code) {
      getGroupByInviteCode(code).then((res) => {
        setLoading(false);
        if (res.success && res.group) {
          setGroup(res.group);
        } else {
          setErrorMsg(res.message || "গ্রুপটি খুঁজে পাওয়া যায়নি। লিংকটি সঠিক কি না পরীক্ষা করুন।");
        }
      });
    } else {
      setLoading(false);
      setErrorMsg("কোনো ইনভাইট কোড পাওয়া যায়নি।");
    }
  }, [code]);

  const handleJoin = async () => {
    if (!group) return;
    if (!studentUser?.uid) {
      setStatusMessage("গ্রুপে যুক্ত হতে দয়া করে প্রথমে Google দিয়ে সাইন ইন করুন।");
      return;
    }

    setJoining(true);
    setStatusMessage("");

    const clientStudent = {
      id: studentUser.uid,
      name: studentUser.name || "শিক্ষার্থী",
      email: studentUser.email || ""
    };

    const res = await joinStudyGroupByCode(code, clientStudent);
    setJoining(false);

    if (res.success) {
      if (res.alreadyJoined) {
        setAlreadyJoined(true);
      } else {
        setJoinSuccess(true);
      }
      setStatusMessage(res.message);
    } else {
      setStatusMessage(res.message);
    }
  };

  const handleGoogleLogin = async () => {
    if (typeof window !== "undefined") {
      await loginWithGoogle(undefined, window.location.pathname);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-bengali">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-slate-600 text-sm font-semibold">গ্রুপের তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  if (errorMsg || !group) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-bengali">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">লিংকটি সঠিক নয় বা মেয়াদোত্তীর্ণ</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{errorMsg}</p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition"
            >
              হোম পেজে ফিরে যান
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-slate-50 to-slate-100 flex items-center justify-center p-4 font-bengali">
      <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-lg shadow-indigo-100/50 space-y-6">
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-md shadow-indigo-200">
            <Users className="w-8 h-8" />
          </div>
          <span className="inline-block text-[11px] font-black tracking-wider uppercase px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
            স্টাডি গ্রুপ ইনভাইটেশন
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800">{group.name}</h1>
          <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5 font-semibold">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> কোর্স: {group.course}
          </p>
        </div>

        {/* Group Info Box */}
        {group.description && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center space-y-1.5">
            <p className="text-xs text-slate-600 font-medium leading-relaxed">{group.description}</p>
          </div>
        )}

        {/* Success or Already Joined State */}
        {joinSuccess || alreadyJoined ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-900 text-sm">{statusMessage}</h3>
              <p className="text-xs text-emerald-700 mt-1 font-medium">
                এখন থেকে আপনার দেওয়া পরীক্ষাগুলো এই স্টাডি গ্রুপের আওতায় শিক্ষকের কাছে ট্র্যাকিং হিসেবে জমা হবে।
              </p>
            </div>
            <div className="pt-2 flex justify-center">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
              >
                <Home className="w-4 h-4" />
                হোম পেজে যান
              </Link>
            </div>
          </div>
        ) : (
          /* Join Actions */
          <div className="space-y-4">
            {statusMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {statusMessage}
              </div>
            )}

            {studentUser ? (
              /* Already Logged In User */
              <div className="space-y-3">
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-500 font-semibold">আপনার অ্যাকাউন্ট:</p>
                    <p className="text-xs font-bold text-slate-800 truncate">{studentUser.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{studentUser.email || studentUser.uid}</p>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full shrink-0">
                    লগইন আছেন
                  </span>
                </div>

                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-sm font-bold shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  {joining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> যুক্ত হচ্ছে...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" /> এই গ্রুপে যুক্ত হোন
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Not Logged In - Only Google Sign In allowed */
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl space-y-1.5 text-left">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Google অ্যাকাউন্ট আবশ্যক</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                    গ্রুপে যুক্ত হতে এবং পরীক্ষার ফলাফল ট্র্যাক করতে আপনার Google অ্যাকাউন্ট দিয়ে সাইন ইন করতে হবে।
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-3.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-2xl text-xs sm:text-sm font-bold shadow-sm flex items-center justify-center gap-2.5 transition cursor-pointer hover:border-slate-400"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Google দিয়ে সাইন ইন করে যুক্ত হোন
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
