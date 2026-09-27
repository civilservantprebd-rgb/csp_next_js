const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminNav.tsx', 'utf8');
content = content.replace('label: "AI প্রশ্ন মেকার"', 'label: "প্রশ্ন মেকার"');
fs.writeFileSync('src/components/admin/AdminNav.tsx', content, 'utf8');
console.log('Fixed AdminNav text');
