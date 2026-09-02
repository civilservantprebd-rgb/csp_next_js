-- ============================================================
-- BCS-One: student_mistakes + student_bookmarks (cross-device sync)
--
-- ভুল উত্তরের খাতা (mistake notebook) ও বুকমার্ক আগে শুধু browser-এর
-- localStorage-এ থাকত — তাই অন্য ডিভাইসে/ব্রাউজার ক্লিয়ার করলে হারিয়ে
-- যেত। এই টেবিল দুটি লগ-ইন করা স্টুডেন্টের জন্য সেই ডেটা সার্ভারে রাখে,
-- ফলে যেকোনো ডিভাইস থেকে একই অ্যাকাউন্টে ঢুকলে mistakes/bookmarks ফিরে পায়।
--
-- Supabase Dashboard → SQL Editor → পেস্ট করে Run করুন (বারবার Run করলেও ক্ষতি নেই)
-- ============================================================

create table if not exists public.student_mistakes (
  id          text not null,               -- ক্লায়েন্ট-জেনারেটেড আইডি (mistake_...)
  student_id  text not null,               -- সুপাবেজ সেশন uid (ক্যানোনিকাল মালিক)
  q           text not null,               -- প্রশ্নের লেখা
  opts        jsonb not null default '[]'::jsonb,   -- [ক, খ, গ, ঘ]
  correct     int  not null default 0,     -- সঠিক অপশন ইনডেক্স
  exp         text not null default '',    -- ব্যাখ্যা
  user_ans    int,                         -- শিক্ষার্থীর উত্তর (null = স্কিপ)
  exam_title  text not null default '',
  subject     text,
  topic       text,
  timestamp   text,                        -- ক্লায়েন্টের ISO টাইমস্ট্যাম্প
  created_at  timestamptz not null default now(),
  primary key (student_id, id)
);

create table if not exists public.student_bookmarks (
  id          text not null,               -- ক্লায়েন্ট-জেনারেটেড আইডি (bm_...)
  student_id  text not null,
  q           text not null,
  opts        jsonb not null default '[]'::jsonb,
  correct     int  not null default 0,
  exp         text not null default '',
  user_ans    int,
  exam_title  text not null default '',
  subject     text,
  topic       text,
  timestamp   text,
  created_at  timestamptz not null default now(),
  primary key (student_id, id)
);

-- কেবল সার্ভার অ্যাকশন (service role) পড়া/লেখা করতে পারবে —
-- RLS বাইপাস হয়, তাই ক্লায়েন্ট সরাসরি অন্য কারও ডেটা দেখতে পারবে না।
alter table public.student_mistakes enable row level security;
alter table public.student_bookmarks enable row level security;
-- (course_videos-এর মতো পলিসি লাগবে না — সব অ্যাক্সেস সার্ভার অ্যাকশনের মাধ্যমে যায়)
