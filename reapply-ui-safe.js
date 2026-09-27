const fs = require('fs');

let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

// Replace state
code = code.replace(
  /const \[questionText, setQuestionText\] = useState\(""\);[\s\S]*?const \[explanation, setExplanation\] = useState\(""\);/m,
  `const [rawText, setRawText] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [isAddingNewTopic, setIsAddingNewTopic] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState("");
  const [allTopics, setAllTopics] = useState<string[]>([]);`
);

// Replace resetForm
code = code.replace(
  /const resetForm = \(\) => \{[\s\S]*?setEditingIndex\(null\);\s+\};/m,
  `const resetForm = () => {
    setRawText("");
    setIsAddingNewTopic(false);
    setNewTopicInput("");
    setEditingIndex(null);
  };`
);

// Replace handleEdit
code = code.replace(
  /const handleEdit = \(idx: number\) => \{[\s\S]*?setExplanation\(sol\.exp\);\s+\};/m,
  `const handleEdit = (idx: number) => {
    const q = exam.questions?.[idx];
    const sol = solutions[idx] || { correct: 0, exp: "" };
    if (!q) return;

    setEditingIndex(idx);
    setSelectedTopic(q.topic || "");
    
    const chars = ["ক", "খ", "গ", "ঘ"];
    let text = "১. " + q.q + "\\n";
    q.opts.forEach((opt, i) => {
      text += (chars[i] || i) + ") " + opt + "\\n";
    });
    text += "উত্তর: " + (chars[sol.correct] || chars[0]) + "\\n";
    if (sol.exp) {
      text += "ব্যাখ্যা: " + sol.exp + "\\n";
    }
    setRawText(text);
  };`
);

// Replace handleSubmit
const newHandleSubmit = `
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) {
      alert("অনুগ্রহ করে প্রশ্ন লিখুন।");
      return;
    }

    setIsLoading(true);
    
    const parsedBlocks = parseBulkQuestionsText(rawText);
    if (parsedBlocks.length === 0) {
      setIsLoading(false);
      alert("কোনো সঠিক প্রশ্ন পাওয়া যায়নি। অনুগ্রহ করে সঠিক ফরম্যাটে লিখুন (যেমন: ১. প্রশ্ন, ক) খ) গ) ঘ), উত্তর: ক)।");
      return;
    }

    try {
      const activeTopic = isAddingNewTopic ? newTopicInput.trim() : selectedTopic;
      
      if (editingIndex !== null) {
        const first = parsedBlocks[0];
        const questionObj = {
          q: first.q,
          opts: first.opts,
          topic: activeTopic || "সাধারণ"
        };
        const solutionObj = {
          correct: first.correct,
          exp: first.exp,
        };
        
        const ok = await updateQuestionInExam(activeExamKey, editingIndex, questionObj, solutionObj);
        if (!ok) {
          setIsLoading(false);
          alert("প্রশ্ন আপডেট করতে সমস্যা হয়েছে।");
          return;
        }
        
        if (parsedBlocks.length > 1) {
          const rest = parsedBlocks.slice(1);
          const newQs = rest.map(b => ({ q: b.q, opts: b.opts, topic: activeTopic || "সাধারণ" }));
          const newSols = rest.map(b => ({ correct: b.correct, exp: b.exp }));
          await addBulkQuestionsToExam(activeExamKey, newQs, newSols);
        }
        
        setEditingIndex(null);
      } else {
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

code = code.replace(/const handleSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?loadSolutions\(\);\s+onRefresh\(\);\s+\};/m, newHandleSubmit.trim());

// Replace JSX form content
const oldFormStart = code.indexOf('<form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">');
if (oldFormStart > -1) {
  const submitBtnStr = '          <div className="flex justify-end pt-2 gap-2">';
  const submitBtnStart = code.indexOf(submitBtnStr, oldFormStart);
  
  if (submitBtnStart > -1) {
    const newFormContent = `
        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-xs sm:text-sm font-bold text-slate-700">প্রশ্ন, অপশন ও ব্যাখ্যা (Smart Paste)</label>
              <button type="button" onClick={() => setRawText(SAMPLE_TEXT)} className="text-xs text-indigo-600 hover:underline">নমুনা দেখুন</button>
            </div>
            <textarea
              required
              rows={8}
              placeholder="১. প্রশ্ন...\\nক) অপশন...\\nউত্তর: ক\\nব্যাখ্যা: ..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm bg-white font-mono"
            />
            <p className="text-[10px] sm:text-xs text-slate-500 mt-1.5">
              বাল্ক ইম্পোর্টের মতো একই ফরম্যাটে প্রশ্ন পেস্ট করুন। আপনি চাইলে একসাথে একাধিক প্রশ্নও পেস্ট করতে পারেন।
            </p>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">টপিক নির্বাচন করুন</label>
                {!isAddingNewTopic ? (
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50"
                  >
                    <option value="">-- টপিক নির্বাচন করুন --</option>
                    {allTopics.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newTopicInput}
                    onChange={(e) => setNewTopicInput(e.target.value)}
                    placeholder="নতুন টপিকের নাম লিখুন"
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50"
                  />
                )}
              </div>
              <div className="flex items-end pb-0.5">
                <button
                  type="button"
                  onClick={() => setIsAddingNewTopic(!isAddingNewTopic)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition"
                >
                  {isAddingNewTopic ? "তালিকা থেকে বাছুন" : "+ নতুন টপিক"}
                </button>
              </div>
            </div>
          </div>
\n`;
    code = code.substring(0, oldFormStart) + newFormContent + code.substring(submitBtnStart);
  }
}

// Add Imports if not exists
if (!code.includes('parseBulkQuestionsText')) {
  code = code.replace(
    'import { BulkQuestionImporterModal } from "./BulkQuestionImporterModal";',
    'import { BulkQuestionImporterModal } from "./BulkQuestionImporterModal";\nimport { parseBulkQuestionsText } from "@/lib/question-parser";\nimport { addBulkQuestionsToExam } from "@/actions/admin-actions";'
  );
}

// Ensure SAMPLE_TEXT is defined
if (!code.includes('const SAMPLE_TEXT =')) {
  const sampleTextDef = `
const SAMPLE_TEXT = "১. বাংলাদেশের রাজধানী কোথায়?\\nক) ঢাকা\\nখ) চট্টগ্রাম\\nগ) রাজশাহী\\nঘ) খুলনা\\nউত্তর: ক\\nব্যাখ্যা: ঢাকা হলো বাংলাদেশের রাজধানী।";
`;
  code = code.replace('export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({', sampleTextDef + '\nexport const QuestionBuilder: React.FC<QuestionBuilderProps> = ({');
}

fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Reapplied UI safely!");
