const fs = require('fs');
let code = fs.readFileSync('src/app/portal/[section]/PortalSectionClient.tsx', 'utf8');

code = code.replace(
  /\} as AppConfigData\s*\);/,
  '} as AppConfigData : null);'
);

fs.writeFileSync('src/app/portal/[section]/PortalSectionClient.tsx', code, 'utf8');
console.log('Fixed PortalSectionClient.tsx syntax error');
