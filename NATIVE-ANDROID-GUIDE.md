# BCS One (আরোহণ) — Native Android অ্যাপ বিল্ড গাইড (স্টেপ-বাই-স্টেপ)

> **এই ফাইলটি কী:** BCS One ওয়েব প্ল্যাটফর্মের (Next.js + Supabase) সমতুল্য ফাংশনালিটির একটা **native Android অ্যাপ** বানানোর সম্পূর্ণ ধাপে-ধাপে কার্যপদ্ধতি। প্রতিটি ফেজের টাস্ক, চেকলিস্ট ও "কোডিং অ্যাসিস্ট্যান্ট প্রম্পট" দেওয়া আছে — যেকোনো AI কোডিং অ্যাসিস্ট্যান্ট (Cursor, Claude Code, Windsurf, GitHub Copilot) দিয়ে আপনি এই ডকুমেন্ট অনুযায়ী কাজ চালাতে পারবেন।
>
> **মূল লক্ষ্য:** সম্পূর্ণ native (WebView নয়) + **খুবই স্মুথ (৬০–১২০fps) অভিজ্ঞতা** — পারফরম্যান্সই প্রতিটি ফেজের অ-আপসযোগ্য গেট (সেকশন ২২ দেখুন)।
>
> **কীভাবে ব্যবহার করবেন:** অ্যাসিস্ট্যান্টকে বলুন — *"এই রিপোজিটরিতে `NATIVE-ANDROID-GUIDE.md` পড়ো। আমরা ফেজ N-এ আছি। ফেজ N-এর সব টাস্ক বাস্তবায়ন করো এবং ফেজ-শেষের DoD (Definition of Done) চেকলিস্ট পূরণ করো।"* প্রতিটি ফেজ শেষে চেকলিস্ট যাচাই করে পরের ফেজে যান।

---

## সূচিপত্র

