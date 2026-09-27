const fs = require('fs');
let code = fs.readFileSync('src/actions/admin-actions.ts', 'utf8');

code = code.replace(/return \{ success: true, count: questionsInsert\.length \};/g, 'return { success: true, count: questionsInsert.length, insertedQuestions: filteredQuestions };');

fs.writeFileSync('src/actions/admin-actions.ts', code, 'utf8');
console.log("Updated admin-actions");
