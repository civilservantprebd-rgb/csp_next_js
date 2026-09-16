# BCS One (আরোহণ) — Flutter Android অ্যাপ বিল্ড গাইড

> এটি `NATIVE-ANDROID-GUIDE.md`-এর **Flutter সংস্করণ**। ওই ডকুমেন্টে Kotlin + Jetpack Compose
> ধরে লেখা হয়েছিল; এখানে একই অ্যাপ Flutter-এ বানানোর সিদ্ধান্ত, স্ট্যাক-ম্যাপিং, আর
> **ফেজ ১ (API) সমাপ্তির রেকর্ড** আছে।
>
> **কোনটা পড়বেন:** আর্কিটেকচার, API কন্ট্রাক্ট, ফেজ-প্ল্যান, নিরাপত্তা ও পারফরম্যান্স-নীতি —
> এগুলো `NATIVE-ANDROID-GUIDE.md`-এই অপরিবর্তিত ও প্রামাণ্য (§৩, §৬, §৭–§১১, §১৯, §২২)।
> শুধু **§৪ (স্ট্যাক)**, **§৫ (প্রজেক্ট স্ট্রাকচার)** ও **§২২.৫ (পরিমাপ-হাতিয়ার)** এখানে বদলেছে।
> দুটো ডকুমেন্ট একসাথে পড়াই উদ্দেশ্য।
>
> **⚠️ আরও পড়ুন — `FLUTTER-VERIFICATION-ADDENDUM.md`** (Flutter প্রকল্পের রুটে:
> `D:\App\bcs-one-flutter\` ফাইলে)। ফেজ ২ করার সময় **হাতে-কলমে যা ধরা পড়েছে**:
> চার-স্তরের টেস্ট-কৌশল ও `flutter_test`-এর তিনটি ফাঁদ, ডায়াগনস্টিক ডিজাইন
> ("অসীম লোড" আর কখনো নয়), সব টুলিং `D:\`-এ সাজানো, NDK বন্ধ রাখা, এবং
> Android-নির্দিষ্ট সমস্যা (cleartext ব্লক, এমুলেটরের hypervisor, ডিভাইস-ঠিকানা)।
> এই গাইড যেখানে "কী করতে হবে" বলে, অ্যাডেন্ডাম সেখানে "কীভাবে জানা গেল ও
> কোথায় হোঁচট খেতে হয়" বলে — নতুন কেউ শুরু করার আগে ওটা পড়া সময় বাঁচায়।

---

## ১. সিদ্ধান্ত: কেন Flutter (Android-only হলেও)

মূল সিদ্ধান্তের ইতিহাস: অ্যাপটি **শুধু Android**-এর জন্য, তবু **Flutter** বেছে নেওয়া হয়েছে।
কারণটা "cross-platform" নয় — কারণ **যাচাইয়ের গতি**:

| মাপকাঠি | Flutter | Kotlin + Compose |
|---|---|---|
| অগ্রগতি দেখা | `flutter run` → **hot reload**, টাইপের সাথে ফোনে বদল | প্রতিবার Gradle build (৩০ সে–২ মিনিট) |
| Build ভাঙার সুযোগ | এক টুলচেইন; `flutter doctor` নিজেই ডায়াগনোজ করে | JDK/AGP/Kotlin সামঞ্জস্য, Hilt kapt/ksp, version catalog |
| AI-সহ কাজ | এক ভাষায় UI+logic, কম সেরিমনি | AI-এর Gradle ভার্সন-কম্বিনেশন প্রায়ই পুরনো হয়ে যায় |

যেহেতু কোড এজেন্ট লিখবে আর মালিক **অ্যাপ চালিয়ে দেখেই** যাচাই করবেন, প্রতিটি
ইটারেশনের খরচই আসল মাপকাঠি। Flutter সেখানে জেতে।

### যা হারাতে হয় — সৎভাবে (আর কিভাবে সামলাবেন)

| খরচ | টার্গেট (গাইড §২২.১) | Flutter-এ পরিণতি | প্রশমন |
|---|---|---|---|
| APK আকার | < ২৫ MB | release ~১২–১৮ MB; Kotlin-এ ~৬–৮ MB | **App Bundle** (ABI স্প্লিট), `--split-debug-info --obfuscate`, `--tree-shake-icons` → টার্গেট **১২–১৫ MB** |
| Cold start | mid-range-এ < ২ সে | FlutterEngine বুটে ২–৩ সে যেতে পারে | Android 12 **Splash Screen API**, ভারী init defer (Crashlytics/FCM), প্রথম ফ্রেমে **ক্যাশড ডেটা** → টার্গেট **< ২.৫ সে** |
| Baseline Profile / Macrobenchmark | সরাসরি আছে | সমতুল্য নেই | DevTools **frame timing** + `integration_test` (§৮ দেখুন) |
| স্ক্রিনশট/রেকর্ডিং ব্লক | `FLAG_SECURE` সরাসরি | plugin লাগে | `flutter_windowmanager` / `no_screenshot` — **লাইভ পরীক্ষায় জরুরি** |

---

## ২. টেক স্ট্যাক (NATIVE-ANDROID-GUIDE.md §৪-এর Flutter ম্যাপিং)

| স্তর | Kotlin (মূল গাইড) | **Flutter (এই অ্যাপ)** | নোট |
|---|---|---|---|
| ভাষা / UI | Kotlin + Compose | **Dart + Material 3** |ธีม: ওয়েবের রঙ/টাইপোগ্রাফি অনুসরণ |
| আর্কিটেকচার | MVVM + Repository | একই ধারণা, Riverpod দিয়ে | `UiState` sealed class → Dart sealed class |
| DI | Hilt | **Riverpod** (প্রোভাইডারই DI) | আলাদা DI প্যাকেজ লাগে না |
| নেটওয়ার্ক | Retrofit + OkHttp | **Dio** + interceptor | Bearer টোকেন interceptor-এ |
| JSON | kotlinx.serialization | **json_serializable** (কোডজেন) | হাতে `fromJson` লিখবেন না |
| Auth | Supabase Kotlin SDK | **supabase_flutter** + **google_sign_in** | §৫ দেখুন |
| টোকেন স্টোর | EncryptedSharedPreferences | **flutter_secure_storage** | accessToken এখানেই, কখনো SharedPreferences-এ নয় |
| লোকাল DB (লিস্ট) | Room | **Drift** | ⚠️ §৯ — পরীক্ষার প্রশ্ন ক্যাশ নিষিদ্ধ |
| প্রেফারেন্স | DataStore | **shared_preferences** | থিম/ভাষা/সর্বশেষ টপিক |
| নেভিগেশন | NavHost | **go_router** | deep link-এর জন্যও (§৭) |
| ভিডিও | Media3 / ExoPlayer | **youtube_player_iframe** বা `webview_flutter` | কোর্স ভিডিও **YouTube** (§৯-এর নোট) |
| পুশ | FCM | **firebase_messaging** | init defer |
| ব্যাকগ্রাউন্ড | WorkManager | **workmanager** | ভুল-নোটবুক সিঙ্ক রিট্রাই |
| ছবি | Coil | **cached_network_image** | Google avatar |
| ক্র্যাশ/অ্যানালিটিক্স | Crashlytics | **firebase_crashlytics** | init defer |
| বাংলা ফন্ট | Hind Siliguri (asset) | **Hind Siliguri** (`assets/fonts/` + pubspec) | LTR, RTL দরকার নেই |
| অ্যানিমেশন | Compose animation | implicit animations + `Ticker` | §৮-এর টাইমার-নিয়ম |
| Min/Target SDK | 24 / 34+ | একই | Android 12+ Splash API-র জন্য important |

---

## ৩. প্রজেক্ট স্ট্রাকচার

```
D:\App\bcs-one-flutter\
├── lib/
│   ├── main.dart
│   ├── app.dart                    (MaterialApp.router, theme, locale)
│   ├── core/
│   │   ├── config/                 (baseUrl, env)
│   │   ├── network/
│   │   │   ├── dio_client.dart     (Dio + Bearer interceptor + retry)
│   │   │   └── api_exception.dart  (কোড-ভিত্তিক এরর → টাইপড এক্সেপশন)
│   │   ├── auth/
│   │   │   ├── google_sign_in_service.dart
│   │   │   ├── token_store.dart    (flutter_secure_storage)
│   │   │   └── auth_repository.dart
│   │   ├── time/
│   │   │   └── server_clock.dart   (⭐ §৬ — ডিভাইস-ঘড়ি কখনো নয়)
│   │   └── theme/                  (রঙ, টাইপোগ্রাফি, Hind Siliguri)
│   ├── data/
│   │   ├── models/                 (json_serializable DTO)
│   │   ├── local/                  (Drift: শুধু নিরাপদ কনটেন্ট)
│   │   └── repositories/
│   ├── features/
│   │   ├── auth/                   (লগইন স্ক্রিন)
│   │   ├── dashboard/              (হোম — /api/home)
│   │   ├── course/                 (তালিকা, বিস্তারিত, ভিডিও)
│   │   ├── exam/                   (⭐ কাউন্টডাউন, প্রশ্ন, সাবমিট, রেজাল্ট)
│   │   ├── leaderboard/
│   │   ├── practice/
│   │   ├── question_bank/
│   │   ├── notebook/               (ভুল + বুকমার্ক)
│   │   ├── news/
│   │   └── profile/
│   └── shared/                     (উইজেট, লোডিং/খালি/এরর স্টেট)
├── assets/fonts/                   (Hind Siliguri)
├── android/                        (applicationId — Play Console-এ আগেই রিজার্ভ করুন)
├── integration_test/
└── pubspec.yaml
```

> **গুরুত্বপূর্ণ:** `applicationId` একবার ঠিক হলে বদলানো কঠিন, আর ভুল করলে Play-এ
> নতুন লিস্টিং বাধ্যতামূলক (পুরনো ইউজার হারাবেন)। প্রথম দিনেই রিজার্ভ করুন।

---

## ৪. API কন্ট্রাক্ট v1 — বাস্তবায়নের অবস্থা

সব রাউট `D:\App\bcs-one-nextjs\src\app\api\**`-এ, বিদ্যমান ১০৪টি Server Action-এর
উপরে **পাতলা wrapper** হিসেবে (কোনো ব্যবসায়িক লজিক ডুপ্লিকেট হয়নি)।

| # | Endpoint | অবস্থা |
|---|---|---|
| 1 | `POST /api/auth/session` | ✅ |
| 2 | `GET /api/student/me` | ✅ |
| 3 | `POST /api/student/sync-login` | ✅ |
| 4 | `GET /api/courses` | ✅ |
| 5 | `GET /api/courses/{courseName}` | ✅ |
| 6 | `GET /api/courses/{courseName}/videos` | ✅ |
| 7 | `POST /api/courses/{courseName}/enroll` | ✅ |
| 8 | `GET /api/home` | ✅ (auth-aware) |
| 9 | `GET /api/exams/live` | ✅ |
| 10 | `GET /api/exams/{id}` | ✅ |
| 11 | `GET /api/exams/{id}/questions` | ✅ ⭐ |
| 12 | `POST /api/exams/{id}/submit` | ✅ |
| 13 | `GET /api/exams/{id}/result` | ✅ |
| 14 | `GET /api/exams/{id}/leaderboard` | ✅ |
| 15 | `POST /api/practice/session` | ✅ |
| 16 | `GET /api/practice/questions` | ✅ |
| 17 | `POST /api/practice/submit` | ❌ **ইচ্ছাকৃতভাবে বাদ** (§৪.১) |
| 18 | `GET /api/topics` | ✅ |
| 19 | `GET /api/question-bank` | ✅ |
| 20 | `GET /api/news` | ✅ |
| 21 | `POST /api/news/{id}/read` | ✅ |
| 22 | `GET /api/mistakes` | ✅ |
| 23 | `PUT /api/mistakes` | ✅ |
| 24 | `GET` · `PUT /api/bookmarks` | ✅ |
| 25 | `GET /api/time` | ✅ |
| 26 | `POST /api/exams/{id}/heartbeat` | ✅ |

**মোট: ২৫/২৬ ✅**

### ৪.১ যেখানে চুক্তি থেকে সরে এসেছি (তিনটি — সব ইচ্ছাকৃত)

**১. #17 `POST /api/practice/submit` বাদ।**
ওয়েব অ্যাপ **কখনো** প্র্যাকটিস-স্কোর সংরক্ষণ করে না — `practice-actions.ts`-এ শুধু
`getPracticeTopics` ও `getPracticeQuestions` আছে, কোনো save/session ফাংশন নেই, আর
DB-তে প্র্যাকটিস-ফলাফলের টেবিলও নেই। তিনটি কারণ মিলিয়ে endpoint-টা অর্থহীন:
- সংরক্ষণ করার জায়গা নেই (টেবিল বানানো scope-বহির্ভূত)
- প্র্যাকটিসের উত্তর (`correct`/`exp`) ক্লায়েন্ট **আগেই** পায়, তাই সার্ভার-গ্রেডিং
  নতুন কিছু দেয় না — লিডারবোর্ড/পুরস্কার নেই, প্রতারণার প্রণোদনাও নেই
- প্র্যাকটিসের **ভুল উত্তর** তবু সংরক্ষিত হয় — `PUT /api/mistakes` দিয়ে

> **সিদ্ধান্ত আপনার:** প্র্যাকটিস-ইতিহাস ক্রস-ডিভাইসে দেখাতে চাইলে একটা টেবিল
> (`practice_attempts`) + মাইগ্রেশন লাগবে। বললে যোগ করে দেব।

**২. #9 `GET /api/exams/live` ও #10 `GET /api/exams/{id}`-এ auth বাধ্যতামূলক নয় (`optional`)।**
মূল গাইডে ✅ চিহ্ন ছিল। কারণ: ওয়েব ল্যান্ডিং পেজ অতিথিকেও পরীক্ষার তালিকা দেখায়,
আর অ্যাপে লগইনের আগে কী আছে না দেখালে নতুন শিক্ষার্থী নিবন্ধনই করবে না।
ঝুঁকি শূন্য — এই দুই রেসপন্সে কোনো প্রশ্ন/উত্তর/ফলাফল নেই, শুধু শিরোনাম ও সময়।
লগইন থাকলে `isEnrolled`/`canAttempt` ভরে যায়।

**৩. #8 `GET /api/home`-ও `optional`** — একই যুক্তি (funnel), তবে লগইন থাকলে
প্রোফাইল, এনরোলমেন্ট, `isCompleted`, `stats` সব ব্যক্তিগত হয়ে যায়।

### ৪.২ Bearer + Cookie — একটাই কোডবেস, দুই ক্লায়েন্ট

সব সার্ভার অ্যাকশন (`getSessionUserFromCookies` → `sessionOwnsStudent` → …) আগে
শুধু `sb_access_token` **কুকি** পড়ত — অ্যাপ কুকি পাঠায় না। ১০৪টি অ্যাকশনে token
থ্রেড করার বদলে `src/lib/request-context.ts`-এ একটা **AsyncLocalStorage** রাখা হয়েছে:
API রাউট টোকেন যাচাই করে সেখানে রাখে, আর `teacher-auth.ts`-এর টোকেন-রিডার আগে
সেটাই দেখে — না পেলে আগের মতো কুকিতে যায়।

**ফলাফল:** ওয়েব অ্যাপে শূন্য পরিবর্তন, আর অ্যাপ থেকেও প্রতিটি অ্যাকশন কাজ করে।
বোনাস: অ্যাপে কুকি-ফলব্যাক পথটা **কখনো চালু হয় না**, তাই পরিচয় সবসময় প্রমাণিত
সেশন থেকে আসে — অ্যাপের পথ ওয়েবের চেয়ে **বেশি কঠোর**।

---

## ৫. Auth ফ্লো (অ্যাপ)

```
Google Sign-In (android)  →  Google ID token
        ↓
supabase.auth.signInWithIdToken(provider: google, idToken: …)
        ↓
Supabase session (accessToken, refreshToken)
        ↓  flutter_secure_storage-এ রাখা
প্রতিটি API কলে:  Authorization: Bearer <accessToken>
        ↓
Next.js রাউট: getUserFromToken() → AuthUser → request-context → অ্যাকশন
```

### দুটো পথ — একটা বেছে নিন

**A. `signInWithIdToken` (দ্রুত, ব্রাউজার খোলে না) — প্রস্তাবিত**
- Google Cloud Console → OAuth client (Android) বানাতে হবে
- **debug ও release keystore — দুটোরই SHA-1** যোগ করতে হবে
  (`keytool -list -v -keystore …`)। ভুলে গেলে `ApiException: 10` — সবচেয়ে কমন ফাঁদ
- `google_sign_in`-এর নতুন সংস্করণে API বদলেছে (`initialize()` লাগে) — ভার্সন পিন করুন

**B. `signInWithOAuth` + deep link** (`bcsonepro://login-callback`)
- Google config কম লাগে, কিন্তু ইউজারকে ব্রাউজারে নেয়
- AndroidManifest-এ intent-filter + Play App Signing-এর SHA-256 দিয়ে `assetlinks.json`

### লগইনের পর অবশ্যই একটা কল

`POST /api/auth/session` — এটা শুধু যাচাই নয়, **auto-register**-ও করে
(`syncStudentLogin`)। ওয়েব অ্যাপ Supabase-এর auth state change-এ ঠিক এটাই করে।
**না করলে অ্যাপ দিয়ে লগইন করা শিক্ষার্থীরা শিক্ষক প্যানেলে অদৃশ্য থেকে যাবে** —
তালিকায় উঠবে না, কোর্সে এনরোল করানোও যাবে না।

### টোকেন রিফ্রেশ

Access token ~১ ঘণ্টায় মেয়াদোত্তীর্ণ। Dio interceptor-এ:
- `401` + `error.code == "TOKEN_INVALID"` → `supabase.auth.refreshSession()` → **একবার** রিট্রাই
- `401` + `error.code == "UNAUTHENTICATED"` → লগইন স্ক্রিন (রিফ্রেশ করে লাভ নেই)

দুটো কোড আলাদা রাখা হয়েছে ঠিক এই কারণেই — এক করে দিলে অ্যাপ প্রতিবার নতুন করে
লগইন করাবে, নিজের কাস্টমারকেই বিরক্ত করা।

---

## ৬. ⭐ server_clock.dart — সবচেয়ে বেশি ভুল যেখানে হয়

**ডিভাইস-ঘড়ি কখনো বিশ্বাস করবেন না।** শিক্ষার্থী ফোনের সময় এগিয়ে/পিছিয়ে দিলেই
ওয়েব অ্যাপে লাইভ পরীক্ষার উইন্ডো ভেঙে যায় — এজন্যই সার্ভার-পাশে
`bangladesh-time.ts` আছে, আর সব রেসপন্সে `serverTimeMs` যায়।

```dart
class ServerClock {
  Duration _offset = Duration.zero;   // server - device
  bool _synced = false;

  Future<void> sync(Dio dio) async {
    final t0 = DateTime.now();
    final res = await dio.get('/api/time', options: Options(extra: {'noAuth': true}));
    final t1 = DateTime.now();
    final rtt = t1.difference(t0);
    final serverMs = (res.data['serverTimeMs'] as num).toInt();
    // নেটওয়ার্ক-বিলম্বের অর্ধেক ধরে সংশোধন (ওয়েবের syncBangladeshNetworkTime-এর মতোই)
    final adjusted = serverMs + rtt.inMilliseconds ~/ 2;
    _offset = DateTime.fromMillisecondsSinceEpoch(adjusted).difference(t1);
    _synced = true;
  }

  DateTime now() => DateTime.now().add(_offset);
  Duration get offset => _offset;
  bool get isSynced => _synced;
}
```

**নিয়ম:**
- অ্যাপ স্টার্টে একবার `sync()`; লাইভ পরীক্ষার স্ক্রিনে ঢোকার সময় আবার
- `/api/exams/{id}/questions`-এর `serverTimeMs` ও `endTimeMs` দিয়ে কাউন্টডাউন
  **সার্ভারের সময়ে** হিসাব করুন, `DateTime.now()`-এ নয়
- `_offset` শূন্য/অসিঙ্ক হলে অ্যাপ **ব্লক করবে না**, কিন্তু "সময় যাচাই করা যায়নি"
  দেখাবে ও কাউন্টডাউন প্রতি ৩০ সেকেন্ডে `/api/exams/{id}/heartbeat` দিয়ে ঠিক করবে

---

## ৭. স্ক্রিন-ম্যাপ ও নেভিগেশন (go_router)

```
/splash            → ServerClock.sync() + token restore
/login             → Google Sign-In  →  POST /api/auth/session
/                  → Dashboard (GET /api/home)
   ├── /courses                     (GET /api/courses)
   │      └── /courses/:name        (GET /api/courses/{name})
   │             └── /courses/:name/videos   (GET …/videos)
   ├── /exams/:id                   (GET /api/exams/{id})
   │      ├── /exams/:id/hall       (GET …/questions → সাবমিট)
   │      ├── /exams/:id/result     (GET …/result)
   │      └── /exams/:id/leaderboard
   ├── /practice                    (GET /api/topics)
   │      └── /practice/run         (POST /api/practice/session)
   ├── /question-bank               (GET /api/question-bank, পেজিনেটেড)
   ├── /notebook                    (GET /api/mistakes + /api/bookmarks)
   ├── /news                        (GET /api/news)
   └── /profile                     (GET /api/student/me)
```

Deep link: `/exams/:id` — FCM নোটিফিকেশন থেকে সরাসরি পরীক্ষায়। শিক্ষক যখন
"লাইভ শুরু" পুশ পাঠাবেন, শিক্ষার্থী এক ট্যাপে পরীক্ষার হলের দরজায়।

---

## ৮. ⭐ লাইভ পরীক্ষা ইঞ্জিন

এই অ্যাপের সবচেয়ে সূক্ষ্ম অংশ। প্রতিটি নিয়মের পেছনে একটা নির্দিষ্ট ব্যর্থতা আছে।

### ৮.১ উইন্ডো ও সময় (সবই সার্ভার থেকে)

| ফিল্ড | মানে |
|---|---|
| `startTimeMs` | উইন্ডো শুরু (null = সর্বদা-খোলা) |
| `endTimeMs` | উইন্ডো শেষ |
| `answersReleaseAtMs` | উত্তর-কী খোলার সময় |
| `graceMs` | ১০০০০ (নেট-ল্যাটেন্সির ঢিল) |
| `startedAtMs` | সার্ভার-নিবন্ধিত শুরু — **এলাপসড-টাইমার এটাকেই অ্যাংকর করবে** |

- `remaining = endTimeMs + graceMs − serverClock.now()`
- `remaining <= 0` → **অটো-সাবমিট** (ইউজারের "জমা দিন" চাপার অপেক্ষা নয়)
- ⚠️ `answersReleaseAtMs` = **`endTimeMs` + পুরো পরীক্ষার দৈর্ঘ্য**, শুধু ১০ সেকেন্ড নয়।
  README-তে "endTime + ১০ সেকেন্ড" লেখা — সেটা ভ্রামক; `LIVE_GRACE_MS` শুধু
  সাবমিশনকে "লাইভ" গণ্য করার সীমা। কোড বেশি কঠোর, তাই সমস্যা নেই।

### ৮.২ এরর কোড ধরে স্ক্রিন বাছুন (HTTP স্ট্যাটাস ধরে নয়)

| `error.code` | HTTP | অ্যাপের করণীয় |
|---|---|---|
| `UNAUTHENTICATED` | 401 | লগইন স্ক্রিন |
| `TOKEN_INVALID` | 401 | টোকেন রিফ্রেশ → একবার রিট্রাই |
| `NOT_ENROLLED` | 403 | "কোর্স কিনুন" স্ক্রিন |
| `ALREADY_SUBMITTED` | 409 | **রিট্রাই করবেন না** — সরাসরি রেজাল্টে যান |
| `EXAM_NOT_STARTED` | 425 | কাউন্টডাউন দেখান |
| `EXAM_CLOSED` | 410 | "সময় শেষ" স্ক্রিন |
| `NO_QUESTIONS` | 404 | "প্রশ্ন যোগ করা হয়নি" |
| `NOT_FOUND` | 404 | তালিকায় ফিরুন |
| `INTERNAL` | 500 | "আবার চেষ্টা করুন" + রিট্রাই বোতাম |

### ৮.৩ সাবমিট

```json
POST /api/exams/{id}/submit
{ "answers": [2, null, 0, 1], "totalQuestions": 4, "timeRemaining": 0 }
```
- `answers[i]` = `order == i` প্রশ্নের নির্বাচিত অপশন; না দিলে `null`
- রেসপন্সে লাইভ পরীক্ষায় `score: null` — **এটা বাগ নয়, নিরাপত্তা**। উত্তর-কী
  প্রকাশের আগে স্কোর জানালে শিক্ষার্থী এক-এক অপশন বদলে মেপে নিতে পারত কোনটা সঠিক
  (bit-by-bit oracle)। ফলাফল `/result`-এ।
- `409 ALREADY_SUBMITTED` = দুই ট্যাব/দুই ডিভাইসে জমা — ডেটাবেস-লেভেল unique
  index এটাই নিশ্চিত করে। অ্যাপে সফল ধরে রেজাল্ট স্ক্রিনে যান।

### ৮.৪ অ্যাপ পটভূমিতে গেলে

1. `AppLifecycleState.paused` → টাইমার থামান, `answers` মেমরিতে রাখুন
2. `resumed` → `POST /api/exams/{id}/heartbeat` → নতুন `startedAtMs` ও `remainingSeconds`
3. হৃদস্পন্দনের `remainingSeconds` দিয়ে কাউন্টডাউন **রিসেট** করুন (চালু রাখবেন না)
4. নেট না থাকলে লোকালি হিসাব চালিয়ে যান, কিন্তু **সাবমিট না হওয়া পর্যন্ত UI-তে
   "সংযোগ নেই" ব্যানার** দেখান

### ৮.৫ টাইমারের পারফরম্যান্স (jank-এর আসল উৎস)

প্রতি সেকেন্ডে পুরো উইজেট `setState` করলে বাংলা টেক্সট **রিলেআউট** হয় → দৃশ্যমান ঝাঁকুনি।

```dart
// ❌ ভুল: পুরো স্ক্রিন রিবিল্ড
setState(() => _remaining = ...);

// ✅ ঠিক: শুধু টেক্সট-উইজেট রিবিল্ড
final _remaining = ValueNotifier<Duration>(Duration.zero);

ValueListenableBuilder<Duration>(
  valueListenable: _remaining,
  builder: (_, d, __) => RepaintBoundary(
    child: Text(formatBn(d), style: …),
  ),
)
```
- ঘড়ি চালান **একটি** `Ticker`/`Timer.periodic` দিয়ে (স্ক্রিনপ্রতি আলাদা নয়)
- `RepaintBoundary` না দিলে প্রতি সেকেন্ডে পুরো লিস্ট রিপেইন্ট হয়

---

## ৯. নিরাপত্তা চেকলিস্ট (NATIVE-ANDROID-GUIDE.md §১৯ + Flutter-নির্দিষ্ট)

**সার্ভার-চুক্তি (অপরিবর্তিত):**
- [ ] কোনো answer-key প্রশ্ন-রেসপন্সে যায় না (`/questions`-এর `select`-এই `correct`/`exp` নেই)
- [ ] স্কোরিং ১০০% সার্ভারে; অ্যাপ কোথাও স্কোর গণনা করে না
- [ ] `endTime + পরীক্ষার দৈর্ঘ্য`-এর আগে `/result`-এ `solutions: null`
- [ ] এক শিক্ষার্থী = এক লাইভ সাবমিশন (DB unique index)

**Flutter-নির্দিষ্ট:**
- [ ] পরীক্ষার প্রশ্ন **কখনো** Drift/SharedPreferences-এ ক্যাশ নয় — শুধু মেমরিতে
      (অ্যাপ আনইনস্টল না করেই ফাইল সিস্টেম থেকে পড়ে উত্তর বের করা যেত)
- [ ] `accessToken` কেবল `flutter_secure_storage`-এ
- [ ] **লাইভ পরীক্ষার হলের স্ক্রিনে `FLAG_SECURE`** — স্ক্রিনশট/স্ক্রিন-রেকর্ডিং বন্ধ
      (`no_screenshot` বা প্ল্যাটফর্ম চ্যানেল)। বাংলা শিক্ষার্থী বন্ধুর ফোনে স্ক্রিন
      দেখিয়ে দিতে পারে — এটা টেকনিক্যাল নয়, সামাজিক ঝুঁকি, কিন্তু সমাধান টেকনিক্যাল
- [ ] Release build-এ `debuggable false`, obfuscation চালু
- [ ] Dio-র `LogInterceptor` release-এ **বন্ধ** (টোকেন লগে পড়ে যায়)
- [ ] `/api/mistakes`-এ ক্লায়েন্ট student id পাঠাবেন না — সার্ভার নিজেই সেশন থেকে
      বসায় (ক্লায়েন্ট পাঠালে উপেক্ষিত হয়, তবু পাঠাবেন না)
- [ ] ভিডিও লিংক (`youtubeId`) ক্যাশ করবেন না — পেইড কনটেন্ট

---

## ১০. পারফরম্যান্স গেট (গাইড §২২.৬-এর Flutter সংস্করণ)

Kotlin-এ Baseline Profile + Macrobenchmark; Flutter-এ সমতুল্য নেই, তাই:

| গেট | হাতিয়ার | টার্গেট |
|---|---|---|
| Cold start | `flutter run --profile` + DevTools Timeline | mid-range-এ **< ২.৫ সে** |
| স্ক্রল (৬০/১২০ fps) | DevTools → Performance, "Raster"/"UI" থ্রেড | ফ্রেম **< ১৬ ms** (৬০Hz) |
| Jank-ফ্রেম | `flutter drive --profile` + `integration_test` | প্রতি স্ক্রিনে **< ১%** |
| APK আকার | `flutter build appbundle --analyze-size` | **< ১৫ MB** (ডাউনলোড) |
| মেমরি (লিস্ট স্ক্রিন) | DevTools Memory | প্রশ্নব্যাংক ১০০০ প্রশ্নে **< ২৫০ MB** |

**প্রতি ফেজের DoD-তে এই গেটগুলো থাকবে** — শেষে ঠিক করা যায় না (গাইড §২২-এর মূল কথা)।

লিস্ট-স্ক্রিনের নিয়ম (গাইড §২২.২):
- `ListView.builder` (কখনো `Column` + scroll নয়)
- `const` constructor যেখানে সম্ভব
- `itemExtent`/`prototypeItem` দিলে স্ক্রল আরও মসৃণ
- ছবিতে `cacheWidth`/`cacheHeight` (ডাউনস্যাম্পলিং)

---

## ১১. ফেজ-প্ল্যান ও বর্তমান অবস্থা

| ফেজ | কাজ | অবস্থা |
|---|---|---|
| ০ | প্রস্তুতি, বেসলাইন (tsc + build + স্মোক টেস্ট) | ✅ **সম্পন্ন** |
| **১** | **Server Actions → REST API (২৫/২৬)** | ✅ **সম্পন্ন** |
| ২ | Flutter foundation (Dio, secure storage, Riverpod, go_router, ServerClock) | ⏳ পরবর্তী |
| ৩ | ড্যাশবোর্ড + কোর্স/ভিডিও | ⏳ |
| ৪ | প্র্যাকটিস + প্রশ্নব্যাংক | ⏳ |
| ৫ | **লাইভ পরীক্ষা ইঞ্জিন** | ⏳ |
| ৬ | রেজাল্ট + লিডারবোর্ড + নোটবুক | ⏳ |
| ৭ | নিউজ + নোটিফিকেশন + ডিপলিংক | ⏳ |
| ৮ | QA (পারফরম্যান্স গেটসহ) + বেটা | ⏳ |
| ৯ | Play Store লঞ্চ | ⏳ |

### ফেজ ১-এর যাচাই-প্রমাণ

- `npx tsc --noEmit --incremental false` → **exit 0**
- **ওয়েব রিগ্রেশন নেই** — `/`, `/portal`, `/practice`, `/question-bank`, `/leaderboard/:id` সব `200`
- আসল Supabase ডেটায় স্মোক টেস্ট: কোর্স (২টি, দাম ২৪০০/৪৯৯), লিডারবোর্ড (১৬ জন,
  ফোন মাস্কড `••••••83`), পরীক্ষার সময়-হিসাব (`answersReleaseAtMs = endTimeMs + 1800000`)
- সব `student`-রাউট টোকেন ছাড়া → `401`; অজানা পরীক্ষা → `404 NOT_FOUND`; ভুয়া টোকেন → `401 TOKEN_INVALID`

---

## ১২. এখনই করার কাজ

1. **Play Console অ্যাকাউন্ট খুলুন + closed testing ট্র্যাক চালু করুন।** নতুন
   *personal* ডেভেলপার অ্যাকাউন্টে production-এ যাওয়ার আগে **১২ জন টেস্টার নিয়ে
   ১৪ দিন টানা closed testing** বাধ্যতামূলক। এটা অপেক্ষার নিয়ম, পরিশ্রমের নয় —
   আজ চালু করলে লঞ্চ ২–৪ সপ্তাহ আগে হবে।
2. **`applicationId` রিজার্ভ করুন** (যেমন `com.aarohon.bcsonepro`) — পরে বদলানো কঠিন।
3. **Google Cloud Console-এ Android OAuth client** বানিয়ে debug ও release keystore
   দুটোর SHA-1 যোগ করুন (§৫)।
4. Flutter skeleton + `ServerClock` + Dio interceptor দিয়ে প্রথম স্ক্রিন —
   §৩-এর স্ট্রাকচার অনুযায়ী।

---

## ১৩. সাধারণ ভুল (Flutter-নির্দিষ্ট)

| ভুল | পরিণতি | সমাধান |
|---|---|---|
| Release keystore-এর SHA-1 ভুলে যাওয়া | লগইনে `ApiException: 10` | দুটো SHA-1 যোগ করুন |
| `DateTime.now()` দিয়ে কাউন্টডাউন | শিক্ষার্থী ঘড়ি বদলে সময় বাড়ায় | `ServerClock.now()` |
| লাইভ পরীক্ষার প্রশ্ন ক্যাশ করা | অফলাইনে উত্তর বের করা যায় | শুধু মেমরি |
| প্রতি সেকেন্ডে `setState` | টাইমারে ঝাঁকুনি | §৮.৫ |
| `SELECT *`-এর মতো পুরো প্রশ্নব্যাংক আনা | কম দামের ফোনে ক্র্যাশ | `/question-bank` পেজিনেশন |
| টোকেন refresh-এ `UNAUTHENTICATED`-ও রিট্রাই | অসীম লুপ | §৫-এর কোড-ভেদ |
| YouTube ভিডিও `video_player` দিয়ে চালানো | কালো স্ক্রিন | `youtube_player_iframe`/`webview_flutter` |
| শিক্ষক অ্যাকাউন্ট দিয়ে স্টুডেন্ট অ্যাপে লগইন | `403 FORBIDDEN` | শিক্ষক প্যানেল ওয়েবে |

---

## ১৪. সম্পর্কিত ফাইল (রেফারেন্স)

**ওয়েব প্রজেক্টে নতুন (ফেজ ১):**
```
src/lib/request-context.ts          ⭐ Bearer টোকেন → অ্যাকশনের কাছে
src/lib/api-auth.ts                 ⭐ যাচাই, রেসপন্স/এরর ফরম্যাট, রাউট র্যাপার
src/lib/exam-api.ts                 ⭐ পরীক্ষার উইন্ডো/অ্যাক্সেস/প্রশ্ন (zero-leak)
src/lib/teacher-auth.ts             (পরিবর্তিত) টোকেন-রিডার Bearer-aware
src/app/api/auth/session/route.ts
src/app/api/student/me/route.ts
src/app/api/student/sync-login/route.ts
src/app/api/home/route.ts           (উন্নত — auth-aware)
src/app/api/courses/…               (৪টি)
src/app/api/exams/…                 (৭টি — heartbeat সহ)
src/app/api/practice/…              (২টি)
src/app/api/topics/route.ts
src/app/api/question-bank/route.ts
src/app/api/news/…                  (২টি)
src/app/api/mistakes/route.ts
src/app/api/bookmarks/route.ts
src/app/api/time/route.ts           (আগে থেকেই ছিল)
```

**মূল ডকুমেন্ট:** `NATIVE-ANDROID-GUIDE.md` (আর্কিটেকচার, §৬ চুক্তি, §১৯ নিরাপত্তা, §২২ পারফরম্যান্স)
