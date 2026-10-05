const fs = require('fs');

let route = fs.readFileSync('src/app/api/ai/draft/route.ts', 'utf8');

const target = `    // TARGETED DB FETCH: Get existing questions ONLY for the assigned topics
    const assignedTopics = Array.from(new Set(draftQuestions.map(q => q.topic)));
    
    let existingQuestions: any[] = [];
    if (assignedTopics.length > 0) {
      const [qbRes, tqRes] = await Promise.all([
        supabase.from("question_bank").select("q").in("topic", assignedTopics),
        supabase.from("topic_questions").select("q").in("topic", assignedTopics)
      ]);
      
      existingQuestions = [
        ...(qbRes.data || []),
        ...(tqRes.data || [])
      ].map(r => r.q);
    }`;

const replaceWith = `    let existingQuestions: any[] = []; // DB Check removed`;

route = route.replace(target, replaceWith);
// If Windows \r\n issues:
route = route.replace(target.replace(/\n/g, '\r\n'), replaceWith);

fs.writeFileSync('src/app/api/ai/draft/route.ts', route);
console.log("Success");
