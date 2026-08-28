import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc
} from "firebase/firestore";
import { EnrollmentRequest } from "@/types/student";
import { parseBengaliDigits } from "@/lib/utils";
import { getTrueDate } from "@/lib/bangladesh-time";

export async function submitEnrollRequest(payload: {
  uid: string;
  email: string;
  name: string;
  course: string;
  trxId: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (!payload.uid || !payload.name || !payload.trxId) {
      return { success: false, message: "দয়া করে সকল তথ্য সঠিকভাবে পূরণ করুন।" };
    }

    await addDoc(collection(db, "enroll_requests"), {
      id: payload.uid,
      email: payload.email,
      name: payload.name.trim(),
      course: payload.course,
      trxId: payload.trxId.trim().toUpperCase(),
      timestamp: getTrueDate().toISOString()
    });

    return {
      success: true,
      message: "আপনার এনরোলমেন্ট রিকোয়েস্ট জমা হয়েছে! শিক্ষক প্যানেল থেকে অনুমোদন দিলে পরীক্ষা দিতে পারবেন।"
    };
  } catch (err) {
    console.error("Submit enroll request error:", err);
    return { success: false, message: "রিকোয়েস্ট জমা দিতে সমস্যা হয়েছে।" };
  }
}

export async function getEnrollRequests(): Promise<EnrollmentRequest[]> {
  try {
    const snap = await getDocs(collection(db, "enroll_requests"));
    const requests: EnrollmentRequest[] = [];
    snap.forEach((d) => {
      requests.push({ docId: d.id, ...(d.data() as Omit<EnrollmentRequest, "docId">) });
    });
    return requests;
  } catch (err) {
    console.error("Fetch enroll requests error:", err);
    return [];
  }
}

export async function approveEnrollRequest(
  docId: string,
  uid: string,
  name: string,
  course: string,
  email?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanId = uid.trim();

    let existingCourses: string[] = [];
    const existingSnap = await getDoc(doc(db, "allowed_students", cleanId));
    if (existingSnap.exists()) {
      const exData = existingSnap.data();
      existingCourses = exData.courses || (exData.course ? [exData.course] : []);
    }

    const mergedCourses = Array.from(new Set([...existingCourses, course]));

    await setDoc(
      doc(db, "allowed_students", cleanId),
      {
        id: cleanId,
        name: name,
        email: email || "",
        courses: mergedCourses,
        approvedAt: getTrueDate().toISOString()
      },
      { merge: true }
    );

    if (docId) {
      await deleteDoc(doc(db, "enroll_requests", docId));
    }

    return { success: true, message: `${name} (${email || cleanId})-কে "${course}" কোর্সে অনুমোদন দেওয়া হয়েছে।` };
  } catch (err) {
    console.error("Approve enroll request error:", err);
    return { success: false, message: "অনুমোদনে সমস্যা হয়েছে।" };
  }
}
