const fs = require('fs');
let route = fs.readFileSync('src/app/api/ai/draft/route.ts', 'utf8');

// The UI passes existingQuestions array.
// In route.ts, it extracts body. 
// const { syllabus, instructions, generatorModel, count, existingTopics, ragTopic } = await req.json();
const replaceDest = `const { syllabus, instructions, generatorModel, count, existingTopics, ragTopic, existingQuestions = [] } = await req.json();`;
route = route.replace(/const \{ syllabus, instructions, generatorModel, count, existingTopics, ragTopic \} = await req\.json\(\);/, replaceDest);

// Further down, we currently have `let existingQuestions: any[] = []; // DB Check removed`
// We need to change that to NOT re-declare it if it's already extracted, or just append to the extracted one.
route = route.replace(/let existingQuestions:\s*any\[\]\s*=\s*\[\];\s*\/\/\s*DB Check removed/g, 'let allExisting = [...existingQuestions];');

// And replace existingQuestions with allExisting in the loop
route = route.replace(/for \(const eq of existingQuestions\)/g, 'for (const eq of allExisting)');
route = route.replace(/existingQuestions\.push\(draft\.q\)/g, 'allExisting.push(draft.q)');

fs.writeFileSync('src/app/api/ai/draft/route.ts', route);
console.log("Updated route!");
