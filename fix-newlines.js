const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/export const maxDuration = 60;`n`nexport (async function|default function)/, 'export const maxDuration = 60;\n\nexport $1');
  fs.writeFileSync(file, content, 'utf8');
}

fixFile('src/app/admin/page.tsx');
fixFile('src/app/api/ai/draft/route.ts');
fixFile('src/app/api/ai/solve/route.ts');
console.log('Fixed newlines');
