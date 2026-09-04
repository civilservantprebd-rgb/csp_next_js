-- ============================================================================
-- 2026_daily_news_automation.sql — "দৈনিক সংবাদ" অটোমেশনের জন্য (aarohon.com)
--
-- GitHub Actions (রাত ৩টা) থেকে আসা অটোমেটিক সংবাদের জন্য:
--   daily_news-এ সোর্স/ক্যাটাগরি/তারিখ/হাইলাইট কলাম + daily_news_digests টেবিল
--
-- ▶ Supabase Dashboard → SQL Editor → পুরো ফাইল পেস্ট করুন → Run
--   (বারবার Run করলেও কোনো ক্ষতি নেই — সব if not exists)
-- ============================================================================

-- ১) daily_news-এ নতুন কলাম (অটোমেটিক সংবাদ)
alter table public.daily_news add column if not exists source       text;
alter table public.daily_news add column if not exists source_url   text;
alter table public.daily_news add column if not exists category     text;
alter table public.daily_news add column if not exists news_date    date;
alter table public.daily_news add column if not exists is_highlight boolean not null default false;

-- তারিখ অনুযায়ী দ্রুত খোঁজ ও আর্কাইভ
create index if not exists daily_news_news_date_idx on public.daily_news (news_date desc);

-- ২) daily_news_digests — প্রতিদিনের ডাইজেস্ট মেটা (PDF/HTML লিংক + পরিসংখ্যান)
create table if not exists public.daily_news_digests (
  digest_date     date primary key,
  pdf_url         text,
  html_url        text,
  item_count      integer not null default 0,
  category_counts jsonb not null default '{}'::jsonb,
  sources         jsonb not null default '[]'::jsonb,
  highlights      jsonb not null default '[]'::jsonb,
  mode            text,
  created_at      timestamptz default timezone('utc', now()),
  updated_at      timestamptz default timezone('utc', now())
);

-- ৩) RLS: ডাইজেস্ট সবার পড়তে পারবে; লেখা শুধু service role (অটোমেশন/সার্ভার)
alter table public.daily_news_digests enable row level security;
drop policy if exists daily_news_digests_public_read on public.daily_news_digests;
create policy daily_news_digests_public_read
  on public.daily_news_digests
  for select
  using (true);

-- ৪) নোট: PDF/HTML ফাইলগুলো Supabase Storage-এ যায় — public bucket: "daily-news"
--     (bucket-টি অটোমেশনের প্রথম রানে নিজে থেকে তৈরি হয়ে যায়; আলাদা কিছু করতে হবে না)
