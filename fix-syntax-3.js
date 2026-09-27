const fs = require('fs');

let adminCode = fs.readFileSync('src/actions/admin-actions.ts', 'utf8');
adminCode = adminCode.replace(/\}\s*\n\s*\n\s*\}/g, '}\n');
fs.writeFileSync('src/actions/admin-actions.ts', adminCode, 'utf8');

let portalCode = fs.readFileSync('src/app/portal/PortalClient.tsx', 'utf8');
portalCode = portalCode.replace(/import\("@\/actions\/admin-actions"\)\.then\(\(\{ fetchDriveLinks \}\) => \{[\s\S]*?fetchDriveLinks\(\)\.then\(\(links\) => \{[\s\S]*?\}\);\s*\}\);/g, '');
fs.writeFileSync('src/app/portal/PortalClient.tsx', portalCode, 'utf8');

console.log('Fixed syntax and imports');
