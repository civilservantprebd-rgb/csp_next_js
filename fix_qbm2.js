const fs = require('fs');

let qbm = fs.readFileSync('src/components/admin/QuestionBankManager.tsx', 'utf8');

// The mangled button
const badBtnRegex = /<button\s*onClick=\{\(\) => toggleMaster[\s\S]*?<\/button>/;

const goodBtn = `<button
                        onClick={() => toggleMaster(q.id, !!q.is_master)}
                        className={\`bg-white hover:bg-amber-50 border p-1.5 rounded-lg text-xs transition cursor-pointer \${q.is_master ? "text-amber-500 border-amber-500 bg-amber-50" : "text-slate-400 border-slate-200"}\`}
                        title={q.is_master ? "Master Question (High Quality)" : "Mark as Master Question"}
                      >
                        <Star className={\`w-3.5 h-3.5 \${q.is_master ? "fill-amber-500" : ""}\`} />
                      </button>`;

if (qbm.match(badBtnRegex)) {
  qbm = qbm.replace(badBtnRegex, goodBtn);
  fs.writeFileSync('src/components/admin/QuestionBankManager.tsx', qbm);
  console.log("Fixed QuestionBankManager");
}
