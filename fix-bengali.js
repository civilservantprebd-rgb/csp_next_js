const fs = require('fs');
let code = fs.readFileSync('src/actions/ai-actions.ts', 'utf8');

// The file contains Bengali strings.
code = code.replace(/বিসিএস স্ট্যান্ডার্ড/g, 'বিসিএস প্রিলিমিনারি মান');

fs.writeFileSync('src/actions/ai-actions.ts', code, 'utf8');
console.log("Replaced Bengali text.");
