import { supabase } from "./supabase";

export interface StudentUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}

/**
 * Handle Google Sign-In and persist session using Supabase OAuth
 */
export async function loginWithGoogle(): Promise<StudentUser | null> {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) throw error;
    
    // Oauth redirects the browser, so we return null here. 
    // The onAuthStateChange listener in supabase.ts will automatically
    // pick up the session and set localStorage when redirected back.
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
    await supabase.auth.signOut();
    localStorage.removeItem("bcs_student_user");
    sessionStorage.removeItem("current_student");
    window.dispatchEvent(new Event("storage"));
  } catch (err) {
    console.error("Logout error:", err);
  }
}
