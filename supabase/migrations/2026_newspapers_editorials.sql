-- ============================================================================
-- 2026_newspapers_editorials.sql — "দৈনিক সম্পাদকীয়" + পত্রিকা আপলোড ব্যবস্থা
--
-- নীতি: পত্রিকার PDF ফাইল কখনো ডাটাবেজে রাখা হয় না — শুধু Supabase Storage-এ।
--        ডাটাবেজে রাখা হয় কেবল ছোট মেটা (কোন ফাইল আপলোড হয়েছে / কোন দিনের
--        সম্পাদকীয়-ডাইজেস্ট কোথায় আছে) — যেন ডাটাবেজে চাপ না পড়ে।
--
-- ▶ Supabase Dashboard → SQL Editor → পুরো ফাইল পেস্ট করুন → Run
--   (বারবার Run করলেও কোনো ক্ষতি নেই — সব if not exists)
-- ============================================================================

-- ১) পত্রিকা আপলোড-রেকর্ড (টিচার প্যানেল থেকে) — ফাইল Storage-এ, মেটা এখানে
create table if not exists public.newspaper_uploads (
  id             uuid primary key default gen_random_uuid(),
  paper_name     text not null,
  upload_date    date not null,
  file_path      text not null,          -- Storage path: paper-uploads/uploads/<date>/<ts>-<rand>.pdf
  page_count     integer not null default 0,
  status         text not null default 'pending',  -- pending | processing | done | error
  error          text,
  top_news_count integer not null default 0,
  editorial_count integer not null default 0,
  created_at     timestamptz default timezone('utc', now()),
  processed_at   timestamptz
);
create index if not exists newspaper_uploads_status_idx on public.newspaper_uploads (status, upload_date desc);
create index if not exists newspaper_uploads_date_idx on public.newspaper_uploads (upload_date desc);

-- ২) দৈনিক সম্পাদকীয়-ডাইজেস্ট (প্রতিদিন একটি) — সম্পূর্ণ লেখা PDF/HTML-এ (Storage), মেটা এখানে
create table if not exists public.editorial_digests (
  digest_date  date primary key,
  pdf_url      text,
  html_url     text,
  item_count   integer not null default 0,
  papers       jsonb not null default '[]'::jsonb,
  entries      jsonb not null default '[]'::jsonb,   -- [{title, author, paper, section}]
  mode         text,
  created_at   timestamptz default timezone('utc', now()),
  updated_at   timestamptz default timezone('utc', now())
);

-- ৩) Storage buckets (অটোমেশন/সার্ভার অ্যাকশন প্রথম ব্যবহারে নিজে তৈরি করে নেয়):
--    - paper-uploads  : প্রাইভেট — টিচারের আপলোড করা PDF ও প্রসেস করা টেক্সট
--    - editorials     : পাবলিক — সম্পাদকীয় ডাইজেস্ট PDF/HTML (সবাই পড়তে পারবে)
