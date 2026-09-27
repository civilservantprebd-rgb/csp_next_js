const fs = require('fs');
let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

const regex = /\{isAIModalOpen && \(\s*<AiQuestionGeneratorUI[\s\S]*?\/>\s*\)\}/;
code = code.replace(regex, '');

fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Fixed QuestionBuilder");
