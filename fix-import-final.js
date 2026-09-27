const fs = require('fs');
let code = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

code = code.replace(
  '  Pin\n} from "lucide-react";',
  '  Pin,\n  Edit2,\n  CheckCircle2\n} from "lucide-react";'
);

code = code.replace(
  '  Pin\r\n} from "lucide-react";',
  '  Pin,\r\n  Edit2,\r\n  CheckCircle2\r\n} from "lucide-react";'
);

fs.writeFileSync('src/app/admin/page.tsx', code, 'utf8');
console.log("Fixed imports");
