-- ============================================================
-- BCS-One: Update submissions answers column to jsonb
-- Supabase Dashboard → SQL Editor → Run
--
-- কেন দরকার:
-- সম্প্রতি (commit 8a7881a) question reordering সাপোর্ট করার জন্য
-- answers-কে flat array-এর বদলে `{ qid, ans }` অবজেক্ট হিসেবে সেভ করার
-- লজিক লেখা হয়েছে। কিন্তু ডেটাবেসের `answers` কলামটি `integer[]` থাকায়
-- `invalid input syntax for type integer` এরর হচ্ছে এবং উত্তরপত্র জমা
-- দেওয়া যাচ্ছে না।
--
-- এই মাইগ্রেশন পুরোনো integer অ্যারেগুলোকে JSON অ্যারেতে কনভার্ট করবে
-- এবং কলামের টাইপ `jsonb` করে দেবে, যাতে নতুন অবজেক্ট ফরম্যাট সেভ হতে পারে।
-- ============================================================

-- change the column type to jsonb, automatically converting existing arrays like {1,2,3} to [1,2,3]
alter table public.submissions 
  alter column answers type jsonb 
  using to_jsonb(answers);
