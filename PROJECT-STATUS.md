# BCS One — প্রকল্পের অবস্থা ও হ্যান্ডঅভার

> ## ⚠️ এই ফাইলটা ওয়েব/API-দিকের। অ্যাপের জন্য অন্য ফাইল।
>
> প্রকল্প এখন **দুইটা আলাদা রেপোতে** — আগে এখানে ভুল পাথ লেখা ছিল
> (`D:\App\bcs-one-flutter`, যেটা এখন একটা খালি খোলস)।
>
> | প্রকল্প | আসল পাথ | রেপো |
> |---|---|---|
> | **Android অ্যাপ** (Flutter) | `D:\DEEPSEEK\bcs-one-flutter` | `officialtashdid/xmetriexApp` (private) |
> | **ওয়েব + REST API** (Next.js) | `D:\App\bcs-one-nextjs` | `officialtashdid/xmetriex` |
>
> **নতুন সেশনে দুই পাথ দিলেই হবে।** অ্যাপের হ্যান্ডঅভার-ডকুমেন্ট সবচেয়ে
> হালনাগাদ থাকে এখানে: **`D:\DEEPSEEK\bcs-one-flutter\PROJECT-STATUS.md`**
> — সেটাই আগে পড়ুন।

**সর্বশেষ হালনাগাদ:** ২০২৬-০৯-২০ (রিজিয়ন `sin1`, `/api/profile`-এর N+1 সমাধান)
· আগের: ২০২৬-০৯-১৬

---

## ১. কাজটা দুই প্রকল্পে — দুটোই লাগবে

| প্রকল্প | কী | কেন দরকার |
|---|---|---|
| `D:\App\bcs-one-nextjs` | ওয়েব অ্যাপ (Next.js 14) **+ REST API লেয়ার** | অ্যাপের সব ডেটা এখান থেকেই আসে |
| `D:\DEEPSEEK\bcs-one-flutter` | **Android অ্যাপ** (Flutter) | ব্যবহারকারী যেটা ফোনে চালান |

### ২০২৬-০৯-২০-এ এই রেপোতে যা হলো

| কাজ | কমিট |
|---|---|
| Vercel ফাংশন `iad1` (আমেরিকা) → **`sin1`** (সিঙ্গাপুর — Supabase-এর পাশে), `vercel.json`-এ | `275242a` |
| `/api/profile` ও `/api/profile/results`-এর **N+1** সারানো (র্যাঙ্ক-কুয়েরি এখন ব্যাচে/সমান্তরালে) | `0d31995` |

মাপা ফল (বাংলাদেশ থেকে): `/api/home` **১২৫০ms → ~৩৮০ms**, আর র্যাঙ্ক-গণনা
**৬৩৫৬ms → ৩৬১ms (১৭.৬×, ২২ পরীক্ষা/৬৬ কুয়েরি, ০ অমিল)**।

⚠️ ডিপ্লয় আসে **`xmetriex`** রিমোট থেকে (`origin` নয় — ওটা ১৯ কমিট পিছিয়ে)।

শুধু Flutter পাথ দিলেও চলবে, কিন্তু API-র কাজ করতে হলে Next.js প্রকল্পটাও লাগবে।

### আগে যে ডকুমেন্টগুলো পড়তে হবে (এই ক্রমে)

1. `D:\App\bcs-one-nextjs\NATIVE-ANDROID-GUIDE.md` — মূল আর্কিটেকচার, API কন্ট্রাক্ট (§৬), নিরাপত্তা (§১৯), পারফরম্যান্স (§২২)
2. `D:\App\bcs-one-nextjs\FLUTTER-ANDROID-GUIDE.md` — Flutter সংস্করণ, ফেজ-প্ল্যান, কী কী হয়েছে
3. `D:\App\bcs-one-nextjs\FLUTTER-VERIFICATION-ADDENDUM.md` — **সবচেয়ে দরকারি**: টেস্ট-কৌশল, ডায়াগনস্টিক ডিজাইন, আর যে ৮টি ফাঁদে একবার পড়া হয়েছে
4. `D:\App\bcs-one-flutter\SETUP.md` — বুটস্ট্র্যাপ কমান্ড

---

## ২. ডেভ-পরিবেশ (সব `D:\`-এ, `C:\`-এ কিছু নয়)

