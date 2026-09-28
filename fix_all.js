const fs = require('fs');

let ui = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

if (!ui.includes('setSyllabusText')) {
  ui = ui.replace('const [topic, setTopic] = useState("");', 'const [topic, setTopic] = useState("");\n  const [syllabusText, setSyllabusText] = useState("");');
  
  const newInputs = `<label className="block text-sm font-medium text-slate-700 mb-1">Select Topic (For RAG Matching)</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white mb-4"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                <option value="">Select a Topic...</option>
                {topics.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-slate-700 mb-1">Syllabus / Context</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Paste the detailed syllabus or context here..."
                rows={4}
                value={syllabusText}
                onChange={(e) => setSyllabusText(e.target.value)}
              />`;
              
  const badRegex = /<label className="block text-sm font-medium text-slate-700 mb-1">Topic \/ Syllabus \(Select for RAG matching\)<\/label>[\s\S]*?<\/select>/;
  ui = ui.replace(badRegex, newInputs);
  
  ui = ui.replace('syllabus: topic,', 'syllabus: syllabusText,\n                ragTopic: topic,');
  fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', ui);
  console.log("Fixed UI");
}

let route = fs.readFileSync('src/app/api/ai/draft/route.ts', 'utf8');

if (!route.includes('ragTopic')) {
  route = route.replace('const { syllabus, instructions, generatorModel, existingTopics, count = 10 } = body;', 'const { syllabus, instructions, generatorModel, existingTopics, count = 10, ragTopic } = body;');
}

if (!route.includes('ragReference')) {
  const target = 'const { object } = await generateObject({';
  
  const ragLogic = `
      let ragReference = "";
      try {
        const { data: allMasterQs } = await supabase
          .from("question_bank")
          .select("q, opts")
          .eq("topic", ragTopic || syllabus)
          .eq("is_master", true)
          .limit(100);
          
        if (allMasterQs && allMasterQs.length > 0) {
          const shuffled = allMasterQs.sort(() => 0.5 - Math.random());
          const selectedQs = shuffled.slice(0, 5);
          ragReference = '\\n\\n=== MASTER REFERENCE QUESTIONS ===\\n(Use these to understand the required standard/complexity. DO NOT COPY them):\\n' +
            selectedQs.map((mq, i) => \`Q\${i+1}: \${mq.q}\\nOptions: \${mq.opts.join(" | ")}\`).join("\\n\\n");
        }
      } catch(e) {}
      
      const finalSystemPrompt = systemPrompt + ragReference;
      
      const { object } = await generateObject({`;
      
  route = route.replace(target, ragLogic);
  route = route.replace('system: systemPrompt,', 'system: finalSystemPrompt,');
  
  fs.writeFileSync('src/app/api/ai/draft/route.ts', route);
  console.log("Fixed Route");
}
