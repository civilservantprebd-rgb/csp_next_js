const fs = require('fs');
let code = fs.readFileSync('src/actions/ai-actions.ts', 'utf8');

code = code.replace(
  'contextText?: string;\n  apiKey?: string;',
  'contextText?: string;\n  customInstruction?: string;\n  apiKey?: string;'
);

code = code.replace(
  ', contextText } = params;',
  ', contextText, customInstruction } = params;'
);

const instructionPrompt = '\\n${customInstruction ? `\\\\nবিশেষ নির্দেশনা:\\\\n"""\\\\n${customInstruction}\\\\n"""\\\\n` : ""}';
code = code.replace(
  '${contextText ? `\\nরেফারেন্স',
  '${customInstruction ? `\\nবিশেষ নির্দেশনা (অবশ্যই মেনে চলতে হবে):\\n"""\\n${customInstruction}\\n"""\\n` : ""}\n${contextText ? `\\nরেফারেন্স'
);

fs.writeFileSync('src/actions/ai-actions.ts', code, 'utf8');
console.log('Modified ai-actions.ts');
