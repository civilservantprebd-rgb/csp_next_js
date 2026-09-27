const fs = require('fs');
let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

// 1. Import
if (!code.includes('import AiQuestionGeneratorUI')) {
  code = code.replace(
    'import { QuestionItem, QuestionSolution } from "@/types/exam";',
    'import { QuestionItem, QuestionSolution } from "@/types/exam";\nimport AiQuestionGeneratorUI from "./AiQuestionGeneratorUI";\nimport { Sparkles } from "lucide-react";'
  );
}

// 2. State
if (!code.includes('const [isAIModalOpen')) {
  code = code.replace(
    'const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);',
    'const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);\n  const [isAIModalOpen, setIsAIModalOpen] = useState(false);'
  );
}

// 3. Button
if (!code.includes('onClick={() => setIsAIModalOpen(true)}')) {
  code = code.replace(
    '<button\n              type="button"\n              onClick={() => setIsBulkModalOpen(true)}',
    `<button
              type="button"
              onClick={() => setIsAIModalOpen(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>AI দিয়ে প্রশ্ন বানান</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}`
  );
  
  // Try CRLF
  code = code.replace(
    '<button\r\n              type="button"\r\n              onClick={() => setIsBulkModalOpen(true)}',
    `<button
              type="button"
              onClick={() => setIsAIModalOpen(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>AI দিয়ে প্রশ্ন বানান</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}`
  );
}

// 4. Modal
if (!code.includes('<AiQuestionGeneratorUI')) {
  code = code.replace(
    '</form>',
    `</form>
      {isAIModalOpen && (
        <AiQuestionGeneratorUI
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          examKey={activeExamKey}
          existingQuestionTexts={(exam.questions || []).map((q) => q.q)}
          topics={topics}
          onSuccess={async () => {
            await loadSolutions();
            onRefresh();
          }}
        />
      )}`
  );
}

fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Restored AiQuestionGeneratorUI to QuestionBuilder");
