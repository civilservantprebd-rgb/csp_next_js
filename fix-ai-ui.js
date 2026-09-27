const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

code = code.replace(/setVerifiedQuestions\(prev => \[\.\.\.prev, \.\.\.acceptedBatch\]\);/g, 'setVerifiedQuestions(prev => [...prev, ...(res.insertedQuestions || []) as any]);');

fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', code, 'utf8');
console.log("Updated AiQuestionGeneratorUI");
