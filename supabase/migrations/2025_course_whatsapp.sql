-- কোর্সভেদে WhatsApp গ্রুপ জয়েন লিংক (লগইন-পর একবার জয়েন প্রম্পটের জন্য)
-- একবারই Run করুন (Supabase SQL Editor-এ)
create table if not exists public.course_whatsapp (
  course     text primary key,
  link       text not null,
  updated_at timestamptz default timezone('utc', now())
);
