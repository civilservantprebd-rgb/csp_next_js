require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFetch() {
  // Let's get any exam id first
  const { data: examData } = await supabase.from('exams').select('id').limit(1);
  if (!examData || examData.length === 0) {
    console.log("No exams found");
    return;
  }
  const examId = examData[0].id;
  console.log("Testing with exam ID:", examId);

  const { data: links, error } = await supabase
    .from("exam_questions_link")
    .select("order_index, question_bank(id, q, opts, correct, exp, topic)")
    .eq("exam_id", examId);

  console.log("Links error:", error);
  console.log("Links data:", JSON.stringify(links, null, 2));
}

testFetch();
