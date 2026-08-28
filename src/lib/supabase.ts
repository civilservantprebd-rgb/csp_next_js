import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://braytjbujysjydxbuqhv.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service role on server side to bypass RLS, fallback to anon key on client side
export const supabase = createClient(
  supabaseUrl,
  (typeof window === "undefined" && supabaseServiceKey) ? supabaseServiceKey : supabaseAnonKey,
  {
    auth: {
      persistSession: typeof window !== "undefined"
    }
  }
);
