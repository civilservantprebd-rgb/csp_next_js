const fs = require('fs');

let content = fs.readFileSync('src/app/api/ai/draft/route.ts', 'utf8');
const regex = /let ragReference = "";[\s\S]*?catch\(e\) \{\}/;

const replacement = `let ragReference = "";
      try {
        const { data: allMasterQs } = await supabase
          .from("question_bank")
          .select("q, opts")
          .eq("topic", syllabus)
          .eq("is_master", true)
          .limit(100);
          
        if (allMasterQs && allMasterQs.length > 0) {
          const shuffled = allMasterQs.sort(() => 0.5 - Math.random());
          const selectedQs = shuffled.slice(0, 5);
          ragReference = '\\n\\n=== MASTER REFERENCE QUESTIONS ===\\n(Use these to understand the required standard/complexity. DO NOT COPY them):\\n' +
            selectedQs.map((mq, i) => \`Q\${i+1}: \${mq.q}\\nOptions: \${mq.opts.join(" | ")}\`).join("\\n\\n");
        }
      } catch(e) {}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/app/api/ai/draft/route.ts', content);

// Also fix QuestionBankManager.tsx syntax
let qbm = fs.readFileSync('src/components/admin/QuestionBankManager.tsx', 'utf8');
const qbmRegex = /<div className="bg-amber-50 p-4[\s\S]*?gap-3">[\s\S]*?<div>/;
if (qbm.includes('div className="bg-amber-50 p-4')) {
    // We can just ensure there's a proper closing brace or check what's missing.
    // Let's just restore QuestionBankManager to HEAD and re-apply correctly.
}
