# BCS-One — ডেটাবেস স্কিমা: বর্তমান অবস্থা ও করণীয়

## ⚡ সবচেয়ে সহজ পথ (আগে এটা পড়ুন)

**`supabase/RUN-ALL-SAFE.sql`** — পুরো ফাইলটি কপি করে Supabase → SQL Editor-এ
পেস্ট করে **Run** করুন। এতে ধাপে ধাপে সব মাইগ্রেশন (টেবিল তৈরি, index, RLS চালু,
নাম-হালনাগাদ) একবারে আছে, আর প্রতিটি নির্ভরশীল ধাপ `to_regclass` দিয়ে ঘেরা —
কোনো টেবিল না থাকলে **এরর দেয় না**, শুধু `NOTICE` দেখায়। বারবার Run করা নিরাপদ।

> ⚠️ শুধু **ফাইলের নাম** পেস্ট করবেন না — ফাইলটি **খুলে ভেতরের পুরো লেখা** কপি
> করতে হবে। নাম পেস্ট করলে `syntax error at or near "...sql"` আসবে (কিছু ভাঙে না,
> কুয়েরি চলেই না)।

আউটপুটে যা দেখবেন:
- **ধাপ ১১ক** → সব টেবিলে `rls_enabled = true` হতে হবে
- **ধাপ ১১খ** → `anon`/`authenticated`-এর তালিকায় কোনো `INSERT`/`UPDATE`/`DELETE` থাকা যাবে না
- **ধাপ ১১গ** → `present = null` মানে টেবিলটি নেই (সেটি তৈরি করা দরকার)

নিচের অংশটি কেন এমন, আর কীভাবে স্কিমা রেপোতে আনা যায় — তার ব্যাখ্যা।

## সমস্যা (সারসংক্ষেপ)

এই রেপো **নিজের ডেটাবেস তৈরি করতে পারে না**। `supabase/` ফোল্ডারে যা আছে তা শুধু
১০টি ক্রমবর্ধমান প্যাচ — অ্যাপ যে টেবিলগুলো প্রতিদিন কোয়েরি করে, তার একটিও এখানে
তৈরি হয় না:

`exams`, `exam_questions_link`, `question_bank`, `submissions`, `allowed_students`,
`app_settings`, `topic_questions`, `enroll_requests`, `subjects`, `exam_questions`

আরও দুটি লক্ষণ:

- `migrations/2025_submissions_live_unique.sql` এমন টেবিলে index বানায়
  (`submissions`) যা কোনো ফাইল তৈরি করে না।
- `migrations/2025_enroll_requests_coupon.sql` এমন টেবিলে কলাম যোগ করে
  (`enroll_requests`) যা কোনো ফাইল তৈরি করে না।
- `migrations/2025_course_details.sql` `course_prices`-এ কলাম যোগ করে, অথচ টেবিলটি
  বানায় **পরের** ফাইল (`2025_course_prices.sql`) — অ্যালফাবেটিক ক্রমে আগে পড়ে।

ফলে: ফ্রেশ ক্লোন + README-র নির্দেশ মানে ডেটাবেস দাঁড় করানো **অসম্ভব**। এর
সরাসরি নিরাপত্তা-পরিণতি হলো — অনেক গ্যারান্টি (RLS, unique, NOT NULL) রেপো থেকে
যাচাইই করা যায় না।

> **নোট:** এই ফাইলের নিচে কোনো "অনুমান করা স্কিমা" লেখা হয়নি। স্কিমা বানিয়ে লিখলে
> সেটা মিথ্যা হবে এবং ভবিষ্যতে আরও বিভ্রান্তি তৈরি করবে। আসল স্কিমা ডাম্প করাই
> একমাত্র সঠিক পথ — নিচে তিনটি উপায় দেওয়া হলো।

## করণীয় — যেকোনো একটি উপায়ে স্কিমা কমিট করুন

