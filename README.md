# BCS One — Interactive Quiz & Exam Portal (Next.js)

BCS ও চাকরির পরীক্ষার প্রস্তুতির জন্য একটি আধুনিক, সুরক্ষিত, full-stack Next.js ওয়েব অ্যাপ
(ইন্টারঅ্যাকটিভ কুইজ, লাইভ পরীক্ষা, লিডারবোর্ড, কোর্স ভিডিও, স্টুডেন্ট পোর্টাল)।

## 🚀 Key Features

- **Zero Answer-Leak Architecture** — পরীক্ষার প্রশ্ন/অপশন ক্লায়েন্টে যায়, কিন্তু সমাধান-কী
  সার্ভারে থাকে; লাইভ চলাকালীন কখনো লিক হয় না। স্কোরিং সবসময় সার্ভার-সাইড।
- **Synchronized Bangladesh Standard Time** — নেটওয়ার্ক টাইম-সিঙ্ক (Cloudflare/NTP fallback) +
  সার্ভার-ঘড়িতে window enforcement; ক্লায়েন্ট ঘড়ি নষ্ট করলে লাইভ উইন্ডো ভাঙে না।
- **Interactive Quiz Engine** — ডেডলাইন-অ্যাংকর্ড কাউন্টডাউন, option locking, auto-submit।
- **Real-Time Leaderboard** — স্কোর + সময়-ভিত্তিক র‌্যাংকিং (এক স্টুডেন্ট = এক লাইভ সাবমিশন,
  DB-লেভেল unique index দ্বারা নিশ্চিত)।
- **Student Performance Portal** — accuracy, best/average score, প্রশ্ন-ভিত্তিক রিভিউ।
- **Teacher & Admin Panel** — Supabase Auth (Google) + app_metadata role / TEACHER_EMAILS
  allow-list; exam builder, প্রশ্নব্যাংক, এনরোলমেন্ট অনুমোদন (TRX ID যাচাই), কোর্স ভিডিও ম্যানেজার,
  AI প্রশ্ন জেনারেটর (Gemini, সার্ভার-অনলি)।

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript (strict)
- **Styling**: Tailwind CSS + Lucide Icons
- **Database & Auth**: Supabase (PostgreSQL + RLS) — Firebase/Firestore থেকে মাইগ্রেট করা হয়েছে
- **Font**: Hind Siliguri (Google Fonts)
- **Android**: WebView wrapper (`/android`)

## 📦 How to Run

```bash
cd D:\App\bcs-one-nextjs
npm install
```

Supabase সেটআপ:
1. `cp .env.local.example .env.local` — তারপর `.env.local`-এ
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (সার্ভার-অনলি, বাধ্যতামূলক) বসান।
2. Supabase Dashboard → SQL Editor → `supabase/migrations/`-এর ফাইলগুলো
   (যেমন `2025_submissions_live_unique.sql`) এবং `supabase/course_videos.sql` Run করুন।
3. শিক্ষক অ্যাক্সেস: `TEACHER_EMAILS` এনভিতে ইমেইল দিন, অথবা Supabase
   Authentication → Users → Edit user → app_metadata-এ `role: "teacher"/"admin"` সেট করুন।

ডেভ/বিল্ড:

```bash
npm run dev        # http://localhost:3000
npm run build
npm start
```

টাইপ চেক: `npx tsc --noEmit --incremental false`

## 🔒 Security Notes (অডিট-পরবর্তী)

- Teacher/server action গুলো Supabase session cookie (`sb_access_token`) দিয়ে যাচাই হয়;
  `user_metadata` কখনো admin দেয় না।
- পেইড কোর্স/পরীক্ষা শুধু এনরোল্ড স্টুডেন্ট — সার্ভার-সাইড `verifyStudentAccess` + session বাঁধাই।
- লাইভ পরীক্ষার উত্তর `endTime + ১০ সেকেন্ড গ্রেস`-এর আগে কখনো রিলিজ হয় না
  (স্ক্রিপ্টেড পারফেক্ট-স্কোর প্রতিরোধ), এবং লাইভ সাবমিশন একবারই (DB unique index)।
- পাবলিক লিডারবোর্ডে স্টুডেন্টের ফোন নম্বর মাস্ক করা থাকে।

## 📱 Android

`/android` — WebView wrapper (student-only frontend)। বিল্ড: Android Studio দিয়ে
`android` ফোল্ডার খুলে assemble। Release সাইনিং-এর জন্য `android/app/build.gradle`-এ
keystore + signingConfig বসাতে হবে।