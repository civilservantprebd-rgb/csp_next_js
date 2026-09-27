const fs = require('fs');
let code = fs.readFileSync('src/app/exam/[examId]/result/page.tsx', 'utf8');

// Add state
if (!code.includes('const [filterMode, setFilterMode] = useState<"all" | "correct" | "incorrect" | "skipped">("all");')) {
  code = code.replace(
    'const [showReview, setShowReview] = useState(false);',
    'const [showReview, setShowReview] = useState(false);\n  const [filterMode, setFilterMode] = useState<"all" | "correct" | "incorrect" | "skipped">("all");'
  );
}

// Modify handleToggleReview
const handleToggleTarget = 'const handleToggleReview = async () => {';
const handleToggleReplacement = `const handleToggleReview = async (forceShow = false, filter?: "all" | "correct" | "incorrect" | "skipped") => {
    if (filter) setFilterMode(filter);`;
code = code.replace(handleToggleTarget, handleToggleReplacement);

code = code.replace(
  'setShowReview(!showReview);',
  'setShowReview(forceShow === true ? true : !showReview);'
);

// Modify stat boxes
const boxTotalTarget = '<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">';
const boxTotalReplacement = '<div onClick={() => isPublished && handleToggleReview(true, "all")} className={`bg-white p-4 rounded-2xl border ${filterMode === "all" ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"} text-center shadow-sm cursor-pointer hover:bg-slate-50 transition`}>';

const boxCorrectTarget = '<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">';
const boxCorrectReplacement = '<div onClick={() => isPublished && handleToggleReview(true, "correct")} className={`bg-white p-4 rounded-2xl border ${filterMode === "correct" ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"} text-center shadow-sm cursor-pointer hover:bg-emerald-50 transition`}>';

const boxIncorrectTarget = '<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">';
const boxIncorrectReplacement = '<div onClick={() => isPublished && handleToggleReview(true, "incorrect")} className={`bg-white p-4 rounded-2xl border ${filterMode === "incorrect" ? "border-rose-400 ring-2 ring-rose-100" : "border-slate-200"} text-center shadow-sm cursor-pointer hover:bg-rose-50 transition`}>';

// We need to replace them carefully in order.
// Let's use a regex to replace each block safely.
code = code.replace(
  /<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">\s*<span className="text-sm sm:text-xs text-slate-500 block mb-1">মোট প্রশ্ন<\/span>/,
  boxTotalReplacement + '\n              <span className="text-sm sm:text-xs text-slate-500 block mb-1">মোট প্রশ্ন</span>'
);

code = code.replace(
  /<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">\s*<span className="text-sm sm:text-xs text-emerald-600 block mb-1">সঠিক উত্তর<\/span>/,
  boxCorrectReplacement + '\n              <span className="text-sm sm:text-xs text-emerald-600 block mb-1">সঠিক উত্তর</span>'
);

code = code.replace(
  /<div className="bg-white p-4 rounded-2xl border border-slate-200 text-center shadow-sm">\s*<span className="text-sm sm:text-xs text-rose-600 block mb-1">ভুল উত্তর \(-\u09E6\.\u09EB\)<\/span>/,
  boxIncorrectReplacement + '\n              <span className="text-sm sm:text-xs text-rose-600 block mb-1">ভুল উত্তর (-০.৫)</span>'
);

// We also need to add a "Skipped" box? Currently there is no "Skipped" box! There's only Total, Correct, Incorrect, Score.
// "folafol e tap korle (সঠিক ভুল বাদ) egula ase... "
// Wait! Maybe the user means practice result? Let's check Practice result.

// Pass filterMode to ReviewCard
code = code.replace(
  '<ReviewCard\n                questions={exam.questions || []}\n                solutions={solutions}\n                studentAnswers={resultData.answers || []}\n              />',
  '<ReviewCard\n                questions={exam.questions || []}\n                solutions={solutions}\n                studentAnswers={resultData.answers || []}\n                filterMode={filterMode}\n              />'
);

fs.writeFileSync('src/app/exam/[examId]/result/page.tsx', code, 'utf8');
console.log("Updated Exam result page");
