"use client";

import React, { useState, useEffect } from "react";
import { getPaymentHistory } from "@/actions/payment-actions";
import { Loader2, DollarSign, Search, Calendar } from "lucide-react";
import { formatBangladeshDate } from "@/lib/utils";

export const PaymentHistoryUI = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const data = await getPaymentHistory();
      setPayments(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = payments.filter((p) => 
    (p.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.trx_id || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.student_uid || "").includes(search)
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          পেমেন্ট হিস্ট্রি
        </h2>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="নাম বা TrxID দিয়ে খুঁজুন..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-500">
          কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">স্টুডেন্ট</th>
                  <th className="px-4 py-3 font-semibold">কোর্স</th>
                  <th className="px-4 py-3 font-semibold">পেমেন্ট</th>
                  <th className="px-4 py-3 font-semibold">TrxID/Coupon</th>
                  <th className="px-4 py-3 font-semibold">তারিখ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{p.student_name}</div>
                      <div className="text-xs text-slate-500">{p.student_email}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.student_uid}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {String(p.courses || "").split(",").map(c => c.trim()).filter(Boolean).map((c, i) => (
                          <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium border border-indigo-100">
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-emerald-600">{p.amount ? `৳${p.amount}` : "-"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.trx_id && <div className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded inline-block border border-amber-100">{p.trx_id}</div>}
                      {p.coupon && <div className="text-xs text-slate-600 mt-1">কুপন: <span className="font-semibold">{p.coupon}</span></div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {p.approved_at ? formatBangladeshDate(p.approved_at) : "-"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
