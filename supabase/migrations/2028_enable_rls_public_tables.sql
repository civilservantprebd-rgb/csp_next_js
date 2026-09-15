-- ============================================================
-- BCS-One: নিরাপত্তা হটফিক্স — RLS চালু + anon/authenticated থেকে লেখা বন্ধ
-- Supabase Dashboard → SQL Editor → Run (বারবার Run নিরাপদ — idempotent)
--
-- কেন দরকার:
-- এই চারটি টেবিল RLS ছাড়াই তৈরি হয়েছিল, অথচ পুরো রেপোতে একটি `create policy`-ও
-- নেই। RLS ছাড়া Supabase-এর ডিফল্ট table grant অনুযায়ী পাবলিক anon key দিয়েই
-- (যেটা ক্লায়েন্ট বান্ডেলে থাকে) যেকেউ সারি পড়তে, লিখতে ও মুছতে পারে।
--
--   • exam_attempt_starts → লিডারবোর্ড-যোগ্যতার একমাত্র প্রমাণ (exam-actions.ts
--     claimExamStart / submitExamAnswers)। anon লিখতে পারলে:
--       – নিজের start-রো DELETE করে একই পরীক্ষায় অসীমবার লিডারবোর্ডে ওঠা যায়
--       – পরীক্ষা খোলার আগেই ভিকটিমের student_id দিয়ে রো বসালে
--         (upsert ... ignoreDuplicates) তার আসল start বাদ পড়ে যায় → সে
--         চিরতরে লিডারবোর্ড থেকে বাদ পড়ে
--     → service_role ছাড়া কারও কোনো অধিকারই থাকা উচিত নয়।
--
--   • course_whatsapp → পেইড কোহর্টের ইনভাইট লিংক (একটি credential)।
--     → service_role ছাড়া কারও পড়ার অধিকারও থাকা উচিত নয়।
--
--   • course_prices / daily_news → আসলে পাবলিক তথ্য, কিন্তু লেখা কখনো নয়।
--     অ্যাপ এগুলো কেবল সার্ভার-অ্যাকশনে service_role দিয়ে লেখে
--     (course-actions.ts: requireTeacher(), news-actions.ts: requireTeacher())।
--     অথচ RLS ছাড়া `DELETE /rest/v1/daily_news?id=neq.0` দিয়ে খবর মুছে ফেলা যায়।
--     → পড়া থাকবে (SELECT policy + grant), লেখা সম্পূর্ণ বন্ধ।
--
-- প্রয়োগের পর যাচাই:
--   select relname, relrowsecurity from pg_class
--    where relname in ('exam_attempt_starts','course_prices',
--                      'course_whatsapp','daily_news');
--   -- চারটিতেই relrowsecurity = true হওয়া উচিত
-- ============================================================

-- ---------- ধাপ ১: RLS চালু + অপ্রয়োজনীয় table-grant প্রত্যাহার ----------
do $$
begin
  -- (ক) exam_attempt_starts — শুধু service_role
  if to_regclass('public.exam_attempt_starts') is not null then
    execute 'alter table public.exam_attempt_starts enable row level security';
    execute 'revoke all on table public.exam_attempt_starts from anon, authenticated';
  else
    raise notice 'exam_attempt_starts টেবিল নেই — 2026_exam_attempt_starts.sql আগে Run করুন';
  end if;

  -- (খ) course_whatsapp — শুধু service_role (ইনভাইট লিংক credential)
  if to_regclass('public.course_whatsapp') is not null then
    execute 'alter table public.course_whatsapp enable row level security';
    execute 'revoke all on table public.course_whatsapp from anon, authenticated';
  else
    raise notice 'course_whatsapp টেবিল নেই — 2025_course_whatsapp.sql আগে Run করুন';
  end if;

  -- (গ) course_prices — পড়া পাবলিক, লেখা বন্ধ
  if to_regclass('public.course_prices') is not null then
    execute 'alter table public.course_prices enable row level security';
    execute 'revoke insert, update, delete, truncate, references, trigger on table public.course_prices from anon, authenticated';
  else
    raise notice 'course_prices টেবিল নেই — 2025_course_prices.sql আগে Run করুন';
  end if;

  -- (ঘ) daily_news — পড়া পাবলিক, লেখা বন্ধ
  if to_regclass('public.daily_news') is not null then
    execute 'alter table public.daily_news enable row level security';
    execute 'revoke insert, update, delete, truncate, references, trigger on table public.daily_news from anon, authenticated';
  else
    raise notice 'daily_news টেবিল নেই — 2025_daily_news.sql আগে Run করুন';
  end if;
end $$;

-- ---------- ধাপ ২: যেগুলো সত্যিই পাবলিক, কেবল সেগুলোর SELECT policy ----------
-- (course_whatsapp ও exam_attempt_starts-এ কোনো policy নেই — RLS চালু থাকায়
--  policy না থাকলেই anon/authenticated-এর সব অ্যাক্সেস বন্ধ হয়ে যায়।)
do $$
begin
  if to_regclass('public.course_prices') is not null then
    execute 'drop policy if exists bcs_public_read_course_prices on public.course_prices';
    execute 'create policy bcs_public_read_course_prices on public.course_prices '
         || 'for select to anon, authenticated using (true)';
  end if;

  if to_regclass('public.daily_news') is not null then
    execute 'drop policy if exists bcs_public_read_daily_news on public.daily_news';
    execute 'create policy bcs_public_read_daily_news on public.daily_news '
         || 'for select to anon, authenticated using (true)';
  end if;
end $$;

-- ---------- ধাপ ৩: RLS-enabled কিন্তু policy-হীন টেবিলগুলোতে defense-in-depth ----------
-- course_videos, student_mistakes, student_bookmarks, student_read_questions
-- ইতিমধ্যেই RLS-enabled + policy-হীন (ইচ্ছাকৃত)। table-grant-ও প্রত্যাহার করে
-- রাখলে ভবিষ্যতে কেউ `disable row level security` করলেও ডেটা খুলে যাবে না।
do $$
declare
  t text;
begin
  foreach t in array array[
    'public.course_videos',
    'public.student_mistakes',
    'public.student_bookmarks',
    'public.student_read_questions'
  ]
  loop
    if to_regclass(t) is not null then
      execute format('alter table %s enable row level security', t);
      execute format('revoke all on table %s from anon, authenticated', t);
    else
      raise notice '% টেবিল নেই — সংশ্লিষ্ট মাইগ্রেশন আগে Run করুন', t;
    end if;
  end loop;
end $$;

-- ---------- ধাপ ৪: পুনরাবৃত্তি এড়াতে redundant index সরানো ----------
-- unique (exam_id, student_id) ইতিমধ্যেই ওই দুই কলামে btree ইনডেক্স বানায়;
-- exam_attempt_starts_exam_idx সম্পূর্ণ অপ্রয়োজনীয় (write amplification)।
drop index if exists public.exam_attempt_starts_exam_idx;
