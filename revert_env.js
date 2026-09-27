const fs = require("fs");
let c = fs.readFileSync(".env.local", "utf8");
c = c.replace(/NEXT_PUBLIC_SUPABASE_URL=.*/, "NEXT_PUBLIC_SUPABASE_URL=https://braytjbujysjydxbuqhv.supabase.co");
c = c.replace(/NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/, "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYXl0amJ1anlzanlkeGJ1cWh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMjM1MTIsImV4cCI6MjEwMzU5OTUxMn0.AmDl16yYjHd3yg83Zs_rJ0z1uU__pNK99OEvd_Iar0w");
c = c.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/, "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyYXl0amJ1anlzanlkeGJ1cWh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODAyMzUxMiwiZXhwIjoyMTAzNTk5NTEyfQ.CXDJnpGazf1pjMl2KdT8gwy1f61lDP1dtVeW9rv4yno");
fs.writeFileSync(".env.local", c);
