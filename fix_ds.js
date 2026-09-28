const fs = require('fs');

let ui = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

ui = ui.replace(/<option value="deepseek-v4-pro">.*?<\/option>/g, '<option value="deepseek-reasoner">DeepSeek R1 (Reasoner)</option>');
ui = ui.replace(/<option value="deepseek-flash">.*?<\/option>/g, '');
ui = ui.replace(/>DeepSeek V3</g, '>DeepSeek V3 (Chat)<');

fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', ui);

let route = fs.readFileSync('src/app/api/ai/draft/route.ts', 'utf8');

// Deepseek R1 does not support JSON format easily, but let's just make sure deepseek uses the right model
// If it's deepseek-chat, it works fine.
fs.writeFileSync('src/app/api/ai/draft/route.ts', route);
