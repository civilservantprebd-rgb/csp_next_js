-- ============================================================
-- BCS-One: লাইভ সাবমিশনের ডুপ্লিকেট cleanup + ইউনিক ইনডেক্স
-- Supabase Dashboard → SQL Editor → নিচের ৩টি অংশ ধাপে ধাপে Run করুন
--
-- নোট: submissions.id UUID টাইপের, তাই min(id) চলে না —
-- row_number() দিয়ে প্রথম সাবমিশন (submitted_at ও তারপর id অনুযায়ী)
-- চিহ্নিত করা হয় এবং বাকিগুলো মুছে ফেলা হয়।
-- ============================================================

-- ── ধাপ ১ (নিরাপদ, কিছু মুছে না): কতগুলো ডুপ্লিকেট আছে দেখুন ──────────
-- 0 rows = কোনো ডুপ্লিকেট নেই → সরাসরি ধাপ ৩ চালান।

select exam_key, student_id, count(*) as attempts
from public.submissions
where is_live_submission = true
group by exam_key, student_id
having count(*) > 1
order by attempts desc;

-- ── ধাপ ২ (মুছে ফেলে): প্রতি (exam_key, student_id)-এ প্রথম সাবমিশন
--    (সবচেয়ে আগের submitted_at; সমান হলে ছোট id) রেখে বাকিগুলো ডিলিট ────
-- আগের ধাপের রেজাল্ট দেখে নিশ্চিত হয়ে তবেই Run করুন। undo করা যাবে না।

with ranked as (
  select id,
         row_number() over (
           partition by exam_key, student_id
           order by submitted_at asc, id asc
         ) as rn
  from public.submissions
  where is_live_submission = true
)
delete from public.submissions
where id in (select id from ranked where rn > 1);

-- ── ধাপ ৩: ইউনিক ইনডেক্স তৈরি (DB-লেভেল এক-বার-নিয়ম) ──────────────────
-- if not exists থাকায় বারবার Run করলেও নিরাপদ।

create unique index if not exists submissions_one_live_per_student
  on public.submissions (exam_key, student_id)
  where is_live_submission = true;