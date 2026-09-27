const fs = require('fs');

let code = fs.readFileSync('src/components/admin/AdminNav.tsx', 'utf8');
code = code.replace('{ id: "question_bank", label: "প্রশ্ন ব্যাংক", icon: Layers },', '// { id: "question_bank", label: "প্রশ্ন ব্যাংক", icon: Layers },');
fs.writeFileSync('src/components/admin/AdminNav.tsx', code, 'utf8');
console.log("Removed Question Bank button");
