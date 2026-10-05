const fs = require('fs');

let ui = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

// Replace ...acceptedBatch.map(q => q.q) with ...verifiedQuestions.map(q => q.q)
ui = ui.replace(/\.\.\.acceptedBatch\.map\(q => q\.q\)/g, '...verifiedQuestions.map(q => q.q)');

fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', ui);
console.log("Fixed acceptedBatch error");
