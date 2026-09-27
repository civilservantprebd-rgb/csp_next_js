const fs = require('fs');
let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

const target = '<button\n              type="button"\n              onClick={() => setIsBulkModalOpen(true)}';
const replacement = `<button
              type="button"
              onClick={() => setIsAIModalOpen(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>AI দিয়ে প্রশ্ন তৈরি</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Restored original AI generator button!");
