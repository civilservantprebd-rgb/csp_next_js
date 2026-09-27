const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AIQuestionGeneratorModal.tsx', 'utf8');

const targetStr = 'value={contextText}';
const index = code.indexOf(targetStr);

if (index !== -1) {
  const beforeTarget = code.substring(0, index);
  const lastDivIndex = beforeTarget.lastIndexOf('<div>');
  
  const customBlock = `
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                বিশেষ নির্দেশনা (প্রম্পট) - ঐচ্ছিক
              </label>
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                placeholder="যেমন: সাম্প্রতিক তথ্য যোগ করুন, অথবা কেবল মুক্তিযুদ্ধ নিয়ে প্রশ্ন বানান..."
                className="w-full text-xs p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white min-h-[60px]"
              />
            </div>
`;
  
  if (!code.includes('value={customInstruction}')) {
    code = code.substring(0, lastDivIndex) + customBlock + code.substring(lastDivIndex);
    fs.writeFileSync('src/components/admin/AIQuestionGeneratorModal.tsx', code, 'utf8');
    console.log('UI injected via indexOf');
  } else {
    console.log('Already injected');
  }
} else {
  console.log('Target string not found');
}
