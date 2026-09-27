const fs = require('fs');

let code = fs.readFileSync('src/actions/admin-actions.ts', 'utf8');

code = code.replace(
  'console.error("Update question error:", err);',
  'console.error("Update question error DETAILS:", err);'
);

// In QuestionBuilder.tsx, let's also alert the exact error if ok is false
let qb = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');
qb = qb.replace(
  'alert("প্রশ্ন আপডেট করতে সমস্যা হয়েছে।");',
  'alert("প্রশ্ন আপডেট করতে সমস্যা হয়েছে। " + (window as any).lastErr || "");'
);
// wait, I can't easily get the error from updateQuestionInExam because it returns false instead of throwing.
// Let's modify updateQuestionInExam to return { success: boolean, error?: string }

fs.writeFileSync('src/actions/admin-actions.ts', code, 'utf8');
fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', qb, 'utf8');
