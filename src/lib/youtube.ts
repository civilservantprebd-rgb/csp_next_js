/** Full YouTube URL/শর্ট লিংক/raw ID — যেকোনোটা থেকে ভিডিও ID বের করে */
export function extractYoutubeId(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?.*?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  return null;
}
