export interface StudentUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}

/**
 * Handle Google Sign-In and persist session using Supabase OAuth
 * @param targetExamId — if set, the exam auto-starts after login (stored as an intent)
 * @param redirectPath — if set (and no exam intent), the user returns to this path after login
 */
export async function loginWithGoogle(targetExamId?: string, redirectPath?: string): Promise<StudentUser | null> {
  try {
    if (typeof window !== "undefined" && targetExamId) {
      sessionStorage.setItem("target_exam_intent", targetExamId);
    }
    if (typeof window !== "undefined" && redirectPath) {
      sessionStorage.setItem("auth_redirect", redirectPath);
    }

    // ইউজারের বর্তমান অরিজিন (যেমন: https://aarohon.com বা http://localhost:3000) ডায়নামিকালি রিডাইরেক্ট ইউআরএল হিসেবে ব্যবহার হবে
    const siteUrl = typeof window !== "undefined"
      ? window.location.origin
      : "https://aarohon.com";

    // Lazy-load the Supabase client only when auth is actually used,
    // so the 180KB SDK never ships in the home page's initial bundle
    const { supabase } = await import("./supabase");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: siteUrl
      }
    });

    if (error) throw error;
    return null;
  } catch (err) {
    console.error("Google login error:", err);
    return null;
  }
}

/**
 * Get locally stored student user session
 */
export function getLocalStudentUser(): StudentUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("bcs_student_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Update the locally stored student name
 */
export function updateLocalStudentName(name: string): StudentUser | null {
  const user = getLocalStudentUser();
  if (!user) return null;
  user.name = name;
  localStorage.setItem("bcs_student_user", JSON.stringify(user));
  return user;
}

/**
 * Log out student and clear session
 */
export async function logoutStudentUser(): Promise<void> {
  try {
    const { supabase } = await import("./supabase");
    await supabase.auth.signOut();
    localStorage.removeItem("bcs_student_user");
    sessionStorage.removeItem("current_student");
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.error("Logout error:", err);
  }
}
