import { CoursePdfItem, CourseRoutineItem } from "@/types/pdf";
import { getAllPdfsAndRoutines } from "@/actions/pdf-actions";

export interface PdfRoutineStoreData {
  allPdfs: CoursePdfItem[];
  allRoutines: CourseRoutineItem[];
  timestamp: number;
}

let inMemoryCache: PdfRoutineStoreData | null = null;
let ongoingPromise: Promise<PdfRoutineStoreData> | null = null;
const listeners = new Set<(data: PdfRoutineStoreData) => void>();

const CACHE_KEY = "aarohon_pdf_routine_cache_v1";
const CACHE_TTL_MS = 60 * 1000; // 1 minute fresh TTL, then stale-while-revalidate

export function getCachedPdfRoutineData(): PdfRoutineStoreData | null {
  if (inMemoryCache) return inMemoryCache;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PdfRoutineStoreData;
        if (parsed && Array.isArray(parsed.allPdfs) && Array.isArray(parsed.allRoutines)) {
          inMemoryCache = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore JSON or localStorage errors
    }
  }
  return null;
}

export function subscribePdfRoutineStore(listener: (data: PdfRoutineStoreData) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function fetchPdfsAndRoutines(forceRefresh = false): Promise<PdfRoutineStoreData> {
  const cached = getCachedPdfRoutineData();
  const now = Date.now();

  // If cache is fresh and not forced, return immediately
  if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached;
  }

  // Deduplicate ongoing request
  if (ongoingPromise) {
    return ongoingPromise;
  }

  ongoingPromise = (async () => {
    try {
      const res = await getAllPdfsAndRoutines();
      const newData: PdfRoutineStoreData = {
        allPdfs: res.allPdfs || [],
        allRoutines: res.allRoutines || [],
        timestamp: Date.now(),
      };
      inMemoryCache = newData;

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
        } catch {
          // ignore quota errors
        }
      }

      listeners.forEach((fn) => fn(newData));
      return newData;
    } catch (err) {
      if (cached) return cached;
      throw err;
    } finally {
      ongoingPromise = null;
    }
  })();

  return ongoingPromise;
}

/**
 * Preload in background without blocking UI
 */
export function preloadPdfsAndRoutines(): void {
  if (typeof window === "undefined") return;
  const cached = getCachedPdfRoutineData();
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_TTL_MS) return;

  // Run in next idle tick
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => {
      fetchPdfsAndRoutines().catch(() => {});
    });
  } else {
    setTimeout(() => {
      fetchPdfsAndRoutines().catch(() => {});
    }, 200);
  }
}

/**
 * Transforms Google Drive /view links to /preview links.
 * Google Drive /preview is a lightweight PDF reader without heavy Google Drive workspace scripts,
 * making opening PDFs 3x-5x faster.
 */
export function optimizeDriveUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();

  // Match Google Drive file id: /file/d/{id}/... or id={id}
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  }

  const idQueryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idQueryMatch && idQueryMatch[1] && trimmed.includes("drive.google.com")) {
    return `https://drive.google.com/file/d/${idQueryMatch[1]}/preview`;
  }

  // Google Docs preview
  if (trimmed.includes("docs.google.com/document/d/")) {
    const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch && docMatch[1]) {
      return `https://docs.google.com/document/d/${docMatch[1]}/preview`;
    }
  }

  return trimmed;
}
