const fs = require('fs');
let code = fs.readFileSync('src/actions/ai-actions.ts', 'utf8');

// We will add examId?: string
code = code.replace(/customInstruction\?: string;/, 'customInstruction?: string;\n  examId?: string;');
code = code.replace(/const \{ topic, subtopic, count = 5/, 'const { topic, subtopic, count = 5, examId,');

// We will rewrite the generation logic to loop!
// But wait, rewriting it with AST is safer than regex. I will write a script to replace the function body.
