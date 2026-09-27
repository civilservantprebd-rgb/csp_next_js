const fs = require('fs');
let code = fs.readFileSync('src/app/portal/PortalClient.tsx', 'utf8');

// Remove initialDriveLinks from props
code = code.replace(/,\s*initialDriveLinks/g, '');
code = code.replace(/\s*initialDriveLinks\s*:\s*\{[^}]*\}\s*\|\s*null;/g, '');

// Remove if (!initialDriveLinks) { } block and the trailing dependency
code = code.replace(/if\s*\(!initialDriveLinks\)\s*\{\s*\}/g, '');
code = code.replace(/,\s*initialDriveLinks\s*\]/g, ']');

fs.writeFileSync('src/app/portal/PortalClient.tsx', code, 'utf8');
console.log("PortalClient fixed.");
