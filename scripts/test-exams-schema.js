const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://braytjbujysjydxbuqhv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYXl0amJ1anlzanlkeGJ1cWh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODAyMzUxMiwiZXhwIjoyMTAzNTk5NTEyfQ.CXDJnpGazf1pjMl2KdT8gwy1f61lDP1dtVeW9rv4yno'
);

async function testFetch() {
  const { data, error } = await supabase.from('exams').select('*').limit(1);
  console.log(data, error);
}
testFetch();
