"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, MessageCircle, Facebook, Shield } from "lucide-react";

interface FooterProps {
  onOpenTeacherLogin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenTeacherLogin }) => {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "8801700000000";
  const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL || "https://facebook.com";

  return (
    <footer className="bg-slate-900 text-slate-300 mt-14 border-t border-slate-800 font-bengali">
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
        <div>
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="text-amber-400 font-bold">
              <GraduationCap className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-white">আরোহণ</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">সর্বস্বত্ব সংরক্ষিত © {new Date().getFullYear()}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href={`https://wa.me/${whatsappNumber}`}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition flex items-center gap-1.5 shadow-sm"
          >
            <MessageCircle className="w-4 h-4 text-emerald-400" /> WhatsApp
          </a>
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition flex items-center gap-1.5 shadow-sm"
          >
            <Facebook className="w-4 h-4 text-indigo-400" /> Facebook
          </a>
          {onOpenTeacherLogin ? (
            <button
              onClick={onOpenTeacherLogin}
              className="bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 px-3 py-1.5 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Shield className="w-4 h-4 text-amber-300" /> Teacher Panel
            </button>
          ) : (
            <Link
              href="/admin"
              className="bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 px-3 py-1.5 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Shield className="w-4 h-4 text-amber-300" /> Teacher Panel
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
};
