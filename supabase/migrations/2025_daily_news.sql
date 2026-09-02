-- দৈনিক সংবাদ (daily news) — হোম পেজের সংবাদ সেকশন ও পপআপের জন্য
-- একবারই Run করুন (Supabase SQL Editor-এ); বারবার Run করলেও কোনো ক্ষতি নেই
create table if not exists public.daily_news (
  id         uuid primary key default gen_random_uuid(),
  heading    text not null,
  body       text not null,
  created_at timestamptz default timezone('utc', now())
);

-- পড়ার সুবিধার্থে সর্বশেষ আগে
create index if not exists daily_news_created_idx on public.daily_news (created_at desc);

-- কতবার খুলে পড়া হয়েছে (admin প্যানেলে হেডিংয়ের সাথে দেখা যায়)
alter table public.daily_news add column if not exists read_count integer not null default 0;

-- ক্লায়েন্ট থেকে পড়া-কাউন্ট বাড়ানোর জন্য (রেস-কন্ডিশন-মুক্ত)
create or replace function public.increment_daily_news_read(row_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.daily_news
     set read_count = read_count + 1
   where id = row_id;
end;
$$;
