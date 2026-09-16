import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped auth context (native অ্যাপের Bearer টোকেনের জন্য)।
 *
 * ── সমস্যা যেটা এটা সমাধান করে ──
 * ওয়েব অ্যাপে `src/lib/supabase.ts` লগইনের সময় access token-টা
 * `sb_access_token` কুকিতে লিখে রাখে, আর সার্ভারের প্রায় সব action
 * (`getSessionUserFromCookies` → `sessionOwnsStudent` → `getStudentSubmissions`
 * …) পরিচয় সেই কুকি থেকেই পড়ে।
 *
 * কিন্তু native অ্যাপ (Flutter/Android) কুকি পাঠায় না — সে পাঠায়
 * `Authorization: Bearer <supabase_access_token>` (NATIVE-ANDROID-GUIDE.md
 * §৩.২)। যদি আমরা প্রতিটি action-এ token প্যারামিটার যোগ করতাম, তবে ১০৪টি
 * action-সিগনেচার + তাদের সব কল-সাইট বদলাতে হতো — বিশাল, ঝুঁকিপূর্ণ diff।
 *
 * ── সমাধান ──
 * API route handler তার যাচাই করা Bearer টোকেনটা এই AsyncLocalStorage-এ
 * রেখে ভেতরের action-গুলো চালায়। `teacher-auth.ts`-এর টোকেন-রিডার আগে
 * এখান থেকে পড়ে; না পেলে আগের মতোই কুকিতে যায়।
 * ফলাফল: **একটি ফাইল বদলে সব action অ্যাপ থেকেও কাজ করে**, ওয়েব অ্যাপে
 * কোনো পরিবর্তন ছাড়াই।
 *
 * ── নিরাপত্তা-নোট ──
 * এখানে শুধু **যাচাই করা** টোকেন রাখা হয় — `withRequestToken` কল করার
 * আগে route handler `getUserFromToken()` দিয়ে টোকেনটা যাচাই করে নেয়।
 * ক্লায়েন্টের পাঠানো কাঁচা হেডার কখনো সরাসরি এখানে রাখবেন না।
 */

interface RequestAuthContext {
  /** যাচাই করা Supabase access token (Bearer)। */
  accessToken: string;
}

const storage = new AsyncLocalStorage<RequestAuthContext>();

/**
 * ভেতরের সব async কাজ (action/লাইব্রেরি কল) এই টোকেন-প্রেক্ষাপটে চলবে।
 *
 * @example
 * // src/app/api/student/me/route.ts
 * return withRequestToken(token, async () => {
 *   const data = await getStudentPortalData(user.id, user.email); // কুকি ছাড়াই কাজ করবে
 *   return NextResponse.json(data);
 * });
 */
export function withRequestToken<T>(
  accessToken: string | null | undefined,
  fn: () => Promise<T>
): Promise<T> {
  if (!accessToken) return fn();
  return storage.run({ accessToken }, fn);
}

/** চলমান রিকোয়েস্টের Bearer টোকেন (থাকলে), নাহলে null। */
export function getRequestAccessToken(): string | null {
  return storage.getStore()?.accessToken || null;
}