1. [বিদ্যমান সিস্টেমের প্রেক্ষাপট](#১-বিদ্যমান-সিস্টেমের-প্রেক্ষাপট)
2. [লক্ষ্য ও স্কোপ](#২-লক্ষ্য-ও-স্কোপ)
3. [আর্কিটেকচার সিদ্ধান্ত](#৩-আর্কিটেকচার-সিদ্ধান্ত)
4. [টেক স্ট্যাক](#৪-টেক-স্ট্যাক)
5. [অ্যান্ড্রয়েড প্রজেক্ট স্ট্রাকচার](#৫-অ্যান্ড্রয়েড-প্রজেক্ট-স্ট্রাকচার)
6. [API কন্ট্রাক্ট v1](#৬-api-কন্ট্রাক্ট-v1)
7. [ফেজ ০ — প্রস্তুতি ও বেসলাইন](#ফেজ-০)
8. [ফেজ ১ — Server Actions → REST API](#ফেজ-১)
9. [ফেজ ২ — Android ফাউন্ডেশন](#ফেজ-২)
10. [ফেজ ৩ — ড্যাশবোর্ড ও কন্টেন্ট স্ক্রিন](#ফেজ-৩)
11. [ফেজ ৪ — কোর্স, এনরোলমেন্ট ও ভিডিও](#ফেজ-৪)
12. [ফেজ ৫ — প্র্যাকটিস ও প্রশ্নব্যাংক](#ফেজ-৫)
13. [ফেজ ৬ — লাইভ পরীক্ষা ইঞ্জিন (কোর)](#ফেজ-৬)
14. [ফেজ ৭ — রেজাল্ট ও লিডারবোর্ড](#ফেজ-৭)
15. [ফেজ ৮ — মিসটেক/বুকমার্ক সিংক ও অফলাইন](#ফেজ-৮)
16. [ফেজ ৯ — নিউজ, নোটিফিকেশন ও ডিপলিংক](#ফেজ-৯)
17. [ফেজ ১০ — টেস্টিং ও QA](#ফেজ-১০)
18. [ফেজ ১১ — Play Store লঞ্চ](#ফেজ-১১)
19. [নিরাপত্তা চেকলিস্ট](#১৯-নিরাপত্তা-চেকলিস্ট)
20. [সাধারণ ভুল ও টিপস](#২০-সাধারণ-ভুল-ও-টিপস)
21. [সময়-অনুমান](#২১-সময়-অনুমান)
22. [স্মুথনেস ও পারফরম্যান্স ইঞ্জিনিয়ারিং](#২২-স্মুথনেস-ও-পারফরম্যান্স-ইঞ্জিনিয়ারিং)

---

## ১. বিদ্যমান সিস্টেমের প্রেক্ষাপট

### ১.১ ওয়েব অ্যাপ (যেটা replicate করতে হবে)

- **ফ্রেমওয়ার্ক:** Next.js 14 (App Router) + TypeScript (strict) + Tailwind CSS
- **ডেটাবেস/অথ:** Supabase (PostgreSQL + RLS)। Firebase → Supabase মাইগ্রেট করা হয়েছে।
- **ব্যবসায়িক লজিক:** সব `src/actions/*.ts` **Server Actions**-এ (ক্লায়েন্টে লজিক নেই)।
- **Auth:** Supabase Google sign-in। টিচার/অ্যাডমিন = `app_metadata.role` + `TEACHER_EMAILS` allow-list। Session token `sb_access_token` কুকিতে → সার্ভার অ্যাকশন যাচাই করে।
- **অ্যান্ড্রয়েড (বর্তমান):** `/android` = শুধু WebView wrapper (স্টুডেন্ট ফ্রন্টএন্ড)। এটি **native দিয়ে replace** করা হবে — WebView-এর জ্যাঙ্ক/ধীরগতির কারণেই।

### ১.২ ফিচার ইনভেন্টরি (মডিউল অনুযায়ী)

| মডিউল | ফিচার | ভার্সন |
|---|---|---|
| Student Auth | Google sign-in, লোকাল সেশন | v1 ✅ |
| Enrollment | ফ্রি/পেইড কোর্স, TRX ID জমা, অ্যাডমিন অ্যাপ্রুভাল | v1 ✅ |
| Course | ডিটেইলস, গেটেড ভিডিও (এনরোলড-অনলি), WhatsApp গ্রুপ লিংক | v1 ✅ |
| Exam Engine | লাইভ পরীক্ষা, কাউন্টডাউন, option lock, auto-submit, **zero answer-leak**, সার্ভার-স্কোরিং | v1 ✅ |
| Bangladesh Time | নেটওয়ার্ক টাইম-সিংক + সার্ভার window enforcement | v1 ✅ |
| Leaderboard | রিয়েল-টাইম র্যাংকিং, ১ ছাত্র = ১ সাবমিশন (DB unique index) | v1 ✅ |
| Result/Review | অ্যাকুরেসি, best/average, প্রশ্ন-রিভিউ (`endTime+10s` পরে) | v1 ✅ |
| Practice | সেলফ-প্র্যাকটিস সেশন, ফ্রি কুইজ | v1 ✅ |
| Question Bank | টপিক-হায়ারার্কি ব্রাউজিং | v1 ✅ |
| Mistakes/Bookmarks | ভুল-নোটবুক + বুকমার্ক, ক্রস-ডিভাইস সিংক | v1 ✅ |
| Daily News | বাংলা নিউজ ফিড + read-count | v1 ✅ |
| Teacher/Admin Panel | Exam builder, প্রশ্নব্যাংক, AI জেনারেটর, StudentApproval, Analytics, ভিডিও/প্রাইস ম্যানেজার | **v2** ⏳ (native, স্টুডেন্ট অ্যাপের পরে) |

> **স্কোপ সিদ্ধান্ত (আপডেটেড):** **v1 = শুধু স্টুডেন্ট অ্যাপ** (স্মুথ পারফরম্যান্সেই ফোকাস) — প্রথম রিলিজ দ্রুত ও মানসম্মত করতে। **v2 = টিচার/অ্যাডমিন প্যানেল native** — একই কোডবেসে পরের ধাপ। v1 চলাকালীন অ্যাডমিন ওয়েবেই চলবে। API-র auth-রোল কাঠামো (student/teacher/admin scope) v1-এ **রোল-রেডি** রাখুন, তবে v2-এর রুট/স্ক্রিন v1-এ বাস্তবায়ন করবেন না।

### ১.৩ অ-আপসযোগ্য নিয়ম (Web থেকে ক্যারি-ওভার — ভাঙা যাবে না)

1. **Zero answer-leak:** পরীক্ষার প্রশ্ন ক্লায়েন্টে যায়, কিন্তু **সঠিক উত্তর-কী কখনো ক্লায়েন্টে যায় না**। স্কোরিং সবসময় সার্ভার-সাইড।
2. **উত্তর প্রকাশ:** `endTime + 10 সেকেন্ড গ্রেস` পার হওয়ার আগে উত্তর/স্কোর রিলিজ হয় না।
3. **বাংলাদেশ সময়ই চূড়ান্ত:** ক্লায়েন্টের ডিভাইস ঘড়ি কখনো বিশ্বাসযোগ্য নয় — সার্ভার-স্ট্যাম্পড সময়ই exam window-এর authority।
4. **১ ছাত্র = ১ লাইভ সাবমিশন:** DB-লেভেল unique index enforce করে (ডুপ্লিকেট সাবমিশন অসম্ভব)।
5. **গেটেড কন্টেন্ট:** পেইড/এনরোলড কোর্স ও ভিডিও সার্ভার-সাইড `verifyStudentAccess` দিয়ে যাচাই।
6. **Option locking:** একবার সিলেক্ট করলে বদলানো যায় না (এক্সামে); auto-submit সময় শেষে।
7. **Role কখনো `user_metadata` থেকে নয়** — সার্ভারে verify (app_metadata/allow-list)।

### ১.৪ ওয়েব প্রজেক্টের মূল ফাইল-ম্যাপ (রেফারেন্স)

```
src/
├── actions/        ← ব্যবসায়িক লজিক (API রূপান্তরের উৎস)
│   ├── admin-actions.ts, ai-actions.ts, analytics-actions.ts
│   ├── course-actions.ts, enroll-actions.ts, exam-actions.ts
│   ├── mistake-actions.ts, news-actions.ts, notification-actions.ts
│   ├── practice-actions.ts, student-actions.ts, video-actions.ts, whatsapp-actions.ts
├── app/            ← রাউটস
│   ├── page.tsx (home/landing), portal/, practice/, practice/session/
│   ├── course/[courseName]/, exam/[examId]/{,result/}, leaderboard/[examId]/
│   ├── question-bank/, admin/, admin/student/[studentId]/, api/time/
├── components/     ← UI (admin/, course/, dashboard/, exam/, home/, leaderboard/,
│                     modals/, shared/)
├── lib/            ← supabase.ts, bangladesh-time.ts, student-auth.ts, teacher-auth.ts,
│                     topic-hierarchy.ts, youtube.ts, utils.ts, practice-helper.ts,
│                     question-parser.ts, access-cache.ts, exam-attempt-cache.ts ...
├── types/          ← exam.ts, student.ts, submission.ts, video.ts
supabase/
├── migrations/     ← ৯টি SQL (schema source of truth)
└── course_videos.sql
.env.local.example  ← NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
                      SUPABASE_SERVICE_ROLE_KEY, TEACHER_EMAILS
```

---

## ২. লক্ষ্য ও স্কোপ

### লক্ষ্য
ওয়েব অ্যাপের সাথে **ডেটা-সামঞ্জস্যপূর্ণ** (একই Supabase DB, একই ব্র্যান্ড) একটা native Android অ্যাপ — স্টুডেন্টরা যেখানে লগইন করে, কোর্স দেখে, লাইভ পরীক্ষা দেয়, লিডারবোর্ড/রেজাল্ট দেখে, প্র্যাকটিস করে, নিউজ পড়ে — **সবকিছু স্মুথ, তৎক্ষণাৎ রেসপন্সসহ**।

### Scope
- **v1 (এখন):** স্টুডেন্ট/চাকরিপ্রত্যাশী অভিজ্ঞতা — সম্পূর্ণ native, স্মুথ (৬০fps+) পারফরম্যান্সই মূল মানদণ্ড
- **v2 (পরে):** টিচার/অ্যাডমিন প্যানেল native — একই কোডবেস; API রোল-কাঠামো v1-এ রেডি রাখুন
- **Scope-এর বাইরে (যেকোনো ভার্সনে নয়):** ইন-অ্যাপ পেমেন্ট গেটওয়ে (TRX ম্যানুয়াল ভেরিফিকেশনই থাকবে; Play নীতিমালা যাচাই), iOS, ওয়েব-অ্যাপের পিক্সেল-পারফেক্ট UI কপি (থিম-সামঞ্জস্য যথেষ্ট)

---

## ৩. আর্কিটেকচার সিদ্ধান্ত

### ৩.১ ব্যাকএন্ড অপশন (বাছাই করুন — সুপারিশ B)

| অপশন | বর্ণনা | সুবিধা | অসুবিধা |
|---|---|---|---|
| **A. Supabase Edge Functions** | স্কোরিং/অ্যান্টি-লিক লজিক Deno Edge Function-এ | কোনো সার্ভার নেই | actions মাইগ্রেশন খরচ; supabase-kt সরাসরি DB অ্যাক্সেস মানে RLS-নির্ভর |
| **B. Next.js → REST API** ✅ | Server actions-এর উপরে REST route handlers; অ্যান্ড্রয়েড Retrofit দিয়ে কল | **লজিক ৯০% রিইউজ**; ওয়েব অ্যাপ অক্ষত; একই সার্ভার | একটি চলমান সার্ভার (Vercel) লাগে |
| **C. নতুন ব্যাকএন্ড** | NestJS/Express নতুন করে | পরিষ্কার | সবচেয়ে বেশি সময়/খরচ |

**সিদ্ধান্ত (ডিফল্ট): অপশন B।** Supabase স্কিমা, RLS, মাইগ্রেশন **অপরিবর্তিত** থাকবে; শুধু অ্যাক্সেস-লেয়ার (actions) HTTP-তে উন্মুক্ত হবে। স্কোরিং সহ সব নিরাপত্তা লজিক Next.js-এর ভেতরেই থেকে যায়।

### ৩.২ অথ মডেল (API-র জন্য)

- অ্যাপ: Google Sign-In (Android Credential Manager/Google Identity Services) → Supabase-তে exchange → Supabase **access token**।
- প্রতিটি API কল: `Authorization: Bearer <supabase_access_token>`।
- Next.js API route: token verify (Supabase `auth.getUser(token)`) → `req`-এ student/teacher/admin প্রসঙ্গ। **v1-এ শুধু student-রোল রুট; v2-এ teacher/admin রোল যোগ হবে — রোল-চেক হেল্পার এখনই রোল-রেডি করে রাখুন।**
- কুকি-মেকানিজম ওয়েবের জন্য থাকবে; অ্যাপ Bearer-হেডার ব্যবহার করবে।

### ৩.৩ API ডিজাইন নীতি

- সব রুট: `src/app/api/**/route.ts` (App Router Route Handlers)।
- ওয়েবের server action-এর **একই ফাংশন রিইউজ** করুন — route handler = পাতলা wrapper।
- Error format: `{ "error": { "code": "NOT_ENROLLED", "message": "..." } }` + proper HTTP status।
- সময়-সংবেদনশীল রেসপন্সে সবসময় সার্ভার-স্ট্যাম্পড `serverTime` (ISO 8601 + epoch ms) দিন।
- প্রশ্ন-রেসপন্সে **কখনো `correct_option`/answer field থাকবে না** (স্কোপ: exam flow)।
- **পারফরম্যান্সের জন্য:** ড্যাশবোর্ডের মতো ভারী স্ক্রিনে **aggregate এন্ডপয়েন্ট** (`GET /api/home`) — অ্যাপ যেন ১টি কলেই সব সেকশনের ডেটা পায় (সেকশন ২২.৩)।

---

## ৪. টেক স্ট্যাক

| স্তর | চয়েস | নোট |
|---|---|---|
| ভাষা | Kotlin 2.x | |
| UI | Jetpack Compose + Material 3 | single-activity |
| আর্কিটেকচার | MVVM + Repository | UiState sealed class প্যাটার্ন |
| DI | Hilt | কোর-পাথের বাইরে deferred |
| নেটওয়ার্ক | Retrofit + OkHttp + kotlinx.serialization | Interceptor → Bearer token |
| Auth | Google Sign-In + Supabase Kotlin SDK (অথবা REST) | token → API |
| লোকাল DB | Room | **লিস্ট স্ক্রিনের single source of truth** (স্মুথ স্ক্রলের চাবি) |
| স্টেট | DataStore Preferences | |
| ভিডিও | Media3 (ExoPlayer) | |
| পুশ | FCM | |
| ব্যাকগ্রাউন্ড | WorkManager | prefetch, সিংক, সাবমিশন রিট্রাই |
| ছবি | Coil | disk/memory cache + downsampling |
| পারফরম্যান্স | Macrobenchmark + Baseline Profile (benchmark মডিউল) | সেকশন ২২ |
| অ্যানালিটিক্স | Firebase Crashlytics + Analytics | init deferred |
| বাংলা ফন্ট | Hind Siliguri (asset) | বাংলা LTR, RTL দরকার নেই |
| Min/Target SDK | minSdk 24, targetSdk 34+ | |

---

## ৫. অ্যান্ড্রয়েড প্রজেক্ট স্ট্রাকচার

```
android-app/  (নতুন রুট ফোল্ডার — বা নাম: androidNative/; পুরনো WebView /android পাশে রাখুন)
├── app/
│   ├── src/main/java/com/yourco/bcsonepro/
│   │   ├── MainActivity.kt
│   │   ├── BCSOneApplication.kt
│   │   ├── core/
│   │   │   ├── network/        (Retrofit, interceptors, ApiClient)
│   │   │   ├── auth/           (GoogleSignInManager, SessionManager, TokenStore)
│   │   │   ├── time/           (BangladeshTimeProvider)
│   │   │   ├── security/       (ExamSecurity: no-answer-cache guard)
│   │   │   └── util/
│   │   ├── data/
│   │   │   ├── remote/         (Retrofit API interface + DTOs)
│   │   │   ├── local/          (Room: entities, DAO, database)
│   │   │   └── repository/
│   │   ├── domain/             (models, use cases)
│   │   ├── ui/
│   │   │   ├── navigation/     (NavHost, Routes)
│   │   │   ├── theme/
│   │   │   ├── auth/           (লগইন স্ক্রিন)
│   │   │   ├── home/           (ড্যাশবোর্ড)
│   │   │   ├── course/         (লিস্ট, ডিটেইল, ভিডিও)
│   │   │   ├── exam/           (কাউন্টডাউন, প্রশ্ন, সাবমিট, রেজাল্ট)
│   │   │   ├── leaderboard/
│   │   │   ├── practice/
│   │   │   ├── questionbank/
│   │   │   ├── notebook/       (মিসটেক + বুকমার্ক)
│   │   │   ├── news/
│   │   │   └── profile/
│   │   └── di/                 (Hilt modules)
│   └── src/main/res/
├── benchmark/            (Macrobenchmark + Baseline Profile — সেকশন ২২)
├── build.gradle.kts (root + app + benchmark)
├── settings.gradle.kts
└── gradle/libs.versions.toml   (version catalog)
```

> প্যাকেজ নাম চূড়ান্ত করার আগে Play Console-এ applicationId রিজার্ভ করুন (একবার বদলানো কঠিন)।

---

## ৬. API কন্ট্রাক্ট v1

> বাস্তবায়নের সময় প্রতিটি actions ফাইলের ফাংশন সিগনেচার মিলিয়ে নিন — নিচে মূল তালিকা। (v2-তে teacher/admin রুট যুক্ত হবে।)

### ৬.১ এন্ডপয়েন্ট টেবিল

| # | Method + Path | Auth | বর্ণনা |
|---|---|---|---|
| 1 | `POST /api/auth/session` | — | Supabase token exchange/verify → student প্রোফাইল |
| 2 | `GET /api/student/me` | ✅ | প্রোফাইল + এনরোলমেন্ট স্ট্যাটাস |
| 3 | `POST /api/student/sync-login` | ✅ | লগইন-সিংক (ওয়েবের `syncStudentLogin`) |
| 4 | `GET /api/courses` | ✅ | কোর্স তালিকা (এনরোলড-স্ট্যাটাসসহ) |
| 5 | `GET /api/courses/{courseName}` | ✅ | কোর্স ডিটেইল (ডিটেইলস, WhatsApp লিংক — শুধু এনরোলড) |
| 6 | `GET /api/courses/{courseName}/videos` | ✅ | ভিডিও লেসন (এনরোলড-চেক সার্ভারে) |
| 7 | `POST /api/courses/{courseName}/enroll` | ✅ | এনরোল রিকোয়েস্ট (TRX id, নাম, ফোন) |
| 8 | `GET /api/home` | ✅ | **Aggregate ড্যাশবোর্ড**: লাইভ/আসন্ন পরীক্ষা + কোর্স সারাংশ + নিউজ + স্ট্যাট — ১ কল (স্মুথ স্টার্টআপের জন্য) |
| 9 | `GET /api/exams/live` | ✅ | চলমান/আসন্ন পরীক্ষা (সার্ভার টাইমসহ) |
| 10 | `GET /api/exams/{id}` | ✅ | পরীক্ষা মেটাডেটা + উইন্ডো |
| 11 | `GET /api/exams/{id}/questions` | ✅ | প্রশ্ন (কোনো উত্তর-কী নেই) + `serverTime` + `endTime` |
| 12 | `POST /api/exams/{id}/submit` | ✅ | উত্তর জমা → **সার্ভারে স্কোর** → submission id |
| 13 | `GET /api/exams/{id}/result` | ✅ | `endTime+10s` পরে: স্কোর, উত্তর-কী, রিভিউ |
| 14 | `GET /api/exams/{id}/leaderboard` | ✅ | লিডারবোর্ড (পেজিনেটেড; পোলিং ১৫–৩০সে) |
| 15 | `POST /api/practice/session` | ✅ | প্র্যাকটিস সেশন তৈরি (টপিক/সংখ্যা) |
| 16 | `GET /api/practice/questions` | ✅ | প্র্যাকটিস প্রশ্ন (উত্তরসহ — প্র্যাকটিসে লিক-ঝুঁকি নেই) |
| 17 | `POST /api/practice/submit` | ✅ | প্র্যাকটিস স্কোর সেভ |
| 18 | `GET /api/topics` | ✅ | টপিক-হায়ারার্কি |
| 19 | `GET /api/question-bank` | ✅ | প্রশ্নব্যাংক ব্রাউজ (টপিক ফিল্টার + **পেজিনেশন**) |
| 20 | `GET /api/news` | —/✅ | দৈনিক নিউজ |
| 21 | `POST /api/news/{id}/read` | ✅ | read-count |
| 22 | `GET /api/mistakes` | ✅ | মিসটেক নোটবুক |
| 23 | `PUT /api/mistakes` | ✅ | মিসটেক আপসার্ট (ক্রস-ডিভাইস সিংক) |
| 24 | `GET /api/bookmarks` · `PUT /api/bookmarks` | ✅ | বুকমার্ক |
| 25 | `GET /api/time` | — | সার্ভার-স্ট্যাম্পড বাংলাদেশ সময় (epoch ms + timezone) |
| 26 | `POST /api/exams/{id}/heartbeat` (ঐচ্ছিক) | ✅ | ব্যাকগ্রাউন্ডে থাকা অবস্থায় উইন্ডো ট্র্যাকিং |

### ৬.২ মূল JSON উদাহরণ

**GET /api/exams/{id}/questions → 200**
```json
{
  "examId": "abc123",
  "title": "মডেল টেস্ট ০১",
  "serverTimeMs": 1730000000000,
  "startTimeMs": 1729990000000,
  "endTimeMs": 1730003600000,
  "durationSeconds": 3600,
  "questionIds": ["q1", "q2", "q3"],
  "questions": [
    {
      "id": "q1",
      "type": "MCQ",
      "text": "বাংলাদেশের স্বাধীনতা ঘোষণা কবে?",
      "options": [
        { "key": "A", "text": "২৬ মার্চ" },
        { "key": "B", "text": "২৫ মার্চ" }
      ]
      // ⚠️ সঠিক উত্তর (answer/correctOption) এখানে থাকবে না
    }
  ]
}
```

**POST /api/exams/{id}/submit → 200**
```json
// Request
{ "answers": { "q1": "A", "q2": "B" }, "clientSubmittedAtMs": 1730003599000 }
// Response
{
  "submissionId": "sub_99",
  "status": "SCORED",            // অথবা PENDING_REVIEW
  "score": 42,
  "total": 50,
  "accuracyPct": 84,
  "answersReleased": false       // endTime+10s-এর আগে false
}
```

**GET /api/time → 200**
```json
{ "serverTimeMs": 1730000000123, "ianaTimezone": "Asia/Dhaka", "offsetFromUtcMinutes": 360 }
```

---

## ফেজ ০

### প্রস্তুতি ও বেসলাইন (০.৫–১ দিন)

**টাস্ক:**
- [ ] ওয়েব অ্যাপ লোকালি চালান: `npm run dev` → `http://localhost:3000` কাজ করছে কিনা
- [ ] `.env.local`-এ সব key আছে কিনা যাচাই (Supabase URL/keys)
- [ ] Supabase dashboard-এ টেবিল/RLS নোট নিন (নতুন ডেভেলপারের জন্য)
- [ ] রিপোজিটরি ব্যাকআপ/ব্রাঞ্চ: `git checkout -b android-native`
- [ ] এই ডকুমেন্ট + `src/actions/*` ফাইলগুলো পড়ে ফিচার-স্কোপ কনফার্ম করুন
- [ ] **পারফরম্যান্স টার্গেট লিখুন:** কোন ডিভাইস-শ্রেণি "স্মুথ" মানদণ্ড হবে (যেমন ৪GB RAM mid-range) — সেকশন ২২.৫

**কোডিং অ্যাসিস্ট্যান্ট প্রম্পট:**
```
রিপোজিটরির `src/actions/*.ts` ফাইলগুলোর প্রতিটি exported ফাংশনের নাম,
প্যারামিটার ও রিটার্ন টাইপের একটা ইনভেন্টরি তৈরি করো (markdown টেবিল):
ফাংশন | ফাইল | ইনপুট | আউটপুট | ক্লায়েন্ট-সাইড নাকি সার্ভার-অনলি।
আউটপুট `API-INVENTORY.md` ফাইলে সেভ করো।
```

**DoD:** API-INVENTORY.md তৈরি; ওয়েব অ্যাপ লোকালি চলে; ব্রাঞ্চ তৈরি; পারফরম্যান্স টার্গেট-ডিভাইস ঠিক।

---

## ফেজ ১

### Server Actions → REST API (২–৩ সপ্তাহ) ⚠️ অন্যের কাজের উপর নির্ভরশীল

**লক্ষ্য:** অ্যান্ড্রয়েড অ্যাপ যেন HTTP দিয়ে ওয়েবের সব স্টুডেন্ট-ফিচার ব্যবহার করতে পারে।

**টাস্ক (প্রথমে ছোট ২টি রুট, তারপর বাকিগুলো):**
- [ ] `src/app/api/` ডিরেক্টরি + হেল্পার: `src/lib/api-helpers.ts` (auth-verify **রোল-রেডি**, error wrapper, JSON)
- [ ] `POST /api/auth/session`: Supabase token → `auth.getUser()` → student প্রোফাইল ফেরত
- [ ] `GET /api/student/me` + `POST /api/student/sync-login`
- [ ] `GET /api/time` (সবচেয়ে সহজ — আগে বানান, টেস্টিং-এর ভিত্তি)
- [ ] **`GET /api/home` (aggregate)** — হোম স্ক্রিনের সব ডেটা ১ কল: exam সারাংশ, কোর্স সারাংশ, নিউজ, স্ট্যাট
- [ ] Exam flow (৯–১৩ নম্বর) — **সবচেয়ে গুরুত্বপূর্ণ**, আগে বানান:
  - প্রশ্ন ফেচে উত্তর-কী বাদ দেওয়া নিশ্চিত করুন (অ্যাড-হক লিক নয় — টাইপ-লেভেলে)
  - submit-এ সার্ভার-স্কোরিং: actions-এর লজিক রিইউজ
  - `endTime+10s` গার্ড, একবার-সাবমিট (unique index + অ্যাপ-লেভেল চেক)
- [ ] Course/enroll/videos (৪–৭), practice (১৫–১৭), topics/question-bank (১৮–১৯, **পেজিনেশনসহ**)
- [ ] News (২০–২১), mistakes/bookmarks (২২–২৪)
- [ ] কুকি → Bearer উভয় মোডে auth (ওয়েব ভাঙবে না — regression টেস্ট)
- [ ] Rate limiting/headers (ঐচ্ছিক, production-এর আগে)

**রূপান্তরের প্যাটার্ন (প্রতিটি action-এর জন্য):**
```ts
// src/app/api/exams/[id]/submit/route.ts
import { submitLiveExam } from "@/actions/exam-actions";
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await verifyRequestUser(req);      // Bearer token → student id
  if (!user) return unauthorized();
  const body = await req.json();
  const result = await submitLiveExam({           // ⚠️ actions-এর ফাংশন রিইউজ
    examId: params.id, studentId: user.id, answers: body.answers,
  });
  return json(result);
}
```

**টেস্টিং:**
- [ ] প্রতিটি রুট curl/Postman দিয়ে: success + error path (401, 403 না-এনরোলড, 409 ডুপ্লিকেট)
- [ ] ওয়েব অ্যাপ regression: লগইন, এনরোল, লাইভ পরীক্ষা, লিডারবোর্ড — সব আগের মতো কাজ করে
- [ ] `GET /api/home`-এর রেসপন্স-টাইম mid-range নেটওয়ার্কে যুক্তিসঙ্গত (< ৫০০ms সার্ভার-সাইড)

**কোডিং অ্যাসিস্ট্যান্ট প্রম্পট (উদাহরণ):**
```
`API-INVENTORY.md` অনুযায়ী স্টুডেন্ট-ফেসিং server actions-গুলো
`src/app/api/**/route.ts` Route Handler-এ রূপান্তর করো।
নিয়ম: (১) actions ফাংশন রিইউজ করো, লজিক ডুপ্লিকেট নয়;
(২) প্রশ্ন-রেসপন্সে কখনো সঠিক-উত্তর field থাকবে না;
(৩) auth = Bearer supabase token → auth.getUser(); role-চেক হেল্পার রোল-রেডি;
(৪) সব রুটে সার্ভার-স্ট্যাম্পড সময় field;
(৫) হোমের জন্য `GET /api/home` aggregate এন্ডপয়েন্ট (৬-৭ কল নয়, ১ কল)।
প্রথমে `src/lib/api-helpers.ts` ও `GET /api/time`, তারপর exam-flow রুট।
প্রতিটি রুটের জন্য Postman-পরীক্ষাযোগ্য curl উদাহরণ একটা `API-TESTS.md`-এ লেখো।
```

**DoD:** সব স্টুডেন্ট এন্ডপয়েন্ট কাজ করে (curl-প্রমাণিত); ওয়েব অ্যাপ regression-পাস; API-TESTS.md তৈরি।

---

## ফেজ ২

### Android ফাউন্ডেশন (১–২ সপ্তাহ)

**টাস্ক:**
- [ ] Android Studio-তে নতুন প্রজেক্ট (`android-app/`), package + applicationId ঠিক করুন
- [ ] `libs.versions.toml` version catalog: Compose BOM, Hilt, Retrofit, kotlinx.serialization, Room, DataStore, Media3, FCM, Coil, Macrobenchmark
- [ ] থিম: Material 3, ব্র্যান্ড কালার (ওয়েবের সাথে সামঞ্জস্য), Hind Siliguri ফন্ট, বাংলা string resources
- [ ] নেভিগেশন স্ক্যাফোল্ড: bottom nav (হোম, কোর্স, প্র্যাকটিস, নোটবুক, প্রোফাইল) + nested graphs (exam, course detail, ভিডিও...)
- [ ] নেটওয়ার্ক: Retrofit + OkHttp `AuthInterceptor` (Bearer), `ErrorInterceptor` (API error format পার্স)
- [ ] Room schema v1: `mistakes`, `bookmarks`, `practiceOffline`, `examAttemptCache`, `homeCache`
- [ ] Session: DataStore-এ token + student প্রোফাইল; অ্যাপ ওপেনে token validity চেক
- [ ] Google Sign-In: Credential Manager / Google Identity Services → Supabase token
- [ ] `BangladeshTimeProvider`: অ্যাপ স্টার্ট/রিজিউমে `GET /api/time` → offset ক্যাশ; সব টাইমার এর উপর ভিত্তি করে
- [ ] Splash Screen API (Android 12+); স্টার্টআপ পাথে নেটওয়ার্ক নয় — ক্যাশেড ডেটা দিয়ে UI
- [ ] **benchmark মডিউল** (Macrobenchmark + Baseline Profile skeleton) — সেকশন ২২

**কোডিং অ্যাসিস্ট্যান্ট প্রম্পট:**
```
`NATIVE-ANDROID-GUIDE.md`-এর ফেজ ২ অনুযায়ী android-app/ প্রজেক্ট সেটআপ করো।
Gradle: version catalog + Hilt + Retrofit + Room + DataStore + Compose BOM + benchmark মডিউল।
নেটওয়ার্ক লেয়ার: Retrofit interface (API কন্ট্রাক্ট v1 অনুযায়ী), AuthInterceptor,
sealed UiState, error ম্যাপিং। Google Sign-In → Supabase session → DataStore।
Splash Screen API + ক্যাশেড-ফার্স্ট হোম। DoD: অ্যাপ build হয়, লগইন ফ্লো token ধরে,
GET /api/time সফল, cold start < ২s (mid-range ডিভাইস)।
```

**DoD:** অ্যাপ এমুলেটরে রান করে; লগইন + `/api/time` + `/api/student/me` লাইভ সার্ভারে কাজ করে; bottom-nav স্ক্যাফোল্ড দৃশ্যমান; **cold-start টার্গেট মাপা হয়েছে** (সেকশন ২২.১)।

---

## ফেজ ৩

### ড্যাশবোর্ড ও কন্টেন্ট স্ক্রিন (২–৩ সপ্তাহ)

**টাস্ক:**
- [ ] **হোম/ড্যাশবোর্ড:** `GET /api/home` (১ কল) → হিরো ব্যানার, স্ট্যাট কার্ড, লাইভ পরীক্ষার গ্রিড, আসন্ন পরীক্ষা, ফ্রি এক্সাম স্পটলাইট, দৈনিক নিউজ কার্সেল, সেলফ-প্র্যাকটিস কার্ড (ওয়েব `components/dashboard/*` থেকে ফাংশনাল মিরর)
- [ ] **লগইন-গেট:** প্রথমবার দেখা কন্টেন্টে লগইন prompt (ওয়েবের landing gate-এর মতো)
- [ ] **প্রোফাইল:** নাম/ছবি/ইমেইল, পরিসংখ্যান (accuracy, best/average — `student-analytics` থেকে)
- [ ] লোডিং/এম্পটি/এরর state + pull-to-refresh — **ক্যাশেড ডেটা আগে দেখান, নেট আপডেট পেছনে** (skeleton → content)
- [ ] লিস্ট-পারফরম্যান্স রুল মেনে চলুন (সেকশন ২২.২): LazyColumn, key, Coil, পেজিনেশন

**কোডিং অ্যাসিস্ট্যান্ট প্রম্পট:**
```
হোম ড্যাশবোর্ড স্ক্রিন বানাও: `GET /api/home` থেকে ডেটা এনে Compose LazyColumn-ভিত্তিক UI
(ক্যাটাগরি সেকশন)। offline-first: Room ক্যাশ → নেট আপডেট; UiState (Loading/Success/Error),
pull-to-refresh, খালি state। লিস্ট পারফরম্যান্স রুল (NATIVE-ANDROID-GUIDE.md সেকশন ২২.২) মানো।
বাংলা টেক্সট ও ওয়েবের ব্র্যান্ড টোন অনুসরণ করো। DoD: mid-range ডিভাইসে jank-free স্ক্রল
(Macrobenchmark), অফলাইনেও কন্টেন্ট দেখা যায়।
```

**DoD:** হোম + প্রোফাইল লাইভ API দিয়ে কাজ করে; সব সেকশনে লোডিং/এরর হ্যান্ডলিং; **৬০fps স্ক্রল + অফলাইন-ফার্স্ট ক্যাশ** প্রমাণিত।

---

## ফেজ ৪

### কোর্স, এনরোলমেন্ট ও ভিডিও (১–২ সপ্তাহ)

**টাস্ক:**
- [ ] কোর্স লিস্ট → ডিটেইল (ডিটেইলস, প্রাইস, বোনাস কনটেন্ট)
- [ ] এনরোলমেন্ট ফ্লো: ফ্রি → সরাসরি এনরোল; পেইড → ফর্ম (নাম, ফোন, TRX id, পেমেন্ট মাধ্যম) → `POST /enroll` → "অপেক্ষায়" স্ট্যাটাস
- [ ] এনরোলমেন্ট স্ট্যাটাস UI: pending/approved/rejected (পোল বা পুশ দিয়ে আপডেট)
- [ ] ভিডিও প্লেয়ার: Media3 ExoPlayer, playlist, অগ্রগতি সেভ; **না-এনরোলড হলে 403 UI**; ভিডিও লিস্ট ভার্চুয়ালাইজড
- [ ] WhatsApp গ্রুপ লিংক (শুধু এনরোলড অ্যাপ্রুভড) — Intent দিয়ে WhatsApp খোলা

**DoD:** এনরোলড-অনলি ভিডিও/গ্রুপ অ্যাক্সেস সার্ভার-ভেরিফাইড; TRX ফ্লো শেষ পর্যন্ত স্ট্যাটাস দেখায়; ভিডিও স্ক্রিনে সুইচ করলে UI জমে না।

---

## ফেজ ৫

### প্র্যাকটিস ও প্রশ্নব্যাংক (১–২ সপ্তাহ)

**টাস্ক:**
- [ ] প্র্যাকটিস সেশন সেটআপ: টপিক/ক্যাটাগরি/সংখ্যা বাছাই → প্রশ্ন ফেচ
- [ ] প্র্যাকটিস প্লেয়ার: প্রশ্ন → উত্তর দিলে **সাথে সাথে** সঠিক/ভুল + ব্যাখ্যা (প্র্যাকটিসে লিক-নিয়ম নেই); অ্যানিমেটেড ট্রানজিশন
- [ ] সেশন শেষ: স্কোর সারাংশ → `POST /api/practice/submit`
- [ ] প্রশ্নব্যাংক ব্রাউজার: টপিক-হায়ারার্কি ড্রিল-ডাউন (ওয়েবের `TopicTreeViewer` মিরর) — **পেজিনেটেড লিস্ট**
- [ ] অফলাইন প্র্যাকটিস (ঐচ্ছিক, v1.1): সেট ডাউনলোড → Room → অফলাইনে খেলা → নেট এলে সিংক

**DoD:** প্র্যাকটিস সেশন সম্পূর্ণ চক্র (সেটআপ → খেলা → ফলাফল); প্রশ্নব্যাংক টপিকে ঢোকে; দীর্ঘ লিস্টে স্ক্রল স্মুথ।

---

## ফেজ ৬

### লাইভ পরীক্ষা ইঞ্জিন (কোর) (৩–৪ সপ্তাহ) ⭐

**লক্ষ্য:** ওয়েবের নিরাপত্তা-মডেল হুবহু, native UX-এ — **টাইমার টিক বা সাবমিটে কোনো জ্যাঙ্ক ছাড়া**।

**পরীক্ষা-অবস্থা মেশিন (state machine):**
```
IDLE → (start tapped, window valid) → FETCHING → IN_PROGRESS
IN_PROGRESS → (user submits | countdown 0 | window expired) → SUBMITTING
SUBMITTING → SUCCESS(submissionId) | FAILED(retry w/ WorkManager)
SUCCESS → (endTime+10s পেরোলে) → RESULT_AVAILABLE → REVIEW
```

**টাস্ক:**
- [ ] প্রি-ফ্লাইট চেক: লগইন আছে? পরীক্ষা live উইন্ডোতে? আগে সাবমিট করেনি? (সার্ভারও চেক করে — অ্যাপ শুধু UX)
- [ ] `GET /questions`: প্রশ্ন + `serverTime` + `endTime`; **DTO-তে উত্তর-কী field-ই নেই** (টাইপ-নিরাপদ লিক-প্রুফ)
- [ ] প্রশ্ন UI: option lock (সিলেক্ট → অপরিবর্তনীয়), question palette (answered/unanswered/current), টাইমার হেডার — palette ভার্চুয়ালাইজড (অনেক প্রশ্ন = LazyVerticalGrid)
- [ ] কাউন্টডাউন: `BangladeshTimeProvider` থেকে; **টিক প্রতি সেকেন্ডে শুধু টাইমার-টেক্সট আপডেট** (isolated composable) — পুরো স্ক্রিন রি-কম্পোজ নয় (সেকশন ২২.৪)
- [ ] **ব্যাকগ্রাউন্ড/ফোরগ্রাউন্ড:** lifecycle-এ window expiry চেক; সময় ফুরালে/ব্যবহারকারী সাবমিটে → `POST /submit` (অ্যাপ killed থাকলেও WorkManager retry)
- [ ] ডুপ্লিকেট সাবমিশন গার্ড: সার্ভার unique-index-এ 409 → UI "ইতোমধ্যে জমা হয়েছে"
- [ ] টাইমার শেষে auto-submit + pending answer warning
- [ ] Exam UI-তে নেভিগেশন লক (ব্যাক ডায়ালগ: "পরীক্ষা ছাড়বেন?" — নিশ্চিত হলে সাবমিট)
- [ ] নেটওয়ার্ক হারালে: লোকাল pending-queue (Room) → নেট এলে WorkManager submit — **UI জমে থাকবে না**
- [ ] Option ট্যাপে instant visual feedback (optimistic lock) — সার্ভার রাউন্ডট্রিপের অপেক্ষা নেই

**কোডিং অ্যাসিস্ট্যান্ট প্রম্পট (বড় কাজ — ভাগে ভাগে দিন):**
```
(১) ExamScreen state machine + প্রশ্ন UI (option lock, palette, টাইমার) — fake data দিয়ে।
(২) BangladeshTimeProvider + countdown ইন্টিগ্রেশন — টিক শুধু টাইমার কম্পোজেবলে।
(৩) Submit pipeline: Retry-সহ (Room pending queue + WorkManager), 409 হ্যান্ডলিং।
নিয়ম মেনে চলো: উত্তর-কী কখনো ক্লায়েন্টে নেই; স্কোর শুধু সার্ভার-রেসপন্স থেকে;
প্রতি-সেকেন্ড টিকে পুরো স্ক্রিন রি-কম্পোজ হবে না।
```

**DoD:** এমুলেটর + রিয়েল ডিভাইসে পরীক্ষা: শুরু→উত্তর→সাবমিট→(10s পর) রেজাল্ট; ঘড়ি বদলালে/অ্যাপ killed করলেও উইন্ডো ঠিক; ডুপ্লিকেট সাবমিট ব্লক; **টাইমার চলাকালীন ৬০fps (কোনো জ্যাঙ্ক নেই)**।

---

## ফেজ ৭

### রেজাল্ট ও লিডারবোর্ড (১ সপ্তাহ)

**টাস্ক:**
- [ ] রেজাল্ট স্ক্রিন: স্কোর, অ্যাকুরেসি, সঠিক/ভুল/বাদ, র‍্যাংক (সার্ভার ডেটা থেকে)
- [ ] প্রশ্ন-রিভিউ: প্রতিটি প্রশ্ন + আপনার উত্তর + সঠিক উত্তর + ব্যাখ্যা (শুধু release-এর পরে) — দীর্ঘ রিভিউ পেজিনেটেড/ভার্চুয়ালাইজড
- [ ] লিডারবোর্ড: র‍্যাংক টেবিল (মাস্কড ফোন), নিজের অবস্থান হাইলাইট; ১৫–৩০সে পোলিং **lifecycle-aware** (ব্যাকগ্রাউন্ডে বন্ধ; পরে WebSocket/Supabase Realtime আপগ্রেড)
- [ ] ফলাফল শেয়ার (ইমেজ কার্ড, ঐচ্ছিক) — ওয়েবের OG-স্টাইল

**DoD:** রেজাল্ট টাইম-গেটেড রিলিজ; লিডারবোর্ড রিফ্রেশ হয়; পোলিং ব্যাকগ্রাউন্ডে ব্যাটারি খায় না।

---

## ফেজ ৮

### মিসটেক/বুকমার্ক সিংক ও অফলাইন (১–২ সপ্তাহ)

**টাস্ক:**
- [ ] Room-এ লোকাল মিসটেক/বুকমার্ক (অফলাইন-ফার্স্ট রাইট — **UI তৎক্ষণাৎ আপডেট, সিংক ব্যাকগ্রাউন্ডে**)
- [ ] সিংক ইঞ্জিন: নেট এলে `PUT /api/mistakes` (per-item updatedAt merge — ওয়েবের মতো conflict policy নোট করুন)
- [ ] পরীক্ষার পর অটো "ভুলগুলো মিসটেক-নোটবুকে যোগ করুন" prompt
- [ ] নোটবুক UI: টপিক-গ্রুপ, স্ট্যাটিস্টিকস, মুছে ফেলা, বুকমার্কড প্রশ্ন

**DoD:** দুটি ডিভাইসে লগইন → একটিতে ভুল যোগ → অন্যটিতে সিংক-আপডেট (ওয়েবসহ cross-device); ট্যাপ-টু-সেভ < ৫০ms অনুভূতি।

---

## ফেজ ৯

### নিউজ, নোটিফিকেশন ও ডিপলিংক (১ সপ্তাহ)

**টাস্ক:**
- [ ] নিউজ স্ক্রিন (ওয়েব `DailyNewsSection` মিরর) + read-count পোস্ট — নিউজ লিস্ট পেজিনেটেড + অফলাইন ক্যাশ
- [ ] FCM: পরীক্ষা শুরুর ১৫ মিনিট আগে; রেজাল্ট রেডি; এনরোল অ্যাপ্রুভড; দৈনিক নিউজ (টপিক: exam/news/enroll)
- [ ] **এনরোলমেন্ট-অ্যাপ্রুভাল ট্র্যাকিং:** ব্যাকগ্রাউন্ড চেক → পুশ (সার্ভার-সাইড ট্রিগার বা অ্যাপ পোল)
- [ ] ডিপলিংক: `https://aarohon.com/exam/{id}` / custom scheme → অ্যাপে exam স্ক্রিন
- [ ] নোটিফিকেশন পারমিশন ফ্লো (Android 13+ runtime) — টাইমিং সঠিক (ব্যবহারকারী টা-পারলে, আগে নয়)

**DoD:** টেস্ট FCM নোটিফিকেশন আসে (< ২s delay); ডিপলিংক সঠিক স্ক্রিন খোলে; অ্যাপ ঠান্ডা অবস্থায়ও ডিপলিংক কাজ করে।

---

## ফেজ ১০

### টেস্টিং ও QA (১–২ সপ্তাহ)

**টাস্ক:**
- [ ] Unit: সময়-গণনা, submit-পেলোড বিল্ডিং, UI state ট্রানজিশন
- [ ] Compose UI test: প্রশ্ন UI (lock behavior), টাইমার, এরর state
- [ ] **Macrobenchmark (সেকশন ২২):** FrameTimingMetric (jank%), StartupTimingMetric — CI-তে
- [ ] ডিভাইস ম্যাট্রিক্স: Android 8–14, ছোট (৩২০dp) ও বড় স্ক্রিন, বাংলা লোকাল, offline mode
- [ ] **low/mid-range রিয়েল ডিভাইসে ১৫-মিনিট সেশন:** স্ক্রল, টাইমার, ভিডিও, সিংক — jank-free
- [ ] রিয়েল-ডিভাইস exam চক্র: শুরু→ব্যাকগ্রাউন্ড→killed→রিস্টার্ট→সাবমিট
- [ ] নেটওয়ার্ক শর্ত: slow/flaky (Network Profile), অফলাইন → retry
- [ ] Security smoke: proxy (mitmproxy) দিয়ে ট্রাফিক দেখে নিশ্চিত হন প্রশ্নে উত্তর-কী নেই
- [ ] বিটা: Play Console closed testing (২০–৫০ জন চাকরিপ্রত্যাশী) — বাগ + "কতটা স্মুথ লাগল" ফিডব্যাক

**DoD:** টেস্ট পাস; **পারফরম্যান্স গেট (সেকশন ২২.৬) পাস**; বিটা ফিডব্যাকে critical bug নেই।

---

## ফেজ ১১

### Play Store লঞ্চ (১ সপ্তাহ)

**টাস্ক:**
- [ ] App icon/splash (ওয়েব ব্র্যান্ডিং থেকে), বাংলা + ইংরেজি listing
- [ ] App signing (Play App Signing) — keystore ব্যাকআপ নিরাপদ জায়গায়
- [ ] Privacy Policy + Data Safety form: অ্যাকাউন্ট, TRX (আর্থিক লেনদেন), কন্টাক্ট
- [ ] **পেমেন্ট নীতি যাচাই ⚠️:** বাহ্যিক পেমেন্ট (bKash/Nagad TRX ম্যানুয়াল) — Google Play নীতিমালার সাথে মিলিয়ে নিন (শিক্ষামূলক কন্টেন্টে কঠোর হতে পারে; বিকল্প: Play Billing অথবা region-specific নিয়ম)
- [ ] **Baseline Profile রিলিজে অন্তর্ভুক্ত** (সেকশন ২২.১); ProGuard/R8 rules, minify enable, release build টেস্ট
- [ ] App Bundle আপলোড; size < ২৫MB যাচাই
- [ ] Crashlytics দিয়ে staged rollout (১০% → ৫০% → ১০০%)

**DoD:** অ্যাপ Play Console-এ published (production বা staged)।

---

## ১৯. নিরাপত্তা চেকলিস্ট

- [ ] প্রশ্নের DTO/JSON-এ কোনো উত্তর-কী/ব্যাখ্যা field নেই (টাইপ-লেভেলে গ্যারান্টি, শুধু naming নয়)
- [ ] স্কোরিং/রিলিজ-লজিক ১০০% সার্ভারে; অ্যাপ শুধু সার্ভারের রেজাল্ট রেন্ডার করে
- [ ] সব গেটেড রুটে সার্ভার-সাইড `verifyStudentAccess`
- [ ] Exam window সবসময় সার্ভার-টাইমে যাচাই (ক্লায়েন্ট claim নয়)
- [ ] Bearer token DataStore-এ (EncryptedSharedPreferences/Keystore); log-এ কখনো token/উত্তর নয়
- [ ] SSL pinning (ঐচ্ছিক, production hardening) — proxy-Test সহজ রাখতে dev-build-এ বন্ধ
- [ ] API rate limiting / একাউন্ট-লকআউট বিবেচনা
- [ ] কোডে কোনো hardcoded key/secret নেই
- [ ] রিলিজ build: minify + R8 + Baseline Profile + crash ফ্রি

---

## ২০. সাধারণ ভুল ও টিপস

1. **WebView-এ ফিরে যাবেন না** — native-র সুবিধা (অফলাইন, পুশ, পারফরম্যান্স, anti-tamper) থাকবে না; WebView-এর জ্যাঙ্কই তো এই প্রজেক্টের শুরু।
2. **একসাথে সব বানাতে যাবেন না** — ফেজ ৬ (exam engine) একবার ঠিক করলে বাকিটা স্ক্রিন-ওয়ার্ক।
3. **সার্ভার-টাইম ছাড়া কোনো টাইমার নয়** — dev-এ দেখবেন ডিভাইস ঘড়ি ঠিক থাকলে কাজ করছে, কিন্তু রিয়েল ইউজারে ভাঙবে।
4. **নতুন API রুটে ওয়েব regression** — প্রতিটি ফেজে ওয়েব অ্যাপও টেস্ট করুন (একই সার্ভার চলছে)।
5. **applicationId একবার ঠিক করুন** — পরে বদলানো = নতুন অ্যাপ।
6. **বাংলা লোকাল টেস্ট** — string resources-এ হার্ডকোড বাংলা না রেখে resources-এ রাখুন (ভবিষ্যতে i18n)।
7. **স্ক্রিনশট/রেকর্ডিং ব্লক নিয়ে বেশি মাথা ঘামাবেন না** — সার্ভার-সাইড গার্ডই আসল ঢাল।
8. **"স্মুথ" পরে বানানো যায় না** — পারফরম্যান্স রুল (সেকশন ২২) প্রতিটি ফেজে, শুরু থেকেই; শেষে ঠিক করতে গেলে রি-রাইট করতে হবে।
9. **সব ডিভাইসে টেস্ট নয় — সঠিক ডিভাইসে টেস্ট** — ফ্ল্যাগশিপে স্মুথ = মাঝারি ডিভাইসে জ্যাঙ্ক; মানদণ্ড low/mid-range রাখুন।

---

## ২১. সময়-অনুমান (১ জন ডেভেলপার)

| ফেজ | সময় | নির্ভরতা |
|---|---|---|
| ০ প্রস্তুতি | ০.৫–১ দিন | — |
| ১ API রূপান্তর | ২–৩ সপ্তাহ | ফেজ ০ |
| ২ ফাউন্ডেশন | ১–২ সপ্তাহ | ফেজ ১ (প্যারালাল শুরু করা যায়) |
| ৩ ড্যাশবোর্ড/কন্টেন্ট | ২–৩ সপ্তাহ | ফেজ ২ |
| ৪ কোর্স/এনরোল/ভিডিও | ১–২ সপ্তাহ | ফেজ ৩ |
| ৫ প্র্যাকটিস/প্রশ্নব্যাংক | ১–২ সপ্তাহ | ফেজ ৩ |
| ৬ লাইভ পরীক্ষা (কোর) | ৩–৪ সপ্তাহ | ফেজ ২ + ১ |
| ৭ রেজাল্ট/লিডারবোর্ড | ১ সপ্তাহ | ফেজ ৬ |
| ৮ সিংক/অফলাইন | ১–২ সপ্তাহ | ফেজ ৫, ৬ |
| ৯ নিউজ/নোটিফিকেশন | ১ সপ্তাহ | ফেজ ৩ |
| ১০ QA/বিটা (পারফরম্যান্স গেটসহ) | ১–২ সপ্তাহ | ফেজ ৪–৯ |
| ১১ Play Store | ১ সপ্তাহ | ফেজ ১০ |
| **মোট (v1 স্টুডেন্ট)** | **~৩–৪ মাস (ফুল-টাইম)** | |

> **v2 (অ্যাডমিন native):** অতিরিক্ত ~২–৩ মাস (২০+ স্ক্রিন, রোল-ভিত্তিক অ্যাক্সেস, AI জেনারেটর UI, analytics) — API রোল-কাঠামো v1-এ রেডি থাকায় API-খরচ কম থাকবে।

---

## ২২. স্মুথনেস ও পারফরম্যান্স ইঞ্জিনিয়ারিং

> **কেন native:** WebView-এ JS-বান্ডেল লোড, DOM রি-ফ্লো, নেটওয়ার্ক ওয়াটারফল — স্ক্রল ও স্টার্টআপে দৃশ্যমান জ্যাঙ্ক। Compose দিয়ে ৬০/১২০fps native rendering, instant touch feedback ও offline ক্ষমতা মেলে।
> **মূল নীতি:** "খুবই স্মুথ" কোনো ফিচার নয় — এটা **প্রতিটি ফেজের গেট**। নিচের নিয়মগুলো শুরু থেকেই মানুন; শেষে ঠিক করা যায় না।

### ২২.১ স্টার্টআপ (আপ-টাইম)

- [ ] Android 12+ **Splash Screen API** (নিজের splash না); স্প্ল্যাশে কোনো নেটওয়ার্ক কল নেই — ক্যাশেড ডেটা দিয়ে UI তৎক্ষণাৎ
- [ ] ভারী init (Crashlytics, FCM, analytics) core-path-এর বাইরে — deferred/background
- [ ] **Cold start টার্গেট: mid-range ডিভাইসে < ১.৫–২ সেকেন্ড** — Macrobenchmark দিয়ে মাপুন
- [ ] **Baseline Profile** (রিলিজ build-এ অন্তর্ভুক্ত) + Startup Profile — সবচেয়ে বেশি লাভ
- [ ] R8/minify + resource shrinking; **App Bundle** (size < ২৫MB টার্গেট)

### ২২.২ স্ক্রলিং ও রি-কম্পোজিশন (৬০fps গ্যারান্টি)

- [ ] লিস্ট = `LazyColumn` (কখনো `Column + verticalScroll` নয়); প্রতিটি item ছোট composable + `key()`
- [ ] ভারী হিসাব `remember`/`derivedStateOf`; state hoisting — এক item বদলালে পুরো লিস্ট রি-কম্পোজ নয়
- [ ] ছবি: Coil + disk/memory cache + placeholder + downsampling — লিস্টে বড় bitmap কখনো নয়
- [ ] নিউজ/প্রশ্নব্যাংক/লিডারবোর্ড/রিভিউ = **পেজিনেশন** (Paging 3 বা manual offset), একবারে ২০–৩০ item
- [ ] LazyColumn item-এ unstable class নয় (immutable data class); lambda stable রাখুন
- [ ] ভারী গ্রিড (question palette) = `LazyVerticalGrid`

### ২২.৩ ডেটা লেয়ার (জ্যাঙ্কের আসল উৎস নেটওয়ার্ক)

- [ ] লিস্ট স্ক্রিন **offline-first**: Room = single source of truth; UI Room-Flow দেখে, নেটওয়ার্ক শুধু আপডেট করে (দ্বিতীয়বার খুললে ইনস্ট্যান্ট — "স্মুথ"-এর বড় অংশ)
- [ ] ড্যাশবোর্ড = **একটি aggregate কল** (`GET /api/home`) — স্টার্টআপে ৫–৬টি কলের ওয়াটারফল নয়
- [ ] ব্যাকগ্রাউন্ড prefetch (WorkManager): নিউজ/কোর্স আগে থেকেই ক্যাশ — ইউজার খোলার আগেই রেডি
- [ ] সব নেটওয়ার্ক `Dispatchers.IO`; main thread-এ শুধু state update
- [ ] পুনরাবৃত্তি কল (লিডারবোর্ড পোল) — **lifecycle-aware**: ব্যাকগ্রাউন্ডে বন্ধ; কন্টেন্ট দৃশ্যমান হলেই চলে

### ২২.৪ টাইমার/অ্যানিমেশন (এক্সাম স্ক্রিন স্পেশাল)

- [ ] প্রতি সেকেন্ডের টিক **শুধু টাইমার-টেক্সট আপডেট** করবে — isolated ছোট composable + ticker Flow; পুরো exam screen রি-কম্পোজ নয়
- [ ] Option ট্যাপে instant feedback (optimistic UI) — নেটওয়ার্ক রেসপন্সের অপেক্ষায় UI জমে থাকে না
- [ ] Consistent motion: Material `AnimatedContent`/`Crossfade` স্ক্রিন-ট্রানজিশন; over-animate নয় (জ্যাঙ্কের উৎস)
- [ ] Haptics (select-এ হালকা) + predictive back — "native feel"-এর অংশ
- [ ] বাংলা টেক্সট: সঠিক font metrics (Hind Siliguri) + line-height; লম্বা প্রশ্নে ক্লিপিং/ব্লার নয় — রিয়েল ডিভাইসে যাচাই

### ২২.৫ পরিমাপ (না মেপে "স্মুথ" বলা যাবে না)

- [ ] **Macrobenchmark**: `FrameTimingMetric` (jank%), `StartupTimingMetric` — CI-তে চালান, regression ধরা পড়বে
- [ ] মানদণ্ড-ডিভাইস: emulator/ফ্ল্যাগশিপ **নয়** — **low/mid-range রিয়েল ডিভাইস** (যেমন ৪GB RAM, Android ১১)
- [ ] dev-build-এ LeakCanary (মেমরি লিক) — রিলিজে বাদ
- [ ] নেটওয়ার্ক: slow-3G প্রোফাইলে স্ক্রিন খালি/জমে থাকে না — skeleton/shimmer + ক্যাশেড কন্টেন্ট
- [ ] ভিডিও: স্ক্রলিং-এ ভিডিও রেন্ডার থেমে/ঝাঁকি খায় না; seek স্মুথ

### ২২.৬ পারফরম্যান্স গেট (প্রতি ফেজের DoD-তে)

| ফেজ | গেট |
|---|---|
| ২ ফাউন্ডেশন | cold start < ২s (mid-range); স্ক্যাফোল্ড jank-free |
| ৩ ড্যাশবোর্ড | হোম ১ API কল; লিস্ট ৬০fps; ছবি cached; অফলাইন-ফার্স্ট |
| ৫–৬ প্র্যাকটিস/এক্সাম | টাইমার টিক শুধু হেডার; option instant feedback; submit background; ৬০fps |
| ৭ লিডারবোর্ড | পেজিনেটেড; পোলিং lifecycle-aware |
| ৮–৯ সিংক/নিউজ | ব্যাকগ্রাউন্ড কাজ main thread-এ নয়; নোটিফিকেশন < ২s |
| ১০ QA | Macrobenchmark পাস + low-end ডিভাইসে ১৫-মিনিট সেশন jank-free |
| ১১ রিলিজ | Baseline Profile + App Bundle < ২৫MB + staged rollout |

---

## এখনই করার ৩টি কাজ

1. `API-INVENTORY.md` তৈরি করান (ফেজ ০-র প্রম্পট) — এটাই পরবর্তী সব কাজের মানচিত্র।
2. **ফেজ ১-এর পাইলট:** `GET /api/time` + `POST /api/auth/session` রুট বানিয়ে ওয়েব-রিগ্রেশন ছাড়া কাজ করে দেখান।
3. Android প্রজেক্ট skeleton + Google Sign-In PoC শুরু করুন (ফেজ ২-এর সাথে সমান্তরালে) — **cold-start ও প্রথম স্ক্রল মাপা দিয়ে** (সেকশন ২২.৫)।

> **ভবিষ্যৎ আপডেট:** ডকুমেন্টে নতুন সিদ্ধান্ত (যেমন Edge Function-এ মাইগ্রেশন, Realtime লিডারবোর্ড, v2 অ্যাডমিন স্কোপ) আসলে এই ফাইলের সংশ্লিষ্ট সেকশন আপডেট করে রাখুন — এটাই অ্যাসিস্ট্যান্টদের সাথে কাজের স্থায়ী স্মৃতি।
