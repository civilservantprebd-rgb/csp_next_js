const fs = require('fs');

let code = fs.readFileSync('src/app/portal/page.tsx', 'utf8');
code = code.replace(
  /const \[identity, links\] = await Promise\.all\(\[\s*resolveStudyIdentity\(null, null\),\s*fetchDriveLinks\(\)\s*\]\);/g,
  'const identity = await resolveStudyIdentity(null, null);'
);
code = code.replace(/initialDriveLinks = links;/g, '');
fs.writeFileSync('src/app/portal/page.tsx', code, 'utf8');
console.log('Fixed fetchDriveLinks in portal/page.tsx');
