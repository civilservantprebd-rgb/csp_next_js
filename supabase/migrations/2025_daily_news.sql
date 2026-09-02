-- দৈনিক সংবাদ (daily news) — হোম পেজের সংবাদ সেকশন ও পপআপের জন্য
-- একবারই Run করুন (Supabase SQL Editor-এ)
create table if not exists public.daily_news (
  id         uuid primary key default gen_random_uuid(),
  heading    text not null,
  body       text not null,
  created_at timestamptz default timezone('utc', now())
);

-- পড়ার সুবিধার্থে সর্বশেষ আগে
create index if not exists daily_news_created_idx on public.daily_news (created_at desc);
