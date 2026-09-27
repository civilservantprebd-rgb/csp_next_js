const fs = require('fs');

let code = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

code = code.replace(
  '} from "lucide-react";',
  '  Edit2,\n  CheckCircle2,\n  Trash2,\n  Plus\n} from "lucide-react";'
);

fs.writeFileSync('src/app/admin/page.tsx', code, 'utf8');
console.log("Added missing imports!");
