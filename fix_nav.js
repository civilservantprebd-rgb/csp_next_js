const fs = require('fs');
let content = fs.readFileSync('src/components/admin/AdminNav.tsx', 'utf8');

const regex = /\s*\{\s*id:\s*"ai_question_generator"[^\}]+\},?\r?\n/g;
const match = content.match(regex);

if (match) {
  content = content.replace(regex, ''); // remove it from bottom
  content = content.replace(
    /\{\s*id:\s*"analytics"/, 
    match[0].trim() + '\n    { id: "analytics"'
  ); // add it above analytics
  fs.writeFileSync('src/components/admin/AdminNav.tsx', content, 'utf8');
  console.log('Fixed nav order');
} else {
  console.log('Could not find AI tab');
}
