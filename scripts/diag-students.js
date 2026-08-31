const fs = require("fs");
const path = require("path");
const env = {};
fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/).forEach((line) => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
(async () => {
  const { data: students, error } = await supabase.from("allowed_students").select("*");
  if (error) return console.log("ERROR:", error.message);
  console.log("allowed_students count:", students.length);
  const emptyCourses = (students || []).filter((s) => !s.courses || (Array.isArray(s.courses) && s.courses.length === 0));
  const withEmail = (students || []).filter((s) => s.email && String(s.email).trim());
  console.log("with empty/missing courses:", emptyCourses.length);
  console.log("with email recorded:", withEmail.length);
  (students || []).slice(0, 20).forEach((s) => console.log(`- id=${String(s.id).slice(0, 36)} | name=${s.name} | courses=[${(s.courses||[]).join(", ")}] | email=${s.email || "(none)"}`));
})();
