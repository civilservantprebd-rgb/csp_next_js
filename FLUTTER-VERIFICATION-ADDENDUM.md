# Flutter অ্যাপ — ফেজ ২ অ্যাডেন্ডাম: যাচাই, ডায়াগনস্টিক ও শেখা

> এটি `FLUTTER-ANDROID-GUIDE.md`-এর সম্পূরক — ফেজ ২ (Flutter foundation) করার সময়
> যে বিষয়গুলো **হাতে-কলমে ধরা পড়েছে**। গাইডে যা লেখা ছিল তার সাথে বাস্তবের
> পার্থক্য, আর যে ভুলগুলো একবার করে হলেই সময় নষ্ট হয়।

---

## ১. ডেভ-পরিবেশ: সবকিছু D:\ ড্রাইভে

C:\ ড্রাইভে জায়গা কম থাকায় (একবার মাত্র ৩.৭ GB খালি ছিল, আর Android NDK ~৫ GB চায়)
সব টুলিং D:\-এ সরানো হয়েছে:

| কী | কোথায় | কেন |
|---|---|---|
| Flutter SDK | `D:\flutter` | 3.1 GB |
| Android SDK | `D:\Android\sdk` | ~2.3 GB; NDK/CMake এখানেই নামে |
| Gradle cache | `D:\gradle-home` | ~5.8 GB — সবচেয়ে বড় |
| Dart packages | `D:\pub-cache` | ~0.9 GB |
| Android AVD | `D:\android-avd` | এমুলেটরের ডিস্ক-ইমেজ কয়েক GB |
| JDK | `D:\flutter_env\jdk-17.0.2` | Flutter নিজেই এটা খুঁজে পায় |

ইউজার-লেভেল environment variable সেট করা আছে, তাই নতুন টার্মিনালে নিজে থেকেই কাজ করে:

```powershell
ANDROID_SDK_ROOT = D:\Android\sdk
GRADLE_USER_HOME  = D:\gradle-home
PUB_CACHE         = D:\pub-cache
JAVA_HOME         = D:\flutter_env\jdk-17.0.2
```

⚠️ **ক্যাশ সরানোর পরে অবশ্যই `flutter pub get` চালাতে হবে** — নাহলে
`.dart_tool/package_config.json`-এ পুরোনো পাথ থেকে যায়, আর এর লক্ষণটা বিভ্রান্তিকর:
Flutter **নিজের ফ্রেমওয়ার্কের** ফাইল নিয়ে এরর দেয় (`Matrix4` খুঁজে পাচ্ছে না,
`MapEquality` নেই) — দেখে মনে হয় Flutter SDK নষ্ট, অথচ সমস্যা পাথ।

### NDK বন্ধ রাখা হয়েছে

`android/app/build.gradle.kts`-এ `ndkVersion = flutter.ndkVersion` কমেন্ট করা আছে।
Flutter-এর টেমপ্লেট ডিফল্টে এটা থাকে, ফলে গ্রেডল **সবসময় ~৫ GB-র NDK** ইনস্টল
করতে যায়। এই অ্যাপের কোনো নির্ভরতায় (dio / flutter_riverpod / flutter_secure_storage)
নেটিভ C/C++ কোড নেই — তাই দরকারও নেই। NDK-নির্ভর প্লাগইন (ffi/ক্রিপ্টো) যোগ করলে
লাইনটা আবার খুলতে হবে।

---

## ২. ⭐ টেস্ট-কৌশল — চার স্তর

ফ্লাটার-অ্যাপে "সব ঠিক আছে" মনে হওয়া খুব সহজ, অথচ কোথাও একটা ভাঙা থাকে।
তাই চার স্তরে যাচাই করা হয়, আর প্রতিটি স্তর **আলাদা ফাইলে** — কারণ প্রতিটির
শর্ত আলাদা:

