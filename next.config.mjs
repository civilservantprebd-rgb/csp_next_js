/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Google profile photos (lh3.googleusercontent.com etc.) used in avatars
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },
  // SECURITY: this app stores student phone numbers, enrollment/payment
  // references and a JS-readable auth cookie, yet sent no security headers at
  // all. Only headers that cannot break existing behaviour are set here -- a
  // Content-Security-Policy needs its own tested rollout, because Supabase,
  // Google Fonts, YouTube embeds and Vercel Analytics all inject resources.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Stop MIME sniffing (an echoed/uploaded file must not run as script).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The app is never meant to be framed -> blocks clickjacking.
          { key: "X-Frame-Options", value: "DENY" },
          // Don't leak full URLs (they contain exam/course ids) to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No feature here needs these device APIs.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
