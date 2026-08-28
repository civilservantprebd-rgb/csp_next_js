"use client";

import React, { useState } from "react";
import {
  X,
  Shield,
  LogIn,
  UserPlus,
  Mail,
  Key,
  Eye,
  EyeOff,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail
} from "firebase/auth";
import { SubAdmin } from "@/types/exam";

interface TeacherLoginModalProps {
  isOpen: boolean;
  teacherPass?: string;
  subAdmins?: SubAdmin[];
  onClose: () => void;
  onLoginSuccess: (user: { email: string; role: "admin" | "subadmin" }) => void;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({
  isOpen,
  teacherPass = "1234",
  subAdmins = [],
  onClose,
  onLoginSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState("");
  const [showPinSection, setShowPinSection] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    setIsLoading(true);

    try {
      if (activeTab === "login") {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess({ email: userCred.user.email || "শিক্ষক", role: "admin" });
        onClose();
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        onLoginSuccess({ email: userCred.user.email || "শিক্ষক", role: "admin" });
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "অথেনটিকেশনে সমস্যা হয়েছে।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg("");
    setInfoMsg("");
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onLoginSuccess({
        email: result.user.displayName || result.user.email || "শিক্ষক",
        role: "admin",
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "গুগল সাইন-ইনে সমস্যা হয়েছে।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      const input = prompt("আপনার নিবন্ধিত শিক্ষক ইমেইল এড্রেসটি দিন:");
      if (!input) return;
      setEmail(input);
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setInfoMsg(`আপনার ইমেইল (${email})-এ একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।`);
    } catch (err: any) {
      setErrorMsg(err.message || "পাসওয়ার্ড রিসেট লিংক পাঠাতে সমস্যা হয়েছে।");
    }
  };

  const handlePinLogin = () => {
    setErrorMsg("");
    if (!pin.trim()) {
      setErrorMsg("দয়া করে পিন বা পাসওয়ার্ড দিন।");
      return;
    }

    if (pin.trim() === teacherPass) {
      onLoginSuccess({ email: "প্রধান এডমিন (পিন)", role: "admin" });
      onClose();
      return;
    }

    const matched = subAdmins.find((s) => s.pass === pin.trim());
    if (matched) {
      onLoginSuccess({ email: matched.name, role: "subadmin" });
      onClose();
      return;
    }

    setErrorMsg("প্রদত্ত পিন বা পাসওয়ার্ডটি সঠিক নয়।");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-bengali">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 relative border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-1">
          <div className="bg-indigo-50 text-indigo-600 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-2 text-2xl shadow-inner border border-indigo-100">
            <Shield className="w-7 h-7" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">
            {activeTab === "login" ? "শিক্ষক প্যানেল লগইন" : "নতুন শিক্ষক রেজিস্ট্রেশন"}
          </h3>
          <p className="text-xs text-slate-500">Firebase Authentication দ্বারা সুরক্ষিত এক্সেস</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setActiveTab("login");
              setErrorMsg("");
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "login"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <LogIn className="w-4 h-4" /> লগইন
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("signup");
              setErrorMsg("");
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === "signup"
                ? "bg-white text-indigo-700 shadow-sm font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserPlus className="w-4 h-4" /> সাইন আপ
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="p-3 rounded-xl text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-indigo-500" /> ইমেইল এড্রেস
            </label>
            <input
              type="email"
              required
              placeholder="teacher@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-slate-50/50"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-indigo-500" /> পাসওয়ার্ড
              </label>
              {activeTab === "login" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-slate-50/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
              </>
            ) : activeTab === "login" ? (
              "লগইন করুন"
            ) : (
              "একাউন্ট তৈরি করুন"
            )}
          </button>
        </form>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-200" />
          <span className="flex-shrink mx-3 text-slate-400 text-xs font-semibold">অথবা</span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl transition text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Google দিয়ে প্রবেশ করুন
        </button>

        <div className="pt-2 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => setShowPinSection(!showPinSection)}
            className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium transition inline-flex items-center gap-1 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" /> সাব-এডমিন পাসওয়ার্ড / পিন দিয়ে প্রবেশ করুন
          </button>

          {showPinSection && (
            <div className="mt-3 p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-left">
              <label className="block text-[11px] font-semibold text-slate-600">সাব-এডমিন পাসওয়ার্ড / পিন</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="পিন দিন"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handlePinLogin}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-4 py-2 rounded-xl text-xs whitespace-nowrap transition cursor-pointer"
                >
                  প্রবেশ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
