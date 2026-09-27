const fs = require('fs');
let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

code = code.replace(
  '<span>AI দিয়ে প্রশ্ন তৈরি</span>',
  '<span>Question Generator</span>'
);

fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Changed button text to Question Generator");
