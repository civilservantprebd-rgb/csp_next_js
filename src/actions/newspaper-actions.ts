"use server";

import { supabase } from "@/lib/supabase";
import { requireTeacher } from "@/lib/teacher-auth";

export interface NewspaperUpload {
  id: string;
  paperName: string;
  uploadDate: string;
  filePath: string;
  pageCount: number;
  status: "pending" | "processing" | "done" | "error" | string;
  error?: string | null;
  topNewsCount: number;
  editorialCount: number;
  createdAt: string;
  processedAt?: string | null;
}

export interface EditorialDigest {
  date: string;
  pdfUrl?: string | null;
  htmlUrl?: string | null;
  itemCount: number;
  papers: string[];
  entries: { title?: string; author?: string; paper?: string; section?: string }[];
  mode?: string | null;
  updatedAt?: string | null;
}

const UPLOADS_BUCKET = "paper-uploads";

function bdTodayStr(): string {
  const d = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function ensureUploadBucket(): Promise<void> {
  try {
    await supabase.storage.createBucket(UPLOADS_BUCKET, {
      public: false,
      fileSizeLimit: 52428800,
      allowedMimeTypes: ["application/pdf", "text/plain"]
    });
  } catch {
    // bucket আগে থেকে থাকলে নীরবে চলে
  }
}

const toUpload = (r: any): NewspaperUpload => ({
  id: String(r?.id || ""),
  paperName: String(r?.paper_name || ""),
  uploadDate: String(r?.upload_date || ""),
  filePath: String(r?.file_path || ""),
  pageCount: Number(r?.page_count ?? 0),
  status: String(r?.status || "pending"),
  error: r?.error != null ? String(r.error) : null,
  topNewsCount: Number(r?.top_news_count ?? 0),
  editorialCount: Number(r?.editorial_count ?? 0),
  createdAt: r?.created_at || "",
  processedAt: r?.processed_at || null
});

/** শিক্ষক: দিনের পত্রিকার ডিজিটাল (টেক্সট) PDF আপলোড — ফাইল Storage-এ, DB-তে ছোট মেটা */
export async function uploadNewspapers(
  paperName: string,
  uploadDate: string,
  formData: FormData
): Promise<{ success: boolean; message: string; uploaded: number; failures: { name: string; error: string }[] }> {
  try {
    await requireTeacher();
    const paper = String(paperName || "").trim();
    if (!paper) return { success: false, message: "পত্রিকার নাম লিখুন।", uploaded: 0, failures: [] };
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(uploadDate || "")) ? String(uploadDate) : bdTodayStr();

    const files = (formData.getAll("files") || []).filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { success: false, message: "কমপক্ষে একটি PDF ফাইল বাছাই করুন।", uploaded: 0, failures: [] };

    await ensureUploadBucket();

    let uploaded = 0;
    const failures: { name: string; error: string }[] = [];
    for (const file of files) {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
      if (!isPdf) {
        failures.push({ name: file.name || "অজানা ফাইল", error: "শুধু PDF ফাইল সমর্থিত।" });
        continue;
      }
      if (file.size > 40 * 1024 * 1024) {
        failures.push({ name: file.name || "অজানা ফাইল", error: "ফাইল ৪০MB-এর বেশি।" });
        continue;
      }
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        // ফাইল-নামে অক্ষর-ঝুঁকি এড়াতে নিরাপদ কী — আসল নাম DB-র paper_name-এ থাকে
        const key = `${date}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
        const { error: upErr } = await supabase.storage
          .from(UPLOADS_BUCKET)
          .upload(key, buf, { contentType: "application/pdf", upsert: false, cacheControl: "31536000" });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("newspaper_uploads").insert({
          paper_name: paper,
          upload_date: date,
          file_path: key,
          status: "pending"
        });
        if (insErr) {
          await supabase.storage.from(UPLOADS_BUCKET).remove([key]);
          throw insErr;
        }
        uploaded++;
      } catch (err) {
        failures.push({ name: file.name || "অজানা ফাইল", error: String((err as any)?.message || err).slice(0, 200) });
      }
    }

    if (uploaded === 0) return { success: false, message: "কোনো ফাইল আপলোড হয়নি — লগ দেখুন।", uploaded: 0, failures };
    return {
      success: true,
      message: `${uploaded}টি পত্রিকা আপলোড হয়েছে ✓ — প্রতিদিন রাত ০৩:০০-তে DeepSeek প্রসেস করবে।`,
      uploaded,
      failures
    };
  } catch (err) {
    console.error("uploadNewspapers error:", err);
    return {
      success: false,
      message: "আপলোড করতে সমস্যা হয়েছে (migration #২ চালানো আছে কি?)।",
      uploaded: 0,
      failures: []
    };
  }
}

/** শিক্ষক: আপলোড-তালিকা (স্ট্যাটাসসহ) */
export async function getNewspaperUploads(limit: number = 80): Promise<NewspaperUpload[]> {
  try {
    const { data, error } = await supabase
      .from("newspaper_uploads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(toUpload);
  } catch {
    return []; // migration চালানো না হলে খালি — ক্র্যাশ হবে না
  }
}

/** শিক্ষক: একটি আপলোড (ফাইল + রেকর্ড) মুছে ফেলা */
export async function deleteNewspaperUpload(id: string): Promise<{ success: boolean; message: string }> {
  try {
    await requireTeacher();
    const cleanId = String(id || "").trim();
    if (!cleanId) return { success: false, message: "রেকর্ড পাওয়া যায়নি।" };
    const { data: row } = await supabase.from("newspaper_uploads").select("file_path").eq("id", cleanId).maybeSingle();
    if (row?.file_path) {
      await supabase.storage.from(UPLOADS_BUCKET).remove([String(row.file_path)]);
    }
    const { error } = await supabase.from("newspaper_uploads").delete().eq("id", cleanId);
    if (error) throw error;
    return { success: true, message: "আপলোডটি মুছে ফেলা হয়েছে ✓" };
  } catch (err) {
    console.error("deleteNewspaperUpload error:", err);
    return { success: false, message: "মুছতে সমস্যা হয়েছে।" };
  }
}

/** সবার জন্য: দৈনিক সম্পাদকীয়-ডাইজেস্ট তালিকা (সর্বশেষ আগে) */
export async function getEditorialDigests(limit: number = 30): Promise<EditorialDigest[]> {
  try {
    const { data, error } = await supabase
      .from("editorial_digests")
      .select("digest_date, pdf_url, html_url, item_count, papers, entries, mode, updated_at")
      .order("digest_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((r: any) => ({
      date: String(r?.digest_date || ""),
      pdfUrl: r?.pdf_url != null ? String(r.pdf_url) : null,
      htmlUrl: r?.html_url != null ? String(r.html_url) : null,
      itemCount: Number(r?.item_count ?? 0),
      papers: Array.isArray(r?.papers) ? r.papers.map((p: any) => String(p)) : [],
      entries: Array.isArray(r?.entries) ? r.entries : [],
      mode: r?.mode != null ? String(r.mode) : null,
      updatedAt: r?.updated_at || null
    }));
  } catch {
    return []; // migration চালানো না হলে খালি
  }
}
