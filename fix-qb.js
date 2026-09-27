const fs = require('fs');
let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');
code = code.replace(/import \{ TopicTreeSelector \} from "\.\/TopicTreeSelector";`nimport \{ parseBulkQuestionsText \} from "@\/lib\/question-parser";/, 'import { TopicTreeSelector } from "./TopicTreeSelector";\nimport { parseBulkQuestionsText } from "@/lib/question-parser";');
fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Import fixed.");
