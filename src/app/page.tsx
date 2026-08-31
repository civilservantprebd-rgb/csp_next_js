import { fetchAppConfigLite } from "@/actions/admin-actions";
import HomeClient from "@/components/home/HomeClient";

// ISR: home page HTML is cached and regenerated at most once per minute.
// Content is now in the server-rendered HTML (fast LCP, no client fetch waterfall),
// and exam/config edits propagate within 60s.
export const revalidate = 60;

export default async function HomePage() {
  // Data is fetched server-side (Supabase runs in Node, not in the browser bundle)
  const config = await fetchAppConfigLite();
  return <HomeClient config={config} />;
}
