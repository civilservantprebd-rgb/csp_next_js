const fs = require('fs');

let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

// 1. Add missing imports
if (!code.includes('parseBulkQuestionsText')) {
  code = code.replace(
    'import { BulkQuestionImporterModal } from "./BulkQuestionImporterModal";',
    'import { BulkQuestionImporterModal } from "./BulkQuestionImporterModal";\nimport { parseBulkQuestionsText } from "@/lib/question-parser";\nimport { addBulkQuestionsToExam } from "@/actions/admin-actions";'
  );
}

// 2. Replace state variables
code = code.replace(
  /const \[questionText, setQuestionText\] = useState\(""\);\s+const \[selectedTopic, setSelectedTopic\] = useState\(""\);\s+const \[isAddingNewTopic, setIsAddingNewTopic\] = useState\(false\);\s+const \[newTopicInput, setNewTopicInput\] = useState\(""\);\s+const \[allTopics, setAllTopics\] = useState<string\[\]>\(\[\]\);\s+const \[opt0, setOpt0\] = useState\(""\);\s+const \[opt1, setOpt1\] = useState\(""\);\s+const \[opt2, setOpt2\] = useState\(""\);\s+const \[opt3, setOpt3\] = useState\(""\);\s+const \[correctIdx, setCorrectIdx\] = useState\(0\);\s+const \[explanation, setExplanation\] = useState\(""\);/g,
  `const [rawText, setRawText] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [isAddingNewTopic, setIsAddingNewTopic] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [allTopics, setAllTopics] = useState<string[]>([]);`
);

// 3. Update resetForm
code = code.replace(
  /const resetForm = \(\) => \{\s+setQuestionText\(""\);\s+\/\/ Keep selectedTopic persistent across question submissions as requested\s+setIsAddingNewTopic\(false\);\s+setNewTopicInput\(""\);\s+setOpt0\(""\);\s+setOpt1\(""\);\s+setOpt2\(""\);\s+setOpt3\(""\);\s+setCorrectIdx\(0\);\s+setExplanation\(""\);\s+setEditingIndex\(null\);\s+\};/g,
  `const resetForm = () => {
    setRawText("");
    setIsAddingNewTopic(false);
    setNewTopicInput("");
    setEditingIndex(null);
  };`
);

// 4. Update handleEdit
code = code.replace(
  /const handleEdit = \(idx: number\) => \{[\s\S]*?setExplanation\(sol\.exp\);\s+\};/,
  `const handleEdit = (idx: number) => {
    const q = exam.questions?.[idx];
    const sol = solutions[idx] || { correct: 0, exp: "" };
    if (!q) return;

    setEditingIndex(idx);
    setSelectedTopic(q.topic || "");
    
    const chars = ["ক", "খ", "গ", "ঘ"];
    let text = \`১. \${q.q}\\n\`;
    q.opts.forEach((opt: string, i: number) => {
      text += \`\${chars[i] || i}) \${opt}\\n\`;
    });
    text += \`উত্তর: \${chars[sol.correct] || chars[0]}\\n\`;
    if (sol.exp) {
      text += \`ব্যাখ্যা: \${sol.exp}\\n\`;
    }
    setRawText(text);
  };`
);

// 5. Update handleSubmit
const newHandleSubmit = `
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      alert("অনুগ্রহ করে প্রশ্ন লিখুন।");
      return;
    }

    setIsLoading(true);
    
    // Parse bulk text
    const parsedBlocks = parseBulkQuestionsText(rawText);
    if (parsedBlocks.length === 0) {
      setIsLoading(false);
      alert("কোনো সঠিক প্রশ্ন পাওয়া যায়নি। অনুগ্রহ করে সঠিক ফরম্যাটে লিখুন (যেমন: ১. প্রশ্ন, ক) খ) গ) ঘ), উত্তর: ক)।");
      return;
    }

    try {
      const activeTopic = isAddingNewTopic ? newTopicInput.trim() : selectedTopic;
      
      if (editingIndex !== null) {
        // Update the first parsed question into the editing slot
        const first = parsedBlocks[0];
        const questionObj: QuestionItem = {
          q: first.q,
          opts: first.opts,
          topic: activeTopic || "সাধারণ"
        };
        const solutionObj: QuestionSolution = {
          correct: first.correct,
          exp: first.exp,
        };
        
        const ok = await updateQuestionInExam(activeExamKey, editingIndex, questionObj, solutionObj);
        if (!ok) {
          setIsLoading(false);
          alert("প্রশ্ন আপডেট করতে সমস্যা হয়েছে।");
          return;
        }
        
        // If they pasted MORE than 1 question while editing, append the rest
        if (parsedBlocks.length > 1) {
          const rest = parsedBlocks.slice(1);
          const newQs = rest.map(b => ({ q: b.q, opts: b.opts, topic: activeTopic || "সাধারণ" }));
          const newSols = rest.map(b => ({ correct: b.correct, exp: b.exp }));
          await addBulkQuestionsToExam(activeExamKey, newQs, newSols);
        }
        
        setEditingIndex(null);
      } else {
        // Add all parsed questions
        const newQs = parsedBlocks.map(b => ({ q: b.q, opts: b.opts, topic: activeTopic || "সাধারণ" }));
        const newSols = parsedBlocks.map(b => ({ correct: b.correct, exp: b.exp }));
        
        const res = await addBulkQuestionsToExam(activeExamKey, newQs, newSols);
        if (res && res.error) {
           alert("প্রশ্ন যুক্ত করতে সমস্যা হয়েছে: " + res.error);
        }
      }

      setIsLoading(false);
      resetForm();
      await loadSolutions();
      onRefresh();
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
      setIsLoading(false);
    }
  };
`;

code = code.replace(/const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?loadSolutions\(\);\s+onRefresh\(\);\s+\};/g, newHandleSubmit.trim());

// 6. Update the Form JSX
const oldFormRegex = /<div className="grid grid-cols-1 md:grid-cols-2 gap-4">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;

const newFormJSX = `<div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">প্রশ্ন, অপশন ও ব্যাখ্যা (Smart Paste)</label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={\`১. বাংলাদেশের রাজধানী কোথায়?\\nক) ঢাকা\\nখ) চট্টগ্রাম\\nগ) রাজশাহী\\nঘ) খুলনা\\nউত্তর: ক\\nব্যাখ্যা: ঢাকা হলো বাংলাদেশের রাজধানী।\`}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition text-sm h-48 resize-y"
              />
              <p className="text-xs text-slate-500 mt-1">বাল্ক ইম্পোর্টের মতো একই ফরম্যাটে প্রশ্ন পেস্ট করতে পারেন। একসাথে একাধিক প্রশ্নও দেয়া যাবে।</p>
            </div>
          </div>`;

code = code.replace(oldFormRegex, newFormJSX);

fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Updated UI correctly!");
