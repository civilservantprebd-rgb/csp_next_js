const fs = require('fs');

let route = fs.readFileSync('src/app/api/ai/draft/route.ts', 'utf8');

route = route.replace(/\/\/ TARGETED DB FETCH[\s\S]*?\]\)\.map\(r => r\.q\);\s*\}/, 'let existingQuestions: any[] = []; // DB check removed');

route = route.replace(/if \(!isDuplicate\) \{\s*\/\/ Shuffle options completely/g, 'if (!isDuplicate) {\n        existingQuestions.push(draft.q); // Add to local list to prevent repeats within the same batch\n        // Shuffle options completely');

fs.writeFileSync('src/app/api/ai/draft/route.ts', route);
console.log("Fixed dupes!");
