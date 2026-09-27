const fs = require('fs');

// 1. Remove from QuestionBuilder.tsx
let qb = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');
qb = qb.replace(
  'import AiQuestionGeneratorUI from "./AiQuestionGeneratorUI";\n',
  ''
);
qb = qb.replace(
  'const [isAIModalOpen, setIsAIModalOpen] = useState(false);\n',
  ''
);
// Remove the button
qb = qb.replace(
  /<button\s+type="button"\s+onClick=\{\(\) => setIsAIModalOpen\(true\)\}[\s\S]*?<\/button>\s*<button\s+type="button"\s+onClick=\{\(\) => setIsBulkModalOpen\(true\)\}/,
  '<button\n              type="button"\n              onClick={() => setIsBulkModalOpen(true)}'
);
// Remove the modal
qb = qb.replace(
  /\{isAIModalOpen && \([\s\S]*?<\/AiQuestionGeneratorUI>[\s\S]*?\)\}/,
  ''
);
fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', qb, 'utf8');

// 2. Add to AdminNav.tsx
let nav = fs.readFileSync('src/components/admin/AdminNav.tsx', 'utf8');
if (!nav.includes('id: "ai_question_generator"')) {
  nav = nav.replace(
    'import {',
    'import { Brain,'
  );
  nav = nav.replace(
    '{ id: "analytics", label: "অ্যানালিটিক্স", icon: BarChart3 },',
    '{ id: "analytics", label: "অ্যানালিটিক্স", icon: BarChart3 },\n      { id: "ai_question_generator", label: "AI Generator", icon: Brain },'
  );
  // Add to type
  nav = nav.replace(
    '| "whatsapp"',
    '| "whatsapp"\n  | "ai_question_generator"'
  );
  fs.writeFileSync('src/components/admin/AdminNav.tsx', nav, 'utf8');
}

// 3. Add to page.tsx
let page = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
if (!page.includes('AiQuestionGeneratorUI')) {
  page = page.replace(
    'import { AdminLogin } from "@/components/admin/AdminLogin";',
    'import { AdminLogin } from "@/components/admin/AdminLogin";\nimport { AiQuestionGeneratorUI } from "@/components/admin/AiQuestionGeneratorUI";'
  );
  page = page.replace(
    '{activeTab === "students" && <StudentApproval courses={config.courses || []} />}',
    '{activeTab === "students" && <StudentApproval courses={config.courses || []} />}\n              {activeTab === "ai_question_generator" && <AiQuestionGeneratorUI exams={config.exams || {}} topics={config.topics || []} />}'
  );
  page = page.replace(
    '"news", "whatsapp"',
    '"news", "whatsapp", "ai_question_generator"'
  );
  fs.writeFileSync('src/app/admin/page.tsx', page, 'utf8');
}

console.log("Restored AI Generator fully");
