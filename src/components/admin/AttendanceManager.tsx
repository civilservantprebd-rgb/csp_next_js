"use client";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { getMissedExamsReport, StudentMissedExams } from "@/actions/analytics-actions";
import { Loader2, Users, Printer } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";

export const AttendanceManager = ({ courses }: { courses: string[] }) => {
  const [data, setData] = useState<StudentMissedExams[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  // reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  const totalPages = Math.ceil(data.length / itemsPerPage);

  const [courseFilter, setCourseFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");

  const handlePrint = () => {
    window.print();
  };

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    if (timeFilter === "custom" && (!customStart || !customEnd)) {
      return; 
    }

    let alive = true;
    setLoading(true);
    getMissedExamsReport(courseFilter, timeFilter, customStart, customEnd).then(res => {
      if (alive) {
        setData(res);
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, [courseFilter, timeFilter, customStart, customEnd]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden font-bengali">
      <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">অ্যাটেনডেন্স ট্র্যাকার</h3>
            <p className="text-sm text-slate-500">লাইভ পরীক্ষার বিস্তারিত উপস্থিতি</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select 
            value={courseFilter} 
            onChange={e => setCourseFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">সকল কোর্স</option>
            {courses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select 
            value={timeFilter} 
            onChange={e => setTimeFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="all">সব সময়</option>
            <option value="this_week">চলতি সপ্তাহ</option>
            <option value="this_month">চলতি মাস</option>
            <option value="last_month">গত মাস</option>
            <option value="custom">নির্দিষ্ট তারিখ</option>
          </select>

          <button 
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-slate-900 transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4" /> প্রিন্ট বা PDF
          </button>
          {timeFilter === "custom" && (
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={customStart} 
                onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <span className="text-slate-400">থেকে</span>
              <input 
                type="date" 
                value={customEnd} 
                onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
        </div>
      </div>

      <div id="printable-attendance" className="overflow-x-auto relative min-h-[300px] bg-white print:border-none print:shadow-none print:overflow-visible">
        
        {/* Print-only header */}
        <div className="hidden print:block text-center border-b border-slate-300 pb-4 mb-6 pt-2">
          <h1 className="text-3xl font-black text-slate-900">আরোহণ</h1>
          <p className="text-sm font-semibold text-slate-600 mt-1">হেল্পলাইন / হোয়াটসঅ্যাপ: 01577301529</p>
          <h2 className="text-xl font-bold text-slate-800 mt-4">অ্যাটেনডেন্স রিপোর্ট</h2>
          <p className="text-sm text-slate-500 mt-1">
            কোর্স: {courseFilter === 'all' ? 'সকল কোর্স' : courseFilter} | 
            সময়: {timeFilter === 'all' ? 'সব সময়' : timeFilter === 'this_week' ? 'চলতি সপ্তাহ' : timeFilter === 'this_month' ? 'চলতি মাস' : timeFilter === 'last_month' ? 'গত মাস' : (customStart && customEnd) ? `${customStart} থেকে ${customEnd}` : 'নির্দিষ্ট তারিখ'}
          </p>
        </div>
        {loading ? (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> লোড হচ্ছে...
          </div>
        ) : null}
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-sm text-slate-600">
              <th className="py-3 px-4 font-bold">নাম</th>
              <th className="py-3 px-4 font-bold">কোর্স</th>
              <th className="py-3 px-4 font-bold text-center">সর্বমোট পরীক্ষা</th>
              <th className="py-3 px-4 font-bold text-center">অংশগ্রহণ (লাইভ)</th>
              <th className="py-3 px-4 font-bold text-center text-rose-600">মিস (লাইভ)</th>
              <th className="py-3 px-4 font-bold text-center text-emerald-600">শতাংশ</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  কোনো তথ্য পাওয়া যায়নি।
                </td>
              </tr>
            ) : (
              data.map((st, idx) => (
                <tr key={st.studentId} className={`border-b border-slate-100 hover:bg-slate-50 transition ${idx >= (currentPage - 1) * itemsPerPage && idx < currentPage * itemsPerPage ? "table-row" : "hidden print:table-row"}`}>
                  <td className="py-3 px-4">
                    <Link href={`/admin/student/${encodeURIComponent(st.studentId)}`} className="font-bold text-indigo-600 hover:underline">
                      {st.studentName}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {st.courses.join(", ")}
                  </td>
                  <td className="py-3 px-4 text-center font-medium">
                    {toBengaliDigits(st.totalAvailable)}
                  </td>
                  <td className="py-3 px-4 text-center font-medium text-emerald-600">
                    {toBengaliDigits(st.totalTaken)}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-rose-600">
                    {toBengaliDigits(st.totalMissed)}
                  </td>
                  <td className="py-3 px-4 text-center text-sm">
                    <span className={`px-2 py-1 rounded-md font-bold ${
                      st.attendanceRate >= 80 ? "bg-emerald-100 text-emerald-700" :
                      st.attendanceRate >= 50 ? "bg-amber-100 text-amber-700" :
                      "bg-rose-100 text-rose-700"
                    }`}>
                      {toBengaliDigits(st.attendanceRate)}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Print-only footer */}
        <div className="hidden print:block text-center mt-10 pt-4 border-t border-slate-300 text-slate-500 font-medium">
          www.aarohon.com
        </div>
      </div>
      
      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl print:hidden bg-white shadow-sm mt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >
            পূর্ববর্তী
          </button>
          <span className="text-sm font-medium text-slate-600">
            পৃষ্ঠা {toBengaliDigits(currentPage)} / {toBengaliDigits(totalPages)}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
          >
            পরবর্তী
          </button>
        </div>
      )}
    </div>
  );
};
