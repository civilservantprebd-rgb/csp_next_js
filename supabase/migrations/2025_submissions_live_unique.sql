-- ============================================================
-- BCS-One: এক লাইভ পরীক্ষায় একজন স্টুডেন্টের একটিমাত্র অফিসিয়াল সাবমিশন
-- Supabase Dashboard → SQL Editor → Run (একবারই চালান)
--
-- check-then-insert রেস (TOCTOU) বন্ধ করতে DB-লেভেল ইউনিক গ্যারান্টি:
-- is_live_submission = true হলে (exam_key, student_id) জোড়া শুধু একবারই
-- থাকতে পারবে। দ্বিতীয় কনকারেন্ট ইনসার্ট 23505 এরর পাবে — অ্যাপ সেটাকে
-- "ইতিমধ্যে অংশগ্রহণ করেছেন" হিসেবে দেখায় (exam-actions.ts)।
-- ============================================================

create unique index if not exists submissions_one_live_per_student
  on public.submissions (exam_key, student_id)
  where is_live_submission = true;