/**
 * সীমাহীন (unbounded) Supabase/PostgREST select-কে পৃষ্ঠা-পৃষ্ঠা করে আনা।
 *
 * ── সমস্যাটা যা এটা সমাধান করে ──
 * PostgREST একটি অনুরোধে **সর্বোচ্চ ১০০০ সারি** ফেরায় (Supabase-এর `max-rows`)।
 * এর বেশি হলে বাকি সারিগুলো **নীরবে বাদ পড়ে** — কোনো এরর আসে না, status 200-ই
 * থাকে, শুধু `Content-Range` হেডারে `0-999/1041` দেখায়। তাই কোড যখন
 * `from("exam_questions_link").select(...)` লিখত, টেবিল ১০০০ ছাড়ানোর পর নতুন
 * সারিগুলো আর ফেরতই আসত না।
 *
 * ⚠️ `.limit(5000)` দিয়েও কাজ হয় না — ক্লায়েন্ট-সীমা যতই বড় হোক, সার্ভারের
 * `max-rows` (১০০০) আগে কাটে। ইচ্ছাকৃত বড় সীমাই লুকানো বাগ ডেকে আনে: কোড
 * পড়ে মনে হয় "সব আনছি", অথচ আসলে ১০০০।
 *
 * ── কীভাবে ব্যবহার করবেন ──
 * ```ts
 * const links = await fetchAllRows<LinkRow>((from, to) =>
 *   supabase
 *     .from("exam_questions_link")
 *     .select("exam_id, order_index, question_bank(id, q, opts, topic)")
 *     .range(from, to)
 * );
 * ```
 *
 * ── গুরুত্বপূর্ণ ──
 * পৃষ্ঠা মেলাতে সবসময় `ORDER BY` দিন (`.order(...)`)। না দিলে প্রতিটি পৃষ্ঠার
 * ক্রম বদলে যেতে পারে আর কিছু সারি দুইবার বা একবারও আসতে পারে।
 * (নিচের হেল্পার নিজে order বসায় না — কলারই জানে তার সঠিক ক্রম কোনটা।)
 *
 * নেটওয়ার্ক/টাইমআউটে ফেলে দেয় না: যতটুকু এসেছে সেটুকুই ফেরে, আর ত্রুটিও
 * নীরবে মেনে নেওয়া হয় — কারণ এই ফাংশনের কলাররা (কনফিগ, প্র্যাকটিস-পুল)
 * ফলব্যাক-সহ কাজ করে, পুরো পেজ ভেঙে পড়ার চেয়ে আংশিক ডেটা ভালো। তবে
 * `onError` দিলে আপনি লগ করতে পারেন।
 */

/** PostgREST-এর কার্যকর সীমা। এর বেশি চাওয়া বৃথা। */
export const SUPABASE_PAGE_SIZE = 1000;

/** অসীম লুপের বিরুদ্ধে নিরাপত্তা-সীমা (২০০ পৃষ্ঠা = ২ লাখ সারি)। */
const MAX_ROWS = 200_000;

interface PageResponse {
  data: unknown;
}

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResponse>,
  onError?: (err: unknown) => void
): Promise<T[]> {
  const out: T[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    let rows: T[];
    try {
      const { data } = await build(from, from + SUPABASE_PAGE_SIZE - 1);
      rows = (data || []) as T[];
    } catch (err) {
      // আংশিক ফল দিয়েই ফিরি — কলারের ফলব্যাক চালু থাকুক
      onError?.(err);
      break;
    }

    out.push(...rows);

    // অসম্পূর্ণ পৃষ্ঠা = শেষ পৃষ্ঠা
    if (rows.length < SUPABASE_PAGE_SIZE) break;
    if (out.length >= MAX_ROWS) break;
  }

  return out;
}

/**
 * যদি মোট সারির সংখ্যা জানা থাকে (count: "exact"), তাহলে সব পেজ একসাথে 
 * প্যারালালে কল করা যায়, যা অনেক দ্রুত।
 */
export async function fetchAllRowsParallel<T>(
  totalCount: number,
  build: (from: number, to: number) => PromiseLike<PageResponse>,
  onError?: (err: unknown) => void
): Promise<T[]> {
  if (totalCount <= 0) return [];
  
  const results: PageResponse[] = [];
  const BATCH_SIZE = 5; // ৫টি রিকোয়েস্ট একসাথে

  try {
    for (let from = 0; from < totalCount; from += SUPABASE_PAGE_SIZE * BATCH_SIZE) {
      const batchPromises: PromiseLike<PageResponse>[] = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const start = from + i * SUPABASE_PAGE_SIZE;
        if (start >= totalCount) break;
        batchPromises.push(build(start, start + SUPABASE_PAGE_SIZE - 1));
      }
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const out: T[] = [];
    for (const res of results) {
      if (res && res.data) {
        out.push(...(res.data as T[]));
      }
    }
    return out;
  } catch (err) {
    onError?.(err);
    return [];
  }
}
