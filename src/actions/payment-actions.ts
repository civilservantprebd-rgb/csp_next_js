"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher } from "@/lib/teacher-auth";

export async function getPaymentHistory() {
  await requireTeacher();
  const { data, error } = await supabase
    .from("payment_history")
    .select("*")
    .order("approved_at", { ascending: false });
  if (error) throw error;
  return data;
}