const fs = require('fs');

let code = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

code = code.replace(
  '  Pin\n  Edit2,',
  '  Pin,\n  Edit2,'
);

fs.writeFileSync('src/app/admin/page.tsx', code, 'utf8');
console.log("Fixed comma!");
