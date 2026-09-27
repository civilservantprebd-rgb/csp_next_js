const fs = require('fs');

let pageCode = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// Match any indentation of Pin
pageCode = pageCode.replace(
  /([ \t]*)Pin\r?\n\} from "lucide-react";/,
  '$1Pin,\n$1Edit2,\n$1CheckCircle2\n} from "lucide-react";'
);

fs.writeFileSync('src/app/admin/page.tsx', pageCode, 'utf8');
console.log("Fixed imports using Regex");
