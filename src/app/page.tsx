import { fetchAppConfigLite } from "@/actions/admin-actions";
import { getDailyNews } from "@/actions/news-actions";
import HomeClient from "@/components/home/HomeClient";

// ISR: home page HTML is cached and regenerated at most once per minute.
// Content is now in the server-rendered HTML (fast LCP, no client fetch waterfall),
// and exam/config edits propagate within 60s.
export const revalidate = 60;

export default async function HomePage() {
  // Data is fetched server-side (Supabase runs in Node, not in the browser bundle)
  // দৈনিক সংবাদও সার্ভারেই (কনফিগের সাথে সমান্তরালে) আনা হয় — ফলে ক্লায়েন্টে
  // আর কোনো লোডিং স্পিনার/অতিরিক্ত রাউন্ডট্রিপ ছাড়াই সংবাদ প্রথম পেইন্টেই দেখা যায়।
  const [config, dailyNews] = await Promise.all([fetchAppConfigLite(), getDailyNews()]);
  return <HomeClient config={config} initialDailyNews={dailyNews || []} />;
}
