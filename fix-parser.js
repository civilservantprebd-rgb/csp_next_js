const fs = require('fs');

let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

code = code.replace(
  'const parsedBlocks = parseBulkQuestionsText(rawText);',
  'const parsedResult = parseBulkQuestionsText(rawText);\n    const parsedBlocks = parsedResult.blocks.filter(b => b.isValid);'
);

fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Fixed parseBulkQuestionsText return value issue.");
