const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://braytjbujysjydxbuqhv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYXl0amJ1anlzanlkeGJ1cWh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODAyMzUxMiwiZXhwIjoyMTAzNTk5NTEyfQ.CXDJnpGazf1pjMl2KdT8gwy1f61lDP1dtVeW9rv4yno'
);

async function testFetch() {
  const { data: examData } = await supabase.from('exams').select('id').limit(1);
  if (!examData || examData.length === 0) return;
  const examId = examData[0].id;
  console.log("Exam ID:", examId);

  const { data: links, error } = await supabase
    .from("exam_questions_link")
    .select("order_index, question_bank(id, q, opts, correct, exp, topic)")
    .eq("exam_id", examId);

  console.log("Links error:", error);
  console.log("Links fetched:", links ? links.length : 0);
}

testFetch();
