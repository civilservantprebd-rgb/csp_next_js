const fs = require("fs");
let c = fs.readFileSync("src/actions/student-actions.ts", "utf8");
c = c.replace(/if \(isReleased && \(s\.isPendingEvaluation \|\| s\.score === undefined\)\)/g, "if (isReleased)");

c = c.replace(/s\.answers\.forEach\(\(ans, idx\) => \{[\s\S]*?else incor\+\+;\s*\}\s*\}\);/g, `const isNewFormat = s.answers.length > 0 && typeof s.answers[0] === "object" && s.answers[0] !== null && "qid" in s.answers[0];
          if (isNewFormat) {
             const answerMap = new Map();
             s.answers.forEach(a => { if (a && a.qid) answerMap.set(a.qid, Number(a.ans)); });
             solutions.forEach(sol => {
               const ans = sol.id != null && answerMap.has(sol.id) ? answerMap.get(sol.id) : -1;
               if (ans !== undefined && ans !== -1 && sol) {
                  if (ans === sol.correct) cor++;
                  else incor++;
               }
             });
          } else {
             s.answers.forEach((ans, idx) => {
               const sol = solutions[idx];
               if (ans !== null && sol) {
                 if (Number(ans) === sol.correct) cor++;
                 else incor++;
               }
             });
          }`);

fs.writeFileSync("src/actions/student-actions.ts", c);
