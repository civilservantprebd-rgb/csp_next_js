const fs = require('fs');
let lines = fs.readFileSync('src/app/admin/page.tsx', 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Pin') && !lines[i].includes(',')) {
    lines[i] = lines[i].replace('Pin', 'Pin,');
    console.log("Fixed at line " + i);
  }
}

fs.writeFileSync('src/app/admin/page.tsx', lines.join('\n'), 'utf8');
