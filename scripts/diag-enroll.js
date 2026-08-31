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
  const { data: reqs, error } = await supabase.from("enroll_requests").select("*");
  if (error) return console.log("ERROR:", error.message);
  console.log("enroll_requests count:", (reqs||[]).length);
  (reqs||[]).forEach((r) => console.log(`- uid=${String(r.student_uid).slice(0,36)} | name=${r.name} | email=${r.email} | course=${r.course} | trx=${r.trx_id}`));
})();