| ফাইল | কী যাচাই করে | নেটওয়ার্ক |
|---|---|---|
| `test/bn_test.dart` | বাংলা ফরম্যাটিং (ডিজিট, কাউন্টডাউন, তারিখ) | লাগে না |
| `test/models_test.dart` | API পেলোড → মডেল পার্সিং | লাগে না |
| `test/error_path_test.dart` | ত্রুটি-দৃশ্য: কারণ, করণীয়, ঠিকানা | লাগে না |
| `test/diag_network_test.dart` | সংযোগ-স্তর (HttpClient বনাম Dio) | **আসল** |
| `test/diag_error_path_test.dart` | ব্যর্থতা কত দ্রুত ও কী কোডে ধরা পড়ে | **আসল** |
| `test/live_api_dart_test.dart` | পুরো ডেটা-লেয়ার → আসল সার্ভার → Supabase | **আসল** |
| `test/live_api_test.dart` | UI সত্যিই আসল ডেটা রেন্ডার করে কি না | **আসল** |

চালানো:
```powershell
flutter test --dart-define=BCS_TEST_API=http://192.168.0.107:3100
```
সার্ভার চালু না থাকলে লাইভ টেস্টগুলো **skip** হয় (লাল নয়) — নাহলে অফলাইনে
সব টেস্ট লাল দেখিয়ে আসল বাগ চাপা পড়ে যেত।

### ⚠️ তিনটি ফাঁদ যা সময় নষ্ট করেছিল

**১. `flutter_test` ডিফল্টে সব HTTP ব্লক করে।** নকল `HttpClient` সব কলে ৪০০ ফেরায়।
তাই হয় টেস্ট মিথ্যা পাস করে (কিছুই যাচাই না করে), নয় মিথ্যা ব্যর্থ হয়।
সমাধান — `main()`-এ **এবং** প্রতি টেস্টের `setUp`-এ:

```dart
HttpOverrides.global = null;
setUp(() => HttpOverrides.global = null);   // ← এটাই আসল কাজ করে
```
`main()`-এর লাইনটা যথেষ্ট নয়, কারণ override টেস্ট-জোনে আবার বসে।

**২. ভুল `--dart-define` নাম।** `ApiClient` ঠিকানা পড়ে `BCS_API_BASE_URL` থেকে,
কিন্তু টেস্টে `BCS_TEST_API` পাঠানো হচ্ছিল — তাই অ্যাপ ডিফল্ট (এমুলেটরের `10.0.2.2`)
ব্যবহার করে connect-timeout খাচ্ছিল, আর মনে হচ্ছিল "Dio কাজ করে না"।
**সমাধান:** `ApiClient`-এ `baseUrl` ইনজেক্টযোগ্য — টেস্ট স্পষ্টভাবে ঠিকানা দেয়।
টাইমআউটও ইনজেক্টযোগ্য, তাই ব্যর্থতার পথ ২৫ সেকেন্ড অপেক্ষা না করে দ্রুত যাচাই করা যায়।

**৩. `pumpAndSettle` আর কাজ করে না।** `CountdownText`-এ `Timer.periodic` চলায়
উইজেট-ট্রি কখনো "settle" হয় না। **সমাধান:** `tester.pump(duration)` লুপ, অথবা
যেখানে async জড়িত সেখানে `tester.runAsync` + ভেতরে পাম্প।

---

## ৩. ⭐ ডায়াগনস্টিক ডিজাইন — "অসীম লোড" আর নয়

সবচেয়ে বিব্রতকর অবস্থা: শিক্ষার্থী অ্যাপ খোলে, চিরকাল লোড দেখে, আর কিছুই জানে না।
কারণ সাধারণত ডেভ-নেটওয়ার্ক (ভিন্ন Wi-Fi, অথবা Windows Firewall ইনবাউন্ড পোর্ট
ব্লক) — কিন্তু **Firewall প্যাকেট নীরবে ফেলে দিলে** সংযোগ প্রত্যাখ্যাতও হয় না,
উত্তরও আসে না। তখন টাইমআউট ছাড়া কিছুই থামায় না।

তিনটি স্তরে সমাধান:

**১. সময়সীমা সর্বত্র** — `ApiClient`-এ `defaultOverallTimeout = ২৫ সে`
(connect/receive টাইমআউট যথেষ্ট নয়), আর `main()`-এ `/api/time` সিঙ্কে ৩ সে।

