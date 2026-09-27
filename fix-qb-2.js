const fs = require('fs');
let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');
code = code.replace(/addQuestionToExam,/, 'addQuestionToExam,\n  addBulkQuestionsToExam,');
fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Import fixed.");
