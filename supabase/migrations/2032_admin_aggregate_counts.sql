-- ============================================================
-- BCS-One: অ্যাডমিন প্যানেলের জন্য সার্ভার-সাইড aggregate
-- Supabase Dashboard → SQL Editor → Run (বারবার Run নিরাপদ — idempotent)
--
-- কেন দরকার:
-- অ্যাডমিন প্যানেল আগে প্রতি পরীক্ষার প্রশ্নসংখ্যা আর টপিক-তালিকা বের করতে
-- **পুরো করপাস** (topic_questions + exam_questions_link + question_bank) ক্লায়েন্টে
-- নামাত — পরিমাপ করা গেছে: ~২ MB, ~১.৭ সেকেন্ড, প্রতিবার প্যানেল খুললে ও প্রতিবার
-- কিছু সেভ করার পরে।
--
-- এই দুটি ফাংশন সেই ডেটা ডেটাবেজেই গুছিয়ে দেয় — ফেরত আসে কয়েকশ বাইট:
--   • admin_exam_question_counts() → প্রতি পরীক্ষায় কতটি প্রশ্ন (GROUP BY)
--   • admin_topic_paths()          → টপিক-পাথের তালিকা (DISTINCT)
--
-- নিরাপত্তা:
--   • security invoker (ডিফল্ট) — ফাংশনের ভেতরে RLS/table-grant ঠিক আগের মতোই খাটে,
--     অর্থাৎ কোনো নতুন দরজা খোলে না।
--   • anon/authenticated থেকে EXECUTE প্রত্যাহার করা — শুধু সার্ভার (service_role)
--     ডাকে। টপিক-তালিকাও যাতে পাবলিক key দিয়ে গোনা না যায়।
--   • এই SQL না চালালেও অ্যাপ চলে — অ্যাকশনগুলো তখন ফলব্যাক পথ ব্যবহার করে
--     (admin-actions.ts: getExamQuestionCounts / getTopicTreeData)।
--
-- যাচাই:
--   select * from public.admin_exam_question_counts() limit 5;
--   select count(*) from public.admin_topic_paths();
-- ============================================================

create or replace function public.admin_exam_question_counts()
returns table(exam_id text, question_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select l.exam_id::text as exam_id, count(*)::bigint as question_count
  from public.exam_questions_link l
  group by l.exam_id
$$;

create or replace function public.admin_topic_paths()
returns table(topic text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct t.topic
  from (
    select topic from public.topic_questions
    union all
    select topic from public.question_bank
  ) t
  where t.topic is not null
    and btrim(t.topic) <> ''
$$;

-- শুধু সার্ভার (service_role) ডাকতে পারবে — পাবলিক key দিয়ে কেউ গুনতে পারবে না
revoke all on function public.admin_exam_question_counts() from anon, authenticated;
revoke all on function public.admin_topic_paths() from anon, authenticated;
grant execute on function public.admin_exam_question_counts() to service_role;
grant execute on function public.admin_topic_paths() to service_role;
