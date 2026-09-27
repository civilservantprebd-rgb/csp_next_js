const fs = require('fs');
let code = fs.readFileSync('src/components/modals/SelfPracticeExamArena.tsx', 'utf8');

if (!code.includes('const [filterMode, setFilterMode]')) {
  code = code.replace(
    'const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);',
    'const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);\n  const [filterMode, setFilterMode] = useState<"all" | "correct" | "incorrect" | "skipped">("all");'
  );

  // Replace total box
  code = code.replace(
    '<div className="bg-slate-50 border border-slate-100 p-3 sm:p-4 rounded-2xl text-center">',
    '<div onClick={() => setFilterMode("all")} className={`bg-slate-50 border ${filterMode === "all" ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-100"} p-3 sm:p-4 rounded-2xl text-center cursor-pointer hover:bg-slate-100 transition`}>'
  );

  // Replace correct box
  code = code.replace(
    '<div className="bg-emerald-50 border border-emerald-100 p-3 sm:p-4 rounded-2xl text-center">',
    '<div onClick={() => setFilterMode("correct")} className={`bg-emerald-50 border ${filterMode === "correct" ? "border-emerald-400 ring-2 ring-emerald-100" : "border-emerald-100"} p-3 sm:p-4 rounded-2xl text-center cursor-pointer hover:bg-emerald-100 transition`}>'
  );

  // Replace incorrect box
  code = code.replace(
    '<div className="bg-rose-50 border border-rose-100 p-3 sm:p-4 rounded-2xl text-center">',
    '<div onClick={() => setFilterMode("incorrect")} className={`bg-rose-50 border ${filterMode === "incorrect" ? "border-rose-400 ring-2 ring-rose-100" : "border-rose-100"} p-3 sm:p-4 rounded-2xl text-center cursor-pointer hover:bg-rose-100 transition`}>'
  );

  // Replace skipped box
  code = code.replace(
    '<div className="bg-amber-50 border border-amber-100 p-3 sm:p-4 rounded-2xl text-center">',
    '<div onClick={() => setFilterMode("skipped")} className={`bg-amber-50 border ${filterMode === "skipped" ? "border-amber-400 ring-2 ring-amber-100" : "border-amber-100"} p-3 sm:p-4 rounded-2xl text-center cursor-pointer hover:bg-amber-100 transition`}>'
  );

  // Update map loop to filter
  const mapStr = '{questions.map((q, qIdx) => {';
  const filterCode = `{questions.map((q, qIdx) => {
               const myAns = userAnswers[qIdx];
               const isSkipped = myAns === null;
               const isCorrect = myAns === q.correct;
               
               if (filterMode === "correct" && !isCorrect) return null;
               if (filterMode === "incorrect" && (isCorrect || isSkipped)) return null;
               if (filterMode === "skipped" && !isSkipped) return null;
`;
  
  code = code.replace(
    /\{questions\.map\(\(q, qIdx\) => \{\s+const myAns = userAnswers\[qIdx\];\s+const isSkipped = myAns === null;\s+const isCorrect = myAns === q\.correct;/,
    filterCode
  );

  fs.writeFileSync('src/components/modals/SelfPracticeExamArena.tsx', code, 'utf8');
  console.log("Updated SelfPracticeExamArena");
} else {
  console.log("Already updated SelfPracticeExamArena");
}
