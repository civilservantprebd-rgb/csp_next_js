import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "BCS One is missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.local.example)."
  );
}

// Use service role on server side to bypass RLS, fallback to anon key on client side
if (typeof window === "undefined" && !supabaseServiceKey) {
  console.error(
    "[BCS One] SUPABASE_SERVICE_ROLE_KEY is not set on the server — the RLS-protected " +
      "course_videos table (no policies) will DENY every query, so videos appear " +
      "unavailable. Set it in .env.local (see .env.local.example)."
  );
}
export const supabase = createClient(
  supabaseUrl,
  (typeof window === "undefined" && supabaseServiceKey) ? supabaseServiceKey : supabaseAnonKey,
  {
    auth: {
      persistSession: typeof window !== "undefined"
    },
    // ── Next.js-এর Data Cache বন্ধ ──
    // ⚠️ এটি একটা আসল বাগের সমাধান, সাজসজ্জা নয়। Next.js সার্ভারে `fetch`-কে
    // প্যাচ করে GET রেসপন্স ক্যাশ করে, আর supabase-js ভেতরে `fetch`-ই ব্যবহার করে।
    // ফলে **লেখার পরে পড়া পুরোনো ডেটা ফিরিয়ে দিত**: ২০২৬-০৯-১৬ রাতে
    // `/api/reads`-এ প্রশ্ন "পড়া হয়েছে" চিহ্নিত করা হচ্ছিল (insert সফল, সার্ভার
    // ১টি সারি ফেরাত), কিন্তু পরের GET তবু আগের তালিকাই দেখাত — ব্যবহারকারীর কাছে
    // "চিহ্ন বসছে না" মনে হত। ওয়েব অ্যাপে ধরা পড়েনি, কারণ ওখানে `read-store.ts`
    // localStorage-এ আলাদা কপি রাখে; API পথে (অ্যাপ) সেটা নেই।
    // `cache: "no-store"` = প্রতিটি ক্যোয়ারি সত্যিই ডেটাবেজে যায়। ব্যবহারকারী-ভিত্তিক
    // ডেটায় ক্যাশ কোনো লাভই দিত না — কেবল ভুল দেখাত।
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" })
    }
  }
);

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(async (event, session) => {
    // Sync the access token into a cookie so server actions can verify identity server-side.
    // Max-Age is aligned with the ~1h token lifetime so server actions never trust a stale token.
    if (session?.access_token) {
      document.cookie = `sb_access_token=${session.access_token}; path=/; SameSite=Lax; Max-Age=3600${window.location.protocol === "https:" ? "; Secure" : ""}`;
    } else {
      document.cookie = "sb_access_token=; path=/; SameSite=Lax; Max-Age=0";
    }

    // If teacher is logged in, do NOT treat the auth session as a student session
    const isTeacherLoggedIn = sessionStorage.getItem("teacher_user");
    if (isTeacherLoggedIn) {
      return;
    }

    if (session?.user) {
      // Ensure we have a valid metadata name or it's not a teacher-like account
      const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || "নামহীন শিক্ষার্থী";
      const email = session.user.email || "";
      const photoURL = session.user.user_metadata?.avatar_url || "";

      const studentUser = {
        uid: session.user.id,
        name: name,
        email: email,
        photoURL: photoURL
      };
      localStorage.setItem("bcs_student_user", JSON.stringify(studentUser));
      window.dispatchEvent(new Event("storage"));

      // Sync student profile safely on client transition
      if (typeof window !== "undefined") {
        setTimeout(async () => {
          try {
            const { syncStudentLogin } = await import("@/actions/student-actions");
            await syncStudentLogin({
              uid: session.user.id,
              name: name,
              email: email,
              photoURL: photoURL
            });
          } catch (err) {
            // Silently ignore during initial hydration
          }
        }, 100);
      }
    } else if (event === "SIGNED_OUT") {
      localStorage.removeItem("bcs_student_user");
      window.dispatchEvent(new Event("storage"));
    }
  });
}
