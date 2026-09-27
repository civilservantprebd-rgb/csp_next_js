const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AIQuestionGeneratorModal.tsx', 'utf8');

// Add state
code = code.replace(
  'const [contextText, setContextText] = useState("");',
  'const [contextText, setContextText] = useState("");\n  const [customInstruction, setCustomInstruction] = useState("");'
);

// Add to generate payload
code = code.replace(
  'difficulty,\n      contextText: contextText.trim()\n    });',
  'difficulty,\n      contextText: contextText.trim(),\n      customInstruction: customInstruction.trim()\n    });'
);

// Add textarea UI
const uiAddition = `
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

code = code.replace(
  '<div>\n              <label className="block text-xs font-bold text-slate-700 mb-1.5">\n                সহায়ক টেক্সট বা রেফারেন্স (ঐচ্ছিক)\n              </label>',
  uiAddition + '\n            <div>\n              <label className="block text-xs font-bold text-slate-700 mb-1.5">\n                সহায়ক টেক্সট বা রেফারেন্স (ঐচ্ছিক)\n              </label>'
);

fs.writeFileSync('src/components/admin/AIQuestionGeneratorModal.tsx', code, 'utf8');
console.log('Modified AIQuestionGeneratorModal.tsx');
