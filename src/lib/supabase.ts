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

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    // If teacher is logged in, do NOT treat the auth session as a student session
    const isTeacherLoggedIn = sessionStorage.getItem("teacher_user");
    if (isTeacherLoggedIn) {
      return;
    }

    if (session?.user) {
      // Ensure we have a valid metadata name or it's not a teacher-like account
      const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || "নামহীন শিক্ষার্থী";
      
      const studentUser = {
        uid: session.user.id,
        name: name,
        email: session.user.email || "",
        photoURL: session.user.user_metadata?.avatar_url || ""
      };
      localStorage.setItem("bcs_student_user", JSON.stringify(studentUser));
      window.dispatchEvent(new Event("storage"));
    } else if (event === "SIGNED_OUT") {
      localStorage.removeItem("bcs_student_user");
      window.dispatchEvent(new Event("storage"));
    }
  });
}
