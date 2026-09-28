const fs = require('fs');
let qbm = fs.readFileSync('src/components/admin/QuestionBankManager.tsx', 'utf8');

// Fix the JSX error matching Windows or Unix newlines
qbm = qbm.replace(/<Sparkles,[\r\n\s]*Star className=/g, '<Sparkles className=');

fs.writeFileSync('src/components/admin/QuestionBankManager.tsx', qbm);
