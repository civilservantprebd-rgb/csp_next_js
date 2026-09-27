const fs = require('fs');

let navCode = fs.readFileSync('src/components/admin/AdminNav.tsx', 'utf8');
navCode = navCode.replace(/\s*\|\s*"drivelinks"/, '');
navCode = navCode.replace(/\s*\{\s*id:\s*"drivelinks"[^\}]*\},\s*/, '');
fs.writeFileSync('src/components/admin/AdminNav.tsx', navCode, 'utf8');

let adminCode = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
adminCode = adminCode.replace(/\{activeTab === "drivelinks" && \([\s\S]*?<\/div>\s*\)\}/, '');
adminCode = adminCode.replace(/const handleSaveDriveLinks[\s\S]*?\};\s*/, '');
fs.writeFileSync('src/app/admin/page.tsx', adminCode, 'utf8');

console.log('Removed drivelinks UI entirely');