**২. `runApp` সবসময় ডাকা হয়** — স্টার্টআপের কোনো ধাপ throw করলে আগে ফাঁকা সাদা
স্ক্রিনে আটকে থাকত। এখন পুরো প্রস্তুতি try/catch-এ, আর ব্যর্থ হলে কারণ দেখানো হয়।

**৩. `ApiErrorView` সৎ তথ্য দেয়** — শুধু "নেটওয়ার্ক সমস্যা" নয়, বরং:
- কোন **কোড** (`NETWORK_ERROR` / `TIMEOUT` / `NOT_FOUND`…)
- **কোন ঠিকানায়** যেতে চাইছিল (ApiClient-এর সত্যিকারের baseUrl)
- **কী করবেন**: একই Wi-Fi?, ফোনের ব্রাউজারে `<baseUrl>/api/time` খুলুন, JSON
  এলে সমস্যা অ্যাপে — না এলে ফায়ারওয়াল

ফোনের ব্রাউজারে ওই URL খোলাই **দ্রুততম নির্ণয়**: ১০ সেকেন্ডে বলে দেয় সমস্যা
নেটওয়ার্কে না অ্যাপে।

---

## ৪. Android-নির্দিষ্ট যা ধরা পড়েছে

**`cleartext` ব্লক (targetSdk ২৮+)** — ডেভ API চলে `http://`-এ, কিন্তু Android
ডিফল্টে প্লেইন HTTP ব্লক করে। তাই `android/app/src/debug/AndroidManifest.xml`-এ
`android:usesCleartextTraffic="true"` দেওয়া আছে — **শুধু debug-এ**, ফলে release
বিল্ড HTTPS-ই ব্যবহার করে। ⚠️ ওই লাইনটি কখনো `src/main/`-এ সরাবেন না।

**এমুলেটরে হার্ডওয়্যার অ্যাক্সিলারেশন লাগে** — এই মেশিনে `aehd` (Android Emulator
hypervisor driver) নেই, তাই:
```
ERROR | x86_64 emulation currently requires hardware acceleration!
```
ইনস্টলে অ্যাডমিন লাগে (`D:\Android\sdk\extras\google\Android_Emulator_Hypervisor_Driver\silent_install.bat`)।
**আসল ফোনে এই সমস্যা নেই** — তাই ফোনই প্রস্তাবিত পথ।

**ডিভাইসে চালানোর ঠিকানা:**
```powershell
# এমুলেটর: 10.0.2.2 = হোস্টের localhost
flutter run

# আসল ফোন (একই Wi-Fi): ডেভ মেশিনের LAN IP
flutter run --dart-define=BCS_API_BASE_URL=http://192.168.0.107:3100
flutter build apk --debug --dart-define=BCS_API_BASE_URL=http://192.168.0.107:3100
```

---

## ৫. 🎨 ডিজাইন-মিল: অনুমান নয়, ওয়েবের সোর্স থেকেই

**যে ভুলটা হয়েছিল:** থিমে `ColorScheme.fromSeed(Color(0xFF1B5E20))` দেওয়া হয়েছিল —
"আরোহণের ব্র্যান্ড-রঙের কাছাকাছি সবুজ" ভেবে। আর ফন্টে ব্যবহার করা হয়েছিল
**Hind Siliguri**। দুটোই ভুল ছিল, আর ব্যবহারকারী সাথে সাথে ধরতে পেরেছিলেন:
*"ওয়েবসাইটের রঙের সাথে অ্যাপের রঙ মিলছে না।"*

**ওয়েব আসলে ব্যবহার করে:**

