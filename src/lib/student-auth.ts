import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "./firebase";

export interface StudentUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
}

/**
 * Handle Google Sign-In and persist session
 */
export async function loginWithGoogle(): Promise<StudentUser | null> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    const studentUser: StudentUser = {
      uid: user.uid,
      name: user.displayName || "নামহীন শিক্ষার্থী",
      email: user.email || "",
      photoURL: user.photoURL || ""
    };
    
    localStorage.setItem("bcs_student_user", JSON.stringify(studentUser));
    return studentUser;
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
    await signOut(auth);
    localStorage.removeItem("bcs_student_user");
  } catch (err) {
    console.error("Logout error:", err);
  }
}
