"use client";

import React, { useEffect, useState } from "react";
import { getMissedExamsReport, StudentMissedExams } from "@/actions/analytics-actions";
import { Loader2, Users, Filter } from "lucide-react";
import { toBengaliDigits } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";


export const AttendanceManager = ({ courses }: { courses: string[] }) => {
  const [data, setData] = useState<StudentMissedExams[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");

  const exportPDF = () => {
    const doc = new jsPDF();
    // Use a basic English font or default font. Bengali text might not render correctly in standard jsPDF without custom TTF fonts.
    // For now we will try to export basic data.
    
    doc.setFontSize(16);
    doc.text("Student Attendance & Analytics Report", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Filter: ${timeFilter !== "all" ? timeFilter : "All Time"} | Course: ${courseFilter !== "all" ? courseFilter : "All Courses"}`, 14, 23);

    const tableColumn = ["Name", "Available", "Taken", "Missed", "Attendance Rate (%)", "Avg Score (%)"];
    const tableRows = data.map(st => [
      st.studentName,
      String(st.totalAvailable),
      String(st.totalTaken),
      String(st.totalMissed),
      String(st.attendanceRate),
      String(st.averageScore || 0)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 8 }
    });

    doc.save("bcs_one_attendance_report.pdf");
  };

  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    // If custom is selected but dates are missing, don't fetch yet or fetch with 'all'
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
      <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">অ্যাটেনডেন্স ও মিসড এক্সাম ট্র্যাকার</h3>
            <p className="text-sm text-slate-500">স্টুডেন্টরা কতগুলো পরীক্ষা মিস করেছে তার বিস্তারিত</p>
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
            onClick={exportPDF}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700 transition"
          >
            PDF Download
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

      <div className="overflow-x-auto relative min-h-[300px]">
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
              <th className="py-3 px-4 font-bold text-center">অংশগ্রহণ করেছে</th>
              <th className="py-3 px-4 font-bold text-center text-rose-600">মিস করেছে</th>
              <th className="py-3 px-4 font-bold text-center text-emerald-600">উপস্থিতির হার</th>
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
              data.map((st) => (
                <tr key={st.studentId} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{st.studentName}</div>
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
                  <td className="py-3 px-4 text-center font-bold text-indigo-600">
                    {toBengaliDigits(st.averageScore || 0)}%
                  </td>
                  <td className="py-3 px-4 text-center text-xs text-slate-500 font-medium">
                    {st.lastActiveDate ? new Date(st.lastActiveDate).toLocaleDateString("en-GB") : "দেয়নি"}
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
      </div>
    </div>
  );
};
