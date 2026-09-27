const fs = require('fs');
let code = fs.readFileSync('src/app/exam/[examId]/result/page.tsx', 'utf8');

const targetGrid = '<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">';
const replacementGrid = '<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">';

code = code.replace(targetGrid, replacementGrid);

// We need to inject the Skipped box right before the Score box.
// The score box starts with:
// <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
//   <span className="text-sm sm:text-xs text-indigo-600 block mb-1">চূড়ান্ত স্কোর</span>

const scoreBoxTarget = '<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">\n              <span className="text-sm sm:text-xs text-indigo-600 block mb-1">চূড়ান্ত স্কোর</span>';
// If it has \r\n
const scoreBoxTarget2 = '<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">\r\n              <span className="text-sm sm:text-xs text-indigo-600 block mb-1">চূড়ান্ত স্কোর</span>';

const skippedBox = `
            <div onClick={() => isPublished && handleToggleReview(true, "skipped")} className={\`bg-white p-4 rounded-2xl border \${filterMode === "skipped" ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"} text-center shadow-sm cursor-pointer hover:bg-amber-50 transition\`}>
              <span className="text-sm sm:text-xs text-amber-600 block mb-1">বাদ / স্কিপড</span>
              <span className="text-lg sm:text-xl font-bold text-amber-700">
                {!isPublished ? "অপ্রকাশিত" : toBengaliDigits((resultData.totalQuestions || 0) - ((resultData.correct || 0) + (resultData.incorrect || 0)))}
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">
              <span className="text-sm sm:text-xs text-indigo-600 block mb-1">চূড়ান্ত স্কোর</span>`;

if (code.includes('<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">\n              <span className="text-sm sm:text-xs text-indigo-600 block mb-1">চূড়ান্ত স্কোর</span>')) {
  code = code.replace(scoreBoxTarget, skippedBox);
} else {
  code = code.replace(scoreBoxTarget2, skippedBox);
}

fs.writeFileSync('src/app/exam/[examId]/result/page.tsx', code, 'utf8');
console.log("Added Skipped box to Exam Result");
