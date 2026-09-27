const fs = require('fs');

let code = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

const injection = `            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">বিশেষ নির্দেশনা (প্রম্পট)</label>
              <textarea
                className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
                placeholder="যেমন: সাম্প্রতিক তথ্য যোগ করুন, অথবা কেবল মুক্তিযুদ্ধ নিয়ে প্রশ্ন বানান..."
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>`;

code = code.replace(
  /onChange=\{\(e\) => setTopic\(e\.target\.value\)\}\s*\/>\s*<\/div>/,
  'onChange={(e) => setTopic(e.target.value)}\n              />\n' + injection
);

fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', code, 'utf8');
console.log('Injected instructions textarea');
