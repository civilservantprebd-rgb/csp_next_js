"use client";

import React from "react";
import { Brain,
  FileText,
  GraduationCap,
  BookOpen,
  BookMarked,
  Users,
  PlusCircle,
  Layers,
  BarChart3,
  Link2,
  Archive,
  Video,
  Newspaper,
  MessageCircle,
  Gift,
  ShieldCheck
} from "lucide-react";

export type AdminTabType =
  | "analytics"
  | "exams"
  | "courses"
  | "subjects"
  | "students"
  | "referrals"
  | "admins"
  | "questions"
  | "question_bank"
  | "videos"
  | "pdfs"
  | "archive"
  | "news"
  | "whatsapp"
  | "study_groups"
  | "ai_question_generator"
  | "attendance";

interface AdminNavProps {
  activeTab: AdminTabType;
  onTabChange: (tab: AdminTabType) => void;
}

export const AdminNav: React.FC<AdminNavProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: AdminTabType; label: string; icon: any; badge?: string }[] = [
    { id: "analytics", label: "অ্যানালিটিক্স", icon: BarChart3 },
    { id: "exams", label: "এক্সাম সেট", icon: FileText },
    { id: "courses", label: "কোর্স", icon: GraduationCap },
    { id: "subjects", label: "সাবজেক্ট", icon: BookOpen },
    { id: "pdfs", label: "পিডিএফ (এড / এডিট)", icon: BookMarked },
    { id: "question_bank", label: "টপিক ও ডাটাবেজ", icon: Layers },
    { id: "ai_question_generator", label: "Question Generator", icon: Brain },
    { id: "questions", label: "প্রশ্ন যোগ/এডিট", icon: PlusCircle },
    { id: "videos", label: "কোর্স ভিডিও", icon: Video },
    { id: "students", label: "আইডি ও রিকোয়েস্ট", icon: Users },
    { id: "referrals", label: "রেফারেল ও রিওয়ার্ড", icon: Gift },
    { id: "admins", label: "এডমিন এক্সেস", icon: ShieldCheck },
    { id: "news", label: "দৈনিক সংবাদ", icon: Newspaper },
    { id: "whatsapp", label: "WhatsApp লিংক", icon: MessageCircle },
    { id: "study_groups", label: "স্টাডি গ্রুপ মনিটর", icon: Users },
    { id: "attendance", label: "অ্যাটেনডেন্স", icon: Users },
    { id: "archive", label: "আর্কাইভ", icon: Archive },
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
            <Icon className={`h-4 w-4 shrink-0 ${
              isActive ? "text-indigo-600" : "text-slate-400"
            }`} />
            <span className="lg:truncate">{tab.label}</span>
            {tab.badge && (
              <span className="ml-auto text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded-md hidden lg:inline">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
};
