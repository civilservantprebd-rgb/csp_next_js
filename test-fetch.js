const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.time('fetchCounts');
  const [{ count: tqCount }, { count: linkCount }] = await Promise.all([
    supabase.from("topic_questions").select("*", { count: "exact", head: true }),
    supabase.from("exam_questions_link").select("*", { count: "exact", head: true })
  ]);
  console.timeEnd('fetchCounts');
  console.log('tqCount:', tqCount, 'linkCount:', linkCount);

  console.time('fetchAll');
  const SUPABASE_PAGE_SIZE = 1000;
  const promises = [];
  for (let from = 0; from < tqCount; from += SUPABASE_PAGE_SIZE) {
    promises.push(
      supabase
        .from("topic_questions")
        .select("topic, q, exam_key")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + SUPABASE_PAGE_SIZE - 1)
    );
  }
  await Promise.all(promises);
  console.timeEnd('fetchAll');
}

run();
