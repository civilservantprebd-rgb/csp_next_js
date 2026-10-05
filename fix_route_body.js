const fs = require('fs');
let route = fs.readFileSync('src/app/api/ai/draft/route.ts', 'utf8');

route = route.replace(/const \{ syllabus, instructions, generatorModel, existingTopics, count = 10, ragTopic \} = body;/, 'const { syllabus, instructions, generatorModel, existingTopics, count = 10, ragTopic, existingQuestions = [] } = body;');

fs.writeFileSync('src/app/api/ai/draft/route.ts', route);
console.log("Updated route correctly!");
