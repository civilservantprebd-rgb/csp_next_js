-- কোর্সের দাম ও ছাড় + পরিকল্পিত মোট পরীক্ষা/ভিডিও (একবারই Run করুন)
create table if not exists public.course_prices (
  course         text primary key,
  price          numeric,
  offer_price    numeric,
  planned_exams  integer,
  planned_videos integer
);

-- আগের ভার্সনের টেবিলে কলাম যোগ (if not exists)
alter table public.course_prices add column if not exists planned_exams  integer;
alter table public.course_prices add column if not exists planned_videos integer;