| কী | কোথায় |
|---|---|
| Flutter SDK 3.47.4 | `D:\flutter` |
| Android SDK 36 | `D:\Android\sdk` |
| Gradle cache | `D:\gradle-home` |
| Dart packages | `D:\pub-cache` |
| JDK 17 | `D:\flutter_env\jdk-17.0.2` |
| **debug keystore** | `D:\android-user\debug.keystore` |

ইউজার-লেভেল env var সেট করা আছে: `ANDROID_SDK_ROOT`, `GRADLE_USER_HOME`, `PUB_CACHE`, `JAVA_HOME`, `ANDROID_USER_HOME`.

⚠️ **`ANDROID_USER_HOME` সবসময় `D:\android-user` রাখবেন।** এটা না মিলালে Gradle **নতুন debug keystore** বানায়, আর তখন ফোনে আপডেট ইনস্টল ব্যর্থ হয় (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`)। একবার ঠিক এই সমস্যায় পড়া হয়েছিল।

---

## ৩. কীভাবে চালাবেন

### ধাপ ১ — API সার্ভার (পিসিতে)

```powershell
cd D:\App\bcs-one-nextjs
npx next dev -p 3100
```

### ধাপ ২ — ফোন ও পিসির সেতু (USB)

```powershell
adb reverse tcp:3100 tcp:3100
```

> ⚠️ **এটা ছাড়া অ্যাপ চলবে না।** অ্যাপ `http://127.0.0.1:3100`-এ কল করে, আর
> `adb reverse` USB কেবল দিয়েই ফোনের `127.0.0.1:3100`-কে পিসির `3100`-এ পাঠায়।
> ফলে **Wi-Fi বা ফায়ারওয়ালের ঝামেলাই নেই**।
> ফোনের কেবল খুললে reverse মুছে যায় — আবার চালাতে হবে।

### ধাপ ৩ — অ্যাপ চালানো (hot reload সহ — দ্রুততম পথ)

```powershell
cd D:\App\bcs-one-flutter
flutter run -d 25071JEGR13032 `
  --dart-define=BCS_API_BASE_URL=http://127.0.0.1:3100 `
  --dart-define=BCS_SUPABASE_URL=https://braytjbujysjydxbuqhv.supabase.co `
  --dart-define=BCS_SUPABASE_ANON_KEY=<.env.local থেকে>
```

তারপর কোড বদলালে **`r`** চাপলেই সেকেন্ডে ফোনে দেখা যাবে।

**anon key কোথায়:** `D:\App\bcs-one-nextjs\.env.local` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(পাবলিক key, অ্যাপে বসানোর জন্যই বানানো — কিন্তু **`SUPABASE_SERVICE_ROLE_KEY` কখনো অ্যাপে দেবেন না**, সেটা RLS বাইপাস করে।)

### অথবা — APK বানিয়ে ইনস্টল (hot reload নেই)

```powershell
cd D:\App\bcs-one-flutter
flutter build apk --debug `
  --dart-define=BCS_API_BASE_URL=http://127.0.0.1:3100 `
  --dart-define=BCS_SUPABASE_URL=https://braytjbujysjydxbuqhv.supabase.co `
  --dart-define=BCS_SUPABASE_ANON_KEY=<...>
adb install -r build\app\outputs\flutter-apk\app-debug.apk
```

⏱️ incremental বিল্ড **~৩০-৪০ সেকেন্ড**; `build\` মুছে ফেললে **~১০ মিনিট** (একবার ভুলে করা হয়েছিল)।

### যাচাই

```powershell
flutter analyze          # No issues found হওয়া উচিত
flutter test             # ৩৫টি টেস্ট পাস করা উচিত
```

---

## ৪. কী কী হয়ে গেছে

### ✅ REST API লেয়ার (Next.js) — ২৫/২৬ endpoint

`src/lib/request-context.ts` · `api-auth.ts` · `exam-api.ts` + `src/app/api/**`

| # | Endpoint | # | Endpoint |
|---|---|---|---|
| 1 | `POST /api/auth/session` | 14 | `GET /api/exams/{id}/leaderboard` |
| 2 | `GET /api/student/me` | 15 | `POST /api/practice/session` |
| 3 | `POST /api/student/sync-login` | 16 | `GET /api/practice/questions` |
| 4 | `GET /api/courses` | 17 | ❌ বাদ (ইচ্ছাকৃত — §৭ দেখুন) |
| 5 | `GET /api/courses/{name}` | 18 | `GET /api/topics` |
| 6 | `GET /api/courses/{name}/videos` | 19 | `GET /api/question-bank` |
| 7 | `POST /api/courses/{name}/enroll` | 20 | `GET /api/news` |
| 8 | `GET /api/home` | 21 | `POST /api/news/{id}/read` |
| 9 | `GET /api/exams/live` | 22–24 | `mistakes` · `bookmarks` |
| 10 | `GET /api/exams/{id}` | 25 | `GET /api/time` |
| 11 | `GET /api/exams/{id}/questions` | 26 | `POST /api/exams/{id}/heartbeat` |
| 12 | `POST /api/exams/{id}/submit` | | |
| 13 | `GET /api/exams/{id}/result` | | |

**মূল কৌশল:** ১০৪টি Server Action-এ টোকেন থ্রেড না করে `AsyncLocalStorage` ব্যবহার —
`request-context.ts` টোকেন ধরে রাখে, `teacher-auth.ts`-এর একটিমাত্র রিডার সেটা দেখে।
ফলে **ওয়েব অ্যাপে শূন্য পরিবর্তন**, আর অ্যাপ থেকেও সব action কাজ করে।

### ✅ Flutter অ্যাপ — স্ক্রিন

| স্ক্রিন | ফাইল | অবস্থা |
|---|---|---|
| ফ্রন্ট পেজ | `landing_screen.dart` | ✅ শুধু নাম + লগইন বাটন |
| লগইন | `auth/login_screen.dart` | ✅ Google OAuth (ব্রাউজার + deep link) |
| ড্যাশবোর্ড | `dashboard_screen.dart` | ✅ সংবাদ · লাইভ · ফ্রি · আসন্ন · কোর্স |
| পরীক্ষার বিস্তারিত | `exam/exam_detail_screen.dart` | ✅ |
| **পরীক্ষার হল** | `exam/exam_hall_screen.dart` | ✅ টাইমার · অটো-সাবমিট · প্যালেট |
| **রেজাল্ট** | `exam/exam_result_screen.dart` | ✅ স্কোর · প্রশ্নভিত্তিক রিভিউ |
| **লিডারবোর্ড** | `exam/leaderboard_screen.dart` | ✅ |
| **প্র্যাকটিস হাব** | `practice/practice_screen.dart` | ✅ টপিক-গ্রুপ গ্রিড |
| **প্র্যাকটিস সেশন** | `practice/practice_session_screen.dart` | ✅ ইনস্ট্যান্ট + মক |
| কোর্স · প্রশ্নব্যাংক · নোটবুক · প্রোফাইল | — | ⏳ placeholder |

---

## ৫. 🚧 যা এখনো বাকি

### (ক) Supabase-এ redirect URL — **লগইনের একমাত্র বাধা**

```
https://supabase.com/dashboard/project/braytjbujysjydxbuqhv/auth/url-configuration
```
→ **Redirect URLs** → **`+ Add URL`** → `bcsonepro://login-callback` → **Save**

> ⚠️ **"Site URL" ঘরে নয়** — Redirect URLs তালিকায়। এটাই সবচেয়ে সাধারণ ভুল।
>
> **লক্ষণ যদি এটা হয়** — "ব্রাউজারে লগইন হয়, কিন্তু অ্যাপে ফিরে আসে না" — তাহলে
> ঠিক এটাই কারণ। আর **ব্রাউজার-স্কিমে আন্ডারস্কোর রাখা যাবে না**
> (RFC 3986), তাই `com.aarohon.bcs_one_pro` নয় বরং `bcsonepro`।

### (খ) লগইন আসল ডিভাইসে যাচাই করা হয়নি

কোড লেখা ও কম্পাইল হওয়া যাচাই করা, কিন্তু **কোনো আসল ছাত্র দিয়ে সম্পূর্ণ
লগইন-ফ্লো এখনো চালানো হয়নি** (উপরের সেটিংটা বাকি থাকায়)।

### (গ) বাকি স্ক্রিন

কোর্স (তালিকা/বিস্তারিত/ভিডিও) · প্রশ্নব্যাংক · ভুল-নোটবুক · প্রোফাইল ·
প্লে-স্টোর প্রস্তুতি।

### (ঘ) নিরাপত্তা — এখনো যোগ করা হয়নি

**`FLAG_SECURE`** লাইভ পরীক্ষার হলে (স্ক্রিনশট/রেকর্ডিং বন্ধ)। গাইড §৯-এ
আবশ্যক হিসেবে লেখা, কিন্তু কোডে এখনো বসানো হয়নি। Kotlin-এর `MainActivity`-তে
একটা MethodChannel দিয়ে করতে হবে (প্যাকেজ লাগবে না)।

---

## ৬. যেসব ফাঁদে একবার পড়া হয়েছে — আর পড়বেন না

| ফাঁদ | লক্ষণ | সমাধান |
|---|---|---|
| `runApp`-এর আগে নেটওয়ার্ক `await` | অ্যাপ খুলতে ৪ সেকেন্ড | UI আগে, warm-up পেছনে |
| ফ্রন্ট পেজ `/api/home`-এর অপেক্ষা | সার্ভার না থাকলে আটকে থাকে | গেট টোকেন স্টোর থেকে (স্থানীয়) |
| `--dart-define` ক্যাশে আটকে যায় | APK-তে কনফিগ ঢোকে না | `build\` মুছে পরিষ্কার বিল্ড |
| `ANDROID_USER_HOME` অসঙ্গত | `signatures do not match` | সব বিল্ডে একই মান |
| deep-link স্কিমে আন্ডারস্কোর | OAuth ফেরে না | `bcsonepro://` |
| `flutter_test` HTTP ব্লক করে | টেস্ট মিথ্যা পাস/ব্যর্থ | `setUp(() => HttpOverrides.global = null)` |
| `scrollUntilVisible` একক এলিমেন্ট চায় | "Too many elements" | নির্দিষ্ট `find.text()` বা `findsWidgets` |
| `ListView` lazy | নিচের সেকশন খুঁজে পাওয়া যায় না | স্ক্রল করতে হবে |
| টেস্ট-স্ক্রিন ডিফল্ট ৮০০×৬০০ | ট্যাবলেট-লেআউট, ফোনের নয় | `tester.view.physicalSize` |
| `Flexible` ছাড়া ব্যাজ-Row | RenderFlex overflow | `Flexible` দিন |

---

## ৭. ইচ্ছাকৃত সিদ্ধান্ত (বাগ নয়)

- **`POST /api/practice/submit` বাদ** — ওয়েব অ্যাপ কখনো প্র্যাকটিস-স্কোর সংরক্ষণ
  করে না (কোনো টেবিল নেই), আর প্র্যাকটিসের উত্তর ক্লায়েন্ট আগেই পায় — তাই
  সার্ভার-গ্রেডিং নতুন কিছু দেয় না। ভুল উত্তর তবু `PUT /api/mistakes`-এ সংরক্ষিত হয়।
- **`GET /api/exams/live` ও `/api/exams/{id}`-এ auth ঐচ্ছিক** — মূল গাইডে বাধ্যতামূলক
  ছিল, কিন্তু অতিথিকেও পরীক্ষার তালিকা দেখানো দরকার। রেসপন্সে কোনো প্রশ্ন/উত্তর নেই।
- **প্র্যাকটিসের উত্তর ক্লায়েন্টে যাচাই হয়** — লিডারবোর্ড/পুরস্কার নেই, তাই ঝুঁকি
  শূন্য। **লাইভ পরীক্ষায় উল্টোটা**: স্কোর কেবল সার্ভারে, আর উত্তর-কী
  `endTime + পুরো পরীক্ষার দৈর্ঘ্য`-এর আগে পাঠানোই হয় না।

---

## ৮. ডিভাইস

**Pixel 6a** (`25071JEGR13032`), Android 16 (API 36) — USB-তে লাগানো।

```powershell
flutter devices      # দেখা যাবে কি না
adb devices
```

**এমুলেটর এই মেশিনে চলবে না** — হাইপারভাইজার ড্রাইভার (`aehd`) নেই, আর
ইনস্টলে অ্যাডমিন লাগে। **আসল ফোনই ব্যবহার করুন।**
