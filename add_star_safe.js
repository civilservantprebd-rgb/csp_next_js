const fs = require('fs');
let qbm = fs.readFileSync('src/components/admin/QuestionBankManager.tsx', 'utf8');

// Ensure toggleMaster exists
const toggleFunc = `
  const toggleMaster = async (id: string, current: boolean) => {
    try {
      const { toggleQuestionMaster } = await import("@/actions/admin-actions");
      const ok = await toggleQuestionMaster(id, !current);
      if (ok) {
        setQuestions(qs => qs.map(q => q.id === id ? { ...q, is_master: !current } : q));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit`;

if (!qbm.includes('const toggleMaster =')) {
  qbm = qbm.replace('  const startEdit', toggleFunc);
}

// Ensure Star is imported
if (!qbm.includes(' Star ') && !qbm.includes(' Star,')) {
  qbm = qbm.replace('import { Sparkles', 'import { Sparkles, Star');
}

// Add the button
const btnTarget = '                    <div className="flex items-center gap-1.5 shrink-0">\r\n                      <button\r\n                        onClick={() => startEdit(q)}';
const btnTargetLF = btnTarget.replace(/\r/g, '');

const btnReplace = `                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => toggleMaster(q.id, !!q.is_master)}
                        className={\`bg-white hover:bg-amber-50 border p-1.5 rounded-lg text-xs transition cursor-pointer \${q.is_master ? "text-amber-500 border-amber-500 bg-amber-50" : "text-slate-400 border-slate-200"}\`}
                        title={q.is_master ? "Master Question (High Quality)" : "Mark as Master Question"}
                      >
                        <Star className={\`w-3.5 h-3.5 \${q.is_master ? "fill-amber-500" : ""}\`} />
                      </button>
                      <button
                        onClick={() => startEdit(q)}`;

if (!qbm.includes('<Star className=')) {
  if (qbm.includes(btnTarget)) {
    qbm = qbm.replace(btnTarget, btnReplace);
  } else if (qbm.includes(btnTargetLF)) {
    qbm = qbm.replace(btnTargetLF, btnReplace);
  } else {
    // regex fallback
    qbm = qbm.replace(/<div className="flex items-center gap-1\.5 shrink-0">[\s]*<button[\s]*onClick=\{\(\) => startEdit\(q\)\}/, btnReplace);
  }
}

fs.writeFileSync('src/components/admin/QuestionBankManager.tsx', qbm);
