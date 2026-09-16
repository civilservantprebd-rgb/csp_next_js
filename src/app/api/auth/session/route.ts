import {
  apiFail,
  apiOk,
  identify,
  profileToDto,
  readBearerToken,
  readJsonBody,
  resolveStudentProfile,
} from "@/lib/api-auth";
import { withRequestToken } from "@/lib/request-context";
import { syncStudentLogin } from "@/actions/student-actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/session — API কন্ট্রাক্ট v1 #1 (NATIVE-ANDROID-GUIDE.md §6.1)
 *
 * অ্যাপ Google Sign-In করে Supabase থেকে যে access token পায়, সেটা এখানে
 * পাঠিয়ে যাচাই করায় এবং শিক্ষার্থীর প্রোফাইল + এনরোলমেন্ট স্ট্যাটাস ফেরত পায়।
 *
 * টোকেন দুভাবে গ্রহণ করা হয় (দুটোই একইভাবে যাচাই হয়):
 *   ১. `Authorization: Bearer <token>` হেডার — **প্রস্তাবিত**
 *   ২. বডিতে `{ "accessToken": "<token>" }` — লগইনের ঠিক পরের "exchange" ধাপের জন্য
 *
 * সাইড-ইফেক্ট (ইচ্ছাকৃত): ওয়েব অ্যাপ Supabase-এর auth state change-এ ঠিক এটাই
 * করে (src/lib/supabase.ts → `syncStudentLogin`) — Google দিয়ে লগইন করা নতুন
 * শিক্ষার্থী রোস্টারে (`allowed_students`) ওঠে, তাই শিক্ষক প্যানেলে দেখা যায় ও
 * পরে কোর্সে এনরোল করানো যায়। অ্যাপ যদি এটা না করত, তবে অ্যাপ-লগইন করা
 * শিক্ষার্থীরা ওয়েব ড্যাশবোর্ডে অদৃশ্য থেকে যেত। ব্যর্থ হলেও লগইন আটকায় না —
 * ফলাফল `synced` ফিল্ডে জানানো হয়।
 */
export async function POST(req: Request) {
  const body = await readJsonBody(req);

  const headerToken = readBearerToken(req);
  const bodyToken =
    typeof body?.accessToken === "string" && body.accessToken.trim()
      ? body.accessToken.trim()
      : null;
  const token = headerToken || bodyToken;

  if (!token) {
    return apiFail(
      "UNAUTHENTICATED",
      "access token প্রয়োজন। `Authorization: Bearer <token>` হেডার পাঠান।",
      401
    );
  }

  const identity = await identify(token);
  if (!identity) {
    return apiFail(
      "TOKEN_INVALID",
      "টোকেনটি বৈধ নয় বা মেয়াদোত্তীর্ণ। অনুগ্রহ করে আবার লগইন করুন।",
      401
    );
  }

  // SECURITY: এর পরের সব action যাচাই করা টোকেন-প্রেক্ষাপটে চলে
  return withRequestToken(token, async () => {
    let synced = false;
    if (identity.role === "student") {
      try {
        const res = await syncStudentLogin({
          uid: identity.uid,
          name: identity.name || "শিক্ষার্থী",
          email: identity.email || "",
          photoURL: "",
        });
        synced = !!res?.success;
      } catch (err) {
        console.error("[api/auth/session] sync-login failed (non-fatal):", err);
      }
    }

    const profile = await resolveStudentProfile(identity);

    return apiOk({
      user: {
        uid: identity.uid,
        email: identity.email ?? null,
        name: identity.name ?? null,
        role: identity.role,
      },
      synced,
      ...profileToDto(profile),
    });
  });
}
