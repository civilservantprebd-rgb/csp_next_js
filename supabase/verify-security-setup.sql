-- ============================================================
-- BCS-One: নিরাপত্তা সেটআপ যাচাই (READ-ONLY — কিছু বদলায় না)
-- Supabase Dashboard → SQL Editor → প্রতিটি ব্লক Run করে আউটপুট মিলিয়ে নিন।
--
-- কেন দরকার: অ্যাপের নিরাপত্তা এখন এই তিনটি DB-স্তরের গ্যারান্টির উপর নির্ভর করে
-- যা **রেপোতে নেই** (কোনো মাইগ্রেশন এই টেবিলগুলো বানায় না):
--   • RLS চালু ও anon/authenticated-এর write বন্ধ
--   • submissions-এ লাইভ-ইউনিক index + কলাম NOT NULL
--   • exam_attempt_starts টেবিলের অস্তিত্ব (নাহলে claimExamStart নীরবে ব্যর্থ হয়ে
--     সময়-হিসাব ক্লায়েন্টের মানে ফিরে যায়)
-- ============================================================

-- ── ১. সব public টেবিলের RLS অবস্থা ─────────────────────────────
-- rls_enabled = true না হলে সেই টেবিল anon key দিয়ে খোলা।
-- policy_count = 0 + rls_enabled = true → শুধু service_role ঢুকতে পারে (ইচ্ছাকৃত)।
select c.relname                                   as table_name,
       c.relrowsecurity                            as rls_enabled,
       (select count(*)
          from pg_policies p
         where p.schemaname = 'public'
           and p.tablename = c.relname)            as policy_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relkind = 'r'
 order by c.relrowsecurity asc, c.relname;

-- ── ২. anon / authenticated-এর privilege ───────────────────────
-- DELETE/INSERT/UPDATE দেখা গেলে সেই টেবিল পাবলিক key দিয়ে লেখা যায়।
-- (course_prices ও daily_news-এ SELECT থাকা স্বাভাবিক — ওগুলো পাবলিক তথ্য।)
select table_name,
       grantee,
       string_agg(privilege_type, ',' order by privilege_type) as privileges
  from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon', 'authenticated')
 group by table_name, grantee
 order by table_name, grantee;

-- ── ৩. submissions: লাইভ-ইউনিক index ও কলামের nullability ──────
-- প্রত্যাশা: partial unique index (exam_key, student_id) WHERE is_live_submission
-- এবং exam_key / student_id দুটোই NOT NULL।
-- is_nullable = 'YES' হলে NULL ভিন্ন ধরা হয় → একই ছাত্র একাধিকবার লাইভ দিতে পারবে।
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public' and tablename = 'submissions';

select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'submissions'
   and column_name in ('exam_key', 'student_id', 'is_live_submission', 'score', 'answers', 'submitted_at');

-- ── ৪. exam_attempt_starts টেবিল ও তার unique কনস্ট্রেইন্ট ─────
-- null হলে 2026_exam_attempt_starts.sql এখনো Run করা হয়নি →
-- claimExamStart নীরবে ব্যর্থ হবে এবং সময়-হিসাব ক্লায়েন্ট-নির্ভর থেকে যাবে।
select to_regclass('public.exam_attempt_starts') as attempt_starts_table;

select indexname, indexdef
  from pg_indexes
 where schemaname = 'public' and tablename = 'exam_attempt_starts';

-- ── ৫. allowed_students: id ও email-এ unique আছে কি ────────────
-- unique না থাকলে একই মানুষের একাধিক রো তৈরি হতে পারে → verifyStudentAccess
-- ambiguous হয়ে "এনরোল নেই" দেখায়, আর একই ছাত্র একাধিক লাইভ সাবমিশন করতে পারে।
select indexname, indexdef
  from pg_indexes
 where schemaname = 'public' and tablename = 'allowed_students';

-- ── ৬. অ্যাপ যে টেবিলগুলো কোয়েরি করে সব কি আদৌ আছে? ──────────
-- present = null হলে সেই টেবিলটি কোথাও তৈরি হয়নি (রেপোতে থাকে না)।
select t.name as expected_table,
       to_regclass('public.' || t.name) as present
  from (values
          ('exams'), ('exam_questions_link'), ('question_bank'), ('submissions'),
          ('allowed_students'), ('app_settings'), ('topic_questions'),
          ('enroll_requests'), ('subjects'), ('exam_questions'),
          ('course_videos'), ('course_prices'), ('course_whatsapp'), ('daily_news'),
          ('student_mistakes'), ('student_bookmarks'), ('student_read_questions'),
          ('exam_attempt_starts')
       ) as t(name)
 order by present nulls first, t.name;
