"use client";

import React from "react";
import {
  FileText,
  GraduationCap,
  BookOpen,
  Users,
  PlusCircle,
  Layers,
  BarChart3,
  Link2,
  Archive,
  Video,
  Newspaper,
  MessageCircle
} from "lucide-react";

export type AdminTabType =
  | "analytics"
  | "exams"
  | "courses"
  | "subjects"
  | "students"
  | "questions"
  | "question_bank"
  | "videos"
  | "archive"
  | "drivelinks"
  | "news"
  | "whatsapp";

interface AdminNavProps {
  activeTab: AdminTabType;
  onTabChange: (tab: AdminTabType) => void;
}

/**
 * অ্যাডমিন নেভিগেশন — **বাম দিকের খাড়া sidebar** (ডেস্কটপ/ট্যাবে), আর ছোট
 * স্ক্রিনে আগের মতোই উপর-নিচে হরাইজন্টাল স্ক্রলিং স্ট্রিপ।
 *
 * লেআউট বদলেছে, আচরণ নয়: ট্যাব-তালিকা, আইডি ও সিলেক্ট করার নিয়ম হুবহু আগের মতোই
 * (`activeTab` + `onTabChange`) — তাই বাকি প্যানেলের কিছু বদলাতে হয়নি।
 */
export const AdminNav: React.FC<AdminNavProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: AdminTabType; label: string; icon: any }[] = [
    { id: "analytics", label: "অ্যানালিটিক্স", icon: BarChart3 },
    { id: "question_bank", label: "টপিক ও ডাটাবেজ", icon: Layers },
    { id: "exams", label: "এক্সাম সেট", icon: FileText },
    { id: "courses", label: "কোর্স", icon: GraduationCap },
    { id: "subjects", label: "সাবজেক্ট", icon: BookOpen },
    { id: "students", label: "আইডি ও রিকোয়েস্ট", icon: Users },
    { id: "questions", label: "প্রশ্ন যোগ/এডিট", icon: PlusCircle },
    { id: "videos", label: "কোর্স ভিডিও", icon: Video },
    { id: "news", label: "দৈনিক সংবাদ", icon: Newspaper },
    { id: "whatsapp", label: "WhatsApp গ্রুপ", icon: MessageCircle },
    { id: "archive", label: "আর্কাইভ", icon: Archive },
    { id: "drivelinks", label: "রুটিন ও সিলেবাস", icon: Link2 },
  ];

  const visibleTabs = tabs;

  return (
    <nav
      aria-label="শিক্ষক প্যানেল মেনু"
      className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-x-visible lg:overflow-y-auto lg:pb-0"
    >
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium transition cursor-pointer sm:text-sm lg:w-full lg:justify-start lg:px-3.5 lg:py-2.5 ${
              isActive
                ? "bg-indigo-50 font-bold text-indigo-700 ring-1 ring-indigo-100"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-600" : "text-slate-400"}`} />
            <span className="lg:truncate">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
