import * as fs from 'fs';

let code = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

const newLogic = `
    const handleStart = async () => {
      if (!selectedExamId || !topic) return;
      
      setIsGenerating(true);
      setProgress(0);
      setVerifiedQuestions([]);
      
      let totalSaved = 0;
      let attempts = 0;
      const MAX_ATTEMPTS = 20; // Increased attempts in case of many duplicates
      
      try {
        while (totalSaved < targetCount && attempts < MAX_ATTEMPTS) {
          attempts++;
          const needed = targetCount - totalSaved;
          const batchSize = Math.min(needed, 10);
          
          setStatusText(\`Generating \${batchSize} drafts with \${generatorModel}...\`);
          const draftRes = await fetch("/api/ai/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              syllabus: topic,
              instructions,
              generatorModel,
              existingTopics: topics,
              count: batchSize
            })
          });
          
          const draftData = await draftRes.json();
          if (draftData.error) {
            console.error("Draft error:", draftData.error);
            setStatusText("Retrying due to model error...");
            continue;
          }
          
          const drafts = draftData.drafts || [];
          if (drafts.length === 0) continue;
          
          setStatusText(\`Checking answers with \${validatorModel1}...\`);
          const val1Res = await fetch("/api/ai/solve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questions: drafts, modelName: validatorModel1 })
          });
          const val1Data = await val1Res.json();
          
          setStatusText(\`Checking answers with \${validatorModel2}...\`);
          const val2Res = await fetch("/api/ai/solve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questions: drafts, modelName: validatorModel2 })
          });
          const val2Data = await val2Res.json();
          
          setStatusText("Comparing models and evaluating consensus...");
          
          const v1Sols = val1Data.solutions || [];
          const v2Sols = val2Data.solutions || [];
          
          let acceptedBatch: FullQuestion[] = [];
          
          // Consensus Check
          for (const d of drafts) {
            const s1 = v1Sols.find((s: any) => s.tempId === d.tempId);
            const s2 = v2Sols.find((s: any) => s.tempId === d.tempId);
            
            if (s1 && s2 && s1.correct === s2.correct) {
              acceptedBatch.push({
                q: d.q,
                opts: d.opts,
                correct: s1.correct,
                exp: s1.exp,
                topic: d.topic
              });
            }
          }
          
          if (acceptedBatch.length > 0) {
            setStatusText("Saving valid questions to database...");
            const newQuestions = acceptedBatch.map(a => ({ q: a.q, opts: a.opts, topic: a.topic }));
            const newSolutions = acceptedBatch.map(a => ({ correct: a.correct, exp: a.exp }));
            const res = await addBulkQuestionsToExam(selectedExamId, newQuestions, newSolutions);
            
            if (res && res.success) {
              totalSaved += res.count; // Only increment by the successfully saved non-duplicate amount
              
              setVerifiedQuestions(prev => [...prev, ...acceptedBatch]); // Just for visual UI, we can show them
              setProgress(Math.floor((totalSaved / targetCount) * 100));
            } else {
              console.error("Save Error:", res);
              setStatusText("Retrying due to save error...");
            }
          }
        }
        
        setStatusText(\`Successfully finished! Saved \${totalSaved} questions. Reloading...\`);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
        
      } catch (err: any) {
        console.error(err);
        setStatusText("Fatal Error: " + err.message);
        setIsGenerating(false);
      }
    };
`;

code = code.replace(/const handleStart = async \(\) => \{[\s\S]*?catch \(err: any\) \{[\s\S]*?setIsGenerating\(false\);\s*\}\s*\};/, newLogic.trim());

fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', code, 'utf8');
console.log("Updated loop logic!");
