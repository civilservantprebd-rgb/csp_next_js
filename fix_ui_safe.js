const fs = require('fs');
let ui = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

const replaceWith = `body: JSON.stringify({
                syllabus: syllabusText,
                ragTopic: topic,
                instructions,
                generatorModel,
                existingTopics: topics,
                count: batchSize,
                existingQuestions: [
                  ...(exams[selectedExamId]?.questions?.map(q => q.q) || []),
                  ...acceptedBatch.map(q => q.q)
                ]
              })`;

ui = ui.replace(/body: JSON\.stringify\(\{\s*syllabus: syllabusText,\s*ragTopic: topic,\s*instructions,\s*generatorModel,\s*existingTopics: topics,\s*count: batchSize\s*\}\)/g, replaceWith);

fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', ui);
console.log("Updated UI!");
