const fs = require("fs");
let c = fs.readFileSync("src/actions/student-actions.ts", "utf8");
c = c.replace(/typeof a === \\"object\\" && \\"qid\\" in a/g, "typeof a === \"object\" && \"qid\" in a");
fs.writeFileSync("src/actions/student-actions.ts", c);
