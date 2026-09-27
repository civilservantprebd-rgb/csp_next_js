const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

content = content.replace(
  '<h2 className="text-xl font-bold text-slate-800">AI Question Generator</h2>',
  '<h2 className="text-xl font-bold text-slate-800">Question Generator</h2>'
);

content = content.replace(
  '<p className="text-sm text-slate-500">Auto-generate verified questions using Multi-Agent AI</p>',
  '<p className="text-sm text-slate-500">Auto-generate verified questions</p>'
);

content = content.replace(
  'Start AI Generation',
  'Start Generating'
);

content = content.replace(
  'Topic / Syllabus (For AI Context)',
  'Topic / Syllabus'
);

fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', content, 'utf8');
console.log('Fixed UI texts');
