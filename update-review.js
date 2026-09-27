const fs = require('fs');
let code = fs.readFileSync('src/components/exam/ReviewCard.tsx', 'utf8');

if (!code.includes('filterMode?:')) {
  code = code.replace(
    'studentAnswers: any[]; // (number | null)[] OR { qid: string, ans: number | null }[]\n}',
    'studentAnswers: any[]; // (number | null)[] OR { qid: string, ans: number | null }[]\n  filterMode?: "all" | "correct" | "incorrect" | "skipped";\n}'
  );
  code = code.replace(
    'export const ReviewCard: React.FC<ReviewCardProps> = ({',
    'export const ReviewCard: React.FC<ReviewCardProps> = ({'
  );
  code = code.replace(
    '  studentAnswers,\n}) => {',
    '  studentAnswers,\n  filterMode = "all",\n}) => {'
  );

  // Add the filter logic inside the map
  const targetMap = '{questions.map((q, idx) => {';
  const replacementMap = `{questions.map((q, idx) => {
        let rawAns = isNewFormat ? (q.id && answerMap.has(q.id) ? answerMap.get(q.id) : null) : studentAnswers[idx];
        if (rawAns === -1 || rawAns === undefined) rawAns = null;
        const ans = rawAns as number | null;
        const sol = solutions[idx] || { correct: 0, exp: "" };
        const isCorrect = ans === sol.correct;
        const isSkipped = ans === null;
        
        if (filterMode === "correct" && !isCorrect) return null;
        if (filterMode === "incorrect" && (isCorrect || isSkipped)) return null;
        if (filterMode === "skipped" && !isSkipped) return null;`;
  
  code = code.replace(
    /\{questions\.map\(\(q, idx\) => \{\s+let rawAns = isNewFormat \? \(q\.id && answerMap\.has\(q\.id\) \? answerMap\.get\(q\.id\) : null\) : studentAnswers\[idx\];\s+if \(rawAns === -1 \|\| rawAns === undefined\) rawAns = null;\s+const ans = rawAns as number \| null;\s+const sol = solutions\[idx\] \|\| \{ correct: 0, exp: "" \};\s+const isCorrect = ans === sol\.correct;\s+const isSkipped = ans === null;/,
    replacementMap
  );
  
  fs.writeFileSync('src/components/exam/ReviewCard.tsx', code, 'utf8');
}
console.log("Updated ReviewCard.tsx");