| | মান | সূত্র |
|---|---|---|
| প্রাইমারি | **indigo-600 `#4F46E5`** | `tailwind.config.ts` → `colors.brand` |
| সেকেন্ডারি | violet-600 `#7C3AED` | হিরোর গ্রেডিয়েন্ট |
| বডি-পৃষ্ঠ | slate-50 `#F8FAFC` | `layout.tsx` → `body: bg-slate-50` |
| কার্ড | সাদা + `border-slate-200` | `StatCards.tsx`, `LiveExamGrid.tsx` |
| লেখা | slate-800 / slate-500 | `text-slate-800` / `text-slate-500` |
| সফলতা | emerald-600 `#059669` | `bg-emerald-50 text-emerald-600` |
| ত্রুটি/লাইভ | rose-600 `#E11D48` | `bg-rose-200/90` ব্যাজ |
| হাইলাইট | amber-300/400/500 | হিরোর গ্রেডিয়েন্ট টেক্সট |
| **ফন্ট** | **Kalpurush** (self-hosted) | `globals.css` → `@font-face` |

**শিক্ষা:**
1. **ব্র্যান্ড-রঙ কখনো অনুমান করবেন না** — `tailwind.config.ts` পড়ুন। ওখানে
   `colors.brand` পুরো indigo স্কেল দিয়ে লেখা ছিল।
2. **ফন্ট কপি করে আনুন, নাম দেখে অনুমান নয়** — `public/fonts/Kalpurush-Regular.ttf`
   ওয়েব প্রকল্পেই ছিল (৩০৭ KB)। কপি করলে **হুবহু** মেলে; বদলে "একই রকমের বাংলা
   ফন্ট" নামালে চেহারা আলাদা হয়। বোনাস: Kalpurush-এর একটাই ওয়েট, তাই APK-এ
   Hind Siliguri-র তিন ওয়েটের (~৭৯০ KB) বদলে মাত্র ৩০৭ KB যোগ হয়।
3. **রঙের ব্যবহার-কম্পাঙ্ক গুনুন** — সব কম্পোনেন্টে Tailwind শ্রেণি গুনে দেখা যায়
   ওয়েবে আসলে কোন রঙ কতটা ব্যবহৃত (এখানে: `border-slate-200` ২৪২ বার,
   `text-indigo-600` ৮৬ বার)। এতে অনুমান বাদ পড়ে।
4. **থিমে রঙের মান সরাসরি হেক্সে**, `withOpacity()` নয় — সেটা নতুন Flutter-এ
   deprecated, আর হেক্সে লিখলে CSS-এর সাথে লিখিতভাবে মেলে (`amber-400/15` = `0x26FBBF24`)।
5. **অলংকরণও নকল করুন** — হিরো-ব্যানারের গ্রেডিয়েন্ট, blur-বৃত্ত, কাচের ব্যাজ,
   amber গ্রেডিয়েন্ট-টেক্সট — সবই ওয়েবের `HeroBanner.tsx` থেকে হুবহু।
   শুধু রঙ মিলিয়ে দিলে অ্যাপ "একই রকম" লাগে, "একই" লাগে না।

> **একটা সূক্ষ্মতা:** ওয়েবের `animate-ping` অনন্তকাল চলে; অ্যাপে সেটা প্রতি ফ্রেমে
> রিপেইন্ট জাগায়। তাই পালস-ডট ধীর ও সংযত করা হয়েছে, আর `RepaintBoundary`-এ
> আটকে রাখা — অনুভূতি এক, ব্যাটারি-খরচ কম।

---

## ৬. ফেজ ২-এর যাচাই-প্রমাণ

- `flutter analyze` → **No issues found**
- **৩৫টি টেস্ট পাস**, যার মধ্যে:
  - **আসল সার্ভারের বিরুদ্ধে** ডেটা-লেয়ার: `/api/home` → `upcoming=2, courses=2`;
    `ServerClock` অফসেট ০ সেকেন্ড; অজানা পরীক্ষায় `NOT_FOUND`;
    টোকেন ছাড়া `/questions` → `UNAUTHENTICATED` (answer-key যায়নি)
  - উত্তর-রিলিজের হিসাব: `release − end = ১৮০০০০০ ms` = ঠিক ৩০ মিনিট
  - UI সত্যিই আসল ডেটা রেন্ডার করে (`live_api_test.dart`)
  - ত্রুটি-দর্শন: `TIMEOUT` ও `NETWORK_ERROR`-এ ডায়াগনস্টিক কার্ড, অসীম লোড নয়
- Debug APK বিল্ড সফল — `D:\App\BCS-One-Flutter-debug.apk`
