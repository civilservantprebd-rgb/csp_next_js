const { createClient } = require("@supabase/supabase-js");
const url = "https://braytjbujysjydxbuqhv.supabase.co";
const oldKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYXl0amJ1anlzanlkeGJ1cWh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODAyMzUxMiwiZXhwIjoyMTAzNTk5NTEyfQ.CXDJnpGazf1pjMl2KdT8gwy1f61lDP1dtVeW9rv4yno";
const supabase = createClient(url, oldKey);
async function run() {
  const tables = ["exams", "question_bank", "exam_questions_link", "submissions"];
  for (const t of tables) {
    const { data } = await supabase.from(t).select("*").limit(1);
    console.log(`Table ${t}:`, JSON.stringify(data?.[0]));
  }
}
run();
