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

export const AdminNav: React.FC<AdminNavProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: AdminTabType; label: string; icon: any }[] = [
    { id: "analytics", label: "অ্যানালিটিক্স", icon: BarChart3 },
    { id: "question_bank", label: "টপিক ও ডাটাবেজ", icon: Layers },
    { id: "exams", label: "এক্সাম সেট", icon: FileText },
    { id: "courses", label: "কোর্স", icon: GraduationCap },
    { id: "subjects", label: "সাবজেক্ট", icon: BookOpen },
    { id: "students", label: "আইডি ও রিকোয়েস্ট", icon: Users },
    { id: "questions", label: "প্রশ্ন যোগ/এডিট", icon: PlusCircle },
    { id: "videos", label: "কোর্স ভিডিও", icon: Video },
    { id: "news", label: "দৈনিক সংবাদ", icon: Newspaper },
    { id: "whatsapp", label: "WhatsApp গ্রুপ", icon: MessageCircle },
    { id: "archive", label: "আর্কাইভ", icon: Archive },
    { id: "drivelinks", label: "রুটিন ও সিলেবাস", icon: Link2 },
  ];

  const visibleTabs = tabs;

  return (
    <div className="flex border-b border-slate-200 space-x-1 sm:space-x-2 overflow-x-auto pb-px font-bengali">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`py-2 px-3 sm:px-4 font-medium text-xs sm:text-sm whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer border-b-2 ${isActive
                ? "border-indigo-600 text-indigo-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <Icon className="w-4 h-4" /> {tab.label}
          </button>
        );
      })}
    </div>
  );
};
