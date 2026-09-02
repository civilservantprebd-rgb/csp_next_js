"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Users,
  GraduationCap,
  FileCheck,
  HelpCircle,
  TrendingUp,
  Award,
  Layers,
  FolderPlus,
  RefreshCw,
  Loader2
} from "lucide-react";
import { getAdminAnalytics, AdminAnalyticsData } from "@/actions/analytics-actions";
import { toBengaliDigits } from "@/lib/utils";

export const AdminAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    setIsLoading(true);
    const res = await getAdminAnalytics();
    setData(res);
    setIsLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 gap-2 font-bengali text-xs">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        <span>অ্যানালিটিক্স ডাটা লোড হচ্ছে...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-400 text-xs font-bengali">
        ডাটা পাওয়া যায়নি।
      </div>
    );
  }

  const topExams = Object.entries(data.examSubmissionMap)
    .sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="space-y-6 font-bengali">
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-md">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
            রিয়েলটাইম ইনসাইটস
          </span>
          <h3 className="text-lg sm:text-xl font-black mt-1">অ্যাডমিন অ্যানালিটিক্স ও প্ল্যাটফর্ম স্ট্যাটাস</h3>
          <p className="text-xs text-indigo-200 mt-0.5">
            স্টুডেন্ট এনরোলমেন্ট, প্রশ্নভাণ্ডার এবং সাবমিশনের পূর্ণাঙ্গ পরিসংখ্যান
          </p>
        </div>

        <button
          type="button"
          onClick={loadStats}
          className="bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl border border-white/20 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>রিফ্রেশ করুন</span>
        </button>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">মোট অনুমোদিত শিক্ষার্থী</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-slate-900">{toBengaliDigits(data.totalStudents)} জন</h4>
          <p className="text-sm text-slate-400">অনুমোদিত আইডি ডাটাবেজ</p>
        </div>

        {/* Total Course Enrollments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">মোট কোর্স এনরোলমেন্ট</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-emerald-700">{toBengaliDigits(data.totalEnrollments)} টি</h4>
          <p className="text-sm text-slate-400">সকল কোর্স মিলিয়ে সর্বমোট এনরোল</p>
        </div>

        {/* Total Exam Submissions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">মোট পরীক্ষা সাবমিশন</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-purple-700">{toBengaliDigits(data.totalSubmissions)} বার</h4>
          <p className="text-sm text-slate-400">লাইভ ও প্র্যাকটিস মিলিয়ে</p>
        </div>

        {/* Total Question Bank Questions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">মোট প্রশ্ন ভাণ্ডার</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-amber-800">{toBengaliDigits(data.totalQuestionBankCount)} টি</h4>
          <p className="text-sm text-slate-400">বাল্ক ও সেন্ট্রাল প্রশ্ন মিলিয়ে</p>
        </div>
      </div>

      {/* Middle Section: Course Wise Enrollment (full width) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            কোর্স ভিত্তিক শিক্ষার্থী এনরোলমেন্ট
          </h4>
          <span className="text-sm font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
            {toBengaliDigits(Object.keys(data.courseEnrollmentMap).length)}টি কোর্স
          </span>
        </div>

        <div className="space-y-3">
          {Object.keys(data.courseEnrollmentMap).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">কোনো এনরোলমেন্ট ডাটা পাওয়া যায়নি।</p>
          ) : (
            Object.entries(data.courseEnrollmentMap).map(([courseName, count]) => {
              const percentage = data.totalEnrollments > 0
                ? Math.round((count / data.totalEnrollments) * 100)
                : 0;

              return (
                <div key={courseName} className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{courseName}</span>
                    <span className="font-black text-indigo-900">
                      {toBengaliDigits(count)} জন ({toBengaliDigits(percentage)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Section: Exam Submission Breakdown */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-600" />
            পরীক্ষা ভিত্তিক সাবমিশনের সংখ্যা (Exam Activity)
          </h4>
          <span className="text-sm font-bold bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full">
            মোট সাবমিশন: {toBengaliDigits(data.totalSubmissions)}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/80">
                <th className="p-3 font-bold rounded-l-xl">ক্রম</th>
                <th className="p-3 font-bold">পরীক্ষার নাম</th>
                <th className="p-3 font-bold">কোর্স</th>
                <th className="p-3 font-bold text-right rounded-r-xl">অংশগ্রহণ / সাবমিশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topExams.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-400">
                    কোনো সাবমিশন পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                topExams.map(([examKey, exInfo], idx) => (
                  <tr key={examKey} className="hover:bg-slate-50 transition">
                    <td className="p-3 text-slate-400 font-bold">{toBengaliDigits(idx + 1)}</td>
                    <td className="p-3 font-bold text-slate-900">{exInfo.title}</td>
                    <td className="p-3 text-slate-600">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200 text-xs font-medium">
                        {exInfo.course}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="bg-purple-100 text-purple-900 font-black px-2.5 py-1 rounded-lg text-xs">
                        {toBengaliDigits(exInfo.count)} বার
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
