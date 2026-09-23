const fs = require("fs");
let c = fs.readFileSync("src/actions/student-actions.ts", "utf8");
c = c.replace(/s\.correct = cor;\s*s\.incorrect = incor;\s*s\.score = Math\.max\(0, cor - incor \* 0\.5\);\s*s\.isPendingEvaluation = false;\s*evaluateJobs\.push\(\s*Promise\.resolve\(\s*supabase[\s\S]*?\.eq\("id", s\.id\)\s*\)\s*\);/g, `const newScore = Math.max(0, cor - incor * 0.5);
          if (s.score !== newScore || s.correct !== cor || s.incorrect !== incor || s.isPendingEvaluation) {
            s.correct = cor;
            s.incorrect = incor;
            s.score = newScore;
            s.isPendingEvaluation = false;
            evaluateJobs.push(
              Promise.resolve(
                supabase.from("submissions").update({
                  score: s.score,
                  correct: cor,
                  incorrect: incor,
                  is_pending_evaluation: false
                }).eq("id", s.id)
              )
            );
          }`);
fs.writeFileSync("src/actions/student-actions.ts", c);
