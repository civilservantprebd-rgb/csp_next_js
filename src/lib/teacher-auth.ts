import { supabase } from "@/lib/supabase";

/**
 * Server-side teacher authorization helpers.
 *
 * The session token is synced into a cookie (`sb_access_token`) by
 * src/lib/supabase.ts on every auth state change, so server actions can
 * verify who is calling them instead of trusting client-side storage
 * (sessionStorage/localStorage can be forged with DevTools).
 *
 * A user counts as a "teacher" when ANY of these is true:
 *  1. app_metadata.role is "admin" or "teacher" (set in Supabase Dashboard:
 *     Authentication → Users → Edit user → app_metadata — server-only, cannot
 *     be forged by the user)
 *  2. email is listed in the TEACHER_EMAILS env var (comma-separated)
 *
 * NOTE: user_metadata is deliberately NOT trusted — the user can overwrite it
 * themselves via supabase.auth.updateUser(), so it must never grant admin.
 */

function getAccessTokenFromCookies(): string | null {
  try {
    // Dynamic import keeps this module server-only even if imported by a client bundle
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cookies } = require("next/headers") as typeof import("next/headers");
    return cookies().get("sb_access_token")?.value || null;
  } catch {
    return null;
  }
}

export async function getUserFromToken(token?: string | null) {
  if (!token) return null;
  try {
    const { data, error } = await Promise.race([
      supabase.auth.getUser(token),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 4000))
    ]);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    // timeout or network failure → treat as unauthenticated (never hang the UI)
    return null;
  }
}

function isTeacherEmail(email?: string): boolean {
  if (!email) return false;
  const allowed = (process.env.TEACHER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export function userIsTeacher(user: {
  app_metadata?: Record<string, unknown>;
  email?: string;
} | null): boolean {
  if (!user) return false;
  // Only app_metadata is trusted (set via Supabase Dashboard / admin API).
  // user_metadata can be self-edited by the user and must never grant admin.
  const role = user.app_metadata?.role;
  if (role === "admin" || role === "teacher") return true;
  return isTeacherEmail(user.email);
}

/** Returns the verified teacher (or null) for the current request. */
export async function getTeacherUser(token?: string | null): Promise<{ id: string; email?: string } | null> {
  const resolvedToken = token || getAccessTokenFromCookies();
  const user = await getUserFromToken(resolvedToken);
  if (!user) return null;
  if (!userIsTeacher(user)) return null;
  return { id: user.id, email: user.email };
}

/** Throws when the caller is not a verified teacher. Use in write/admin actions. */
export async function requireTeacher(): Promise<{ id: string; email?: string }> {
  const teacher = await getTeacherUser();
  if (!teacher) {
    throw new Error("Unauthorized: teacher access required");
  }
  return teacher;
}

/** Non-throwing variant. Use where a read may fall back to public access. */
export async function isTeacherSession(): Promise<boolean> {
  try {
    return !!(await getTeacherUser());
  } catch {
    return false;
  }
}
