const fs = require("fs");
let c = fs.readFileSync("src/actions/student-actions.ts", "utf8");
c = c.replace(/s\.answers\.forEach\(a => \{ if \(a && a\.qid\) answerMap\.set\(a\.qid, Number\(a\.ans\)\); \}\);/g, "s.answers.forEach((a: any) => { if (a && typeof a === \\\"object\\\" && \\\"qid\\\" in a) answerMap.set(a.qid, Number(a.ans)); });");
fs.writeFileSync("src/actions/student-actions.ts", c);
