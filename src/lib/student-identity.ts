"use client";

/**
 * যাচাই-কৃত স্টুডেন্ট পরিচয় (localStorage-এ স্থায়ী)।
 *
 * একবার কোর্স/পোর্টালে সফলভাবে যাচাই হলে id/email এখানে থেকে যায় —
 * তাই পরের বার কোনো কোর্স পেজ খুললে আর আইডি টাইপ করতে হয় না।
 * মনে রাখবেন: এটা শুধু "কোন পরিচয়ে যাচাই করব" সেটা মনে রাখে —
 * অনুমতি (allowed/enrolled) কখনো ক্যাশে থাকে না, প্রতি রিকোয়েস্টে সার্ভারই চেক করে।
 */

export interface VerifiedStudent {
  id: string;
  name?: string;
  email?: string;
}

const KEY = "bcs_verified_student";

export function getVerifiedStudent(): VerifiedStudent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== "string" || !parsed.id) return null;
    return { id: parsed.id, name: parsed.name || undefined, email: parsed.email || undefined };
  } catch {
    return null;
  }
}

export function setVerifiedStudent(student: VerifiedStudent): void {
  if (typeof window === "undefined") return;
  if (!student || !student.id) return;
  // আগের email/name না থাকলে নতুন দিয়ে মিশিয়ে দিই
  const prev = getVerifiedStudent();
  localStorage.setItem(
    KEY,
    JSON.stringify({
      id: student.id,
      name: student.name || prev?.name || undefined,
      email: student.email || prev?.email || undefined
    })
  );
}

export function clearVerifiedStudent(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

/**
 * বর্তমান পরিচয়: Google লগইন থাকলে uid+email (সার্ভার কুকি দিয়েই চিনবে),
 * না থাকলে আগের যাচাই-কৃত ম্যানুয়াল আইডি। কোনোটা না থাকলে null।
 */
export function getLocalIdentity(): { id: string; email?: string; name?: string } | null {
  if (typeof window === "undefined") return null;

  // Google লগইন → uid পরিচয় (সার্ভার সেশনই প্রমাণ)
  try {
    const rawUser = localStorage.getItem("bcs_student_user");
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u && typeof u.uid === "string" && u.uid) {
        return { id: u.uid, email: u.email || undefined, name: u.name || undefined };
      }
    }
  } catch {
    // ignore
  }

  // ম্যানুয়াল যাচাই-কৃত আইডি
  return getVerifiedStudent();
}
