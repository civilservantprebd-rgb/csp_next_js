const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminNav.tsx', 'utf8');

code = code.replace(
  '{ id: "ai_question_generator", label: "AI Generator", icon: Brain },',
  '{ id: "ai_question_generator", label: "Question Generator", icon: Brain },'
);

fs.writeFileSync('src/components/admin/AdminNav.tsx', code, 'utf8');
console.log("Changed label to Question Generator");