### উপায় A — Supabase CLI (সবচেয়ে সহজ)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db dump --schema public -f supabase/migrations/0000_initial_schema.sql
```

`0000_initial_schema.sql` নামটি ইচ্ছাকৃত — অ্যালফাবেটিক/টাইমস্ট্যাম্প ক্রমে এটাই
সবার আগে চলবে, তাই প্যাচগুলো আর "relation does not exist" ত্রুটি দেবে না।

### উপায় B — pg_dump

Supabase Dashboard → **Settings → Database → Connection string** থেকে URI নিন:

```bash
pg_dump "postgresql://postgres:<PASSWORD>@db.<REF>.supabase.co:5432/postgres" \
  --schema-only --schema=public --no-owner --no-privileges \
  -f supabase/migrations/0000_initial_schema.sql
```

### উপায় C — SQL Editor (কেবল টেবিলের কাঠামো)

যদি কোনো CLI ব্যবহার করতে না চান, অন্তত টেবিলগুলোর কলাম তালিকা বের করে এই
ফোল্ডারে রাখুন:

```sql
select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
 order by table_name, ordinal_position;
```

## করণীয় — নিরাপত্তা সেটআপ যাচাই করুন

`supabase/verify-security-setup.sql` ফাইলটি SQL Editor-এ Run করুন (read-only, কিছু
বদলায় না)। আউটপুটে যা প্রত্যাশিত:

| চেক | প্রত্যাশা | না মিললে |
|---|---|---|
| `rls_enabled` | সব public টেবিলে `true` | `migrations/2028_enable_rls_public_tables.sql` Run করুন |
| anon/authenticated privilege | `DELETE`/`INSERT`/`UPDATE` কোথাও নেই | উপরের মাইগ্রেশনটি Run করুন |
| `submissions` index | `(exam_key, student_id) WHERE is_live_submission` | "এক ছাত্র = এক লাইভ সাবমিশন" কার্যকর নয় |
| `submissions.exam_key` / `student_id` | `is_nullable = NO` | `YES` হলে NULL ভিন্ন ধরা হয় → ডুপ্লিকেট লাইভ সাবমিশন সম্ভব |
| `exam_attempt_starts` | টেবিল বিদ্যমান | `2026_exam_attempt_starts.sql` Run করুন — নাহলে লিডারবোর্ড-যোগ্যতা ও সার্ভার-সাইড সময়-হিসাব দুটোই দুর্বল থাকে |
| `allowed_students` unique | `id`-এ unique | একই মানুষের একাধিক রো → `verifyStudentAccess` ambiguous হয়ে "এনরোল নেই" দেখায় |

## করণীয় — সাবমিশনের আইডি ক্যানোনিকালাইজ করা

`submissions.student_id` এখনই **কাঁচা টেক্সট** হিসেবে ইউনিক। তাই `01712345678` আর
`+8801712345678` আলাদা কী, অর্থাৎ একই মানুষ দুটি লাইভ সাবমিশন করতে পারে।
স্কিমা ডাম্প করার পর যোগ করা উচিত:

```sql
-- ১. ক্যানোনিকাল কী (শুধু ডিজিট)
alter table public.submissions
  add column if not exists student_key text
  generated always as (regexp_replace(coalesce(student_id, ''), '[^0-9a-z]', '', 'gi')) stored;

-- ২. পুরনো index সরিয়ে ক্যানোনিকাল কীলেফ নতুন partial unique index
drop index if exists public.submissions_one_live_per_student;
create unique index submissions_one_live_per_student
  on public.submissions (exam_key, student_key)
  where is_live_submission is true;

-- ৩. কলাম দুটো NOT NULL করা (আগে NULL মান পেলে একবার দেখে নিন)
-- select count(*) from public.submissions where exam_key is null or student_id is null;
-- alter table public.submissions alter column exam_key set not null;
-- alter table public.submissions alter column student_id set not null;
```

৩ নম্বর ধাপটি সরাসরি চালাবেন না — আগে উপরের `select count(*)` চালিয়ে দেখুন NULL
আছে কি না। NULL থাকলে প্রথমে সেই রো-গুলো ঠিক করুন।
