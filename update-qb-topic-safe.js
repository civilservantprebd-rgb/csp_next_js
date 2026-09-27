const fs = require('fs');

let code = fs.readFileSync('src/components/admin/QuestionBuilder.tsx', 'utf8');

// 1. Prepend topic to textarea in handleEdit
code = code.replace(
  'let text = "১. " + q.q + "\\n";',
  'let text = (q.topic ? "# " + q.topic + "\\n\\n" : "") + "১. " + q.q + "\\n";'
);

// 2. In handleSubmit, allow text-based topic overrides using Unicode escapes to prevent corruption
code = code.replace(
  'topic: activeTopic || "সাধারণ"',
  'topic: first.topic || activeTopic || "\\u09B8\\u09BE\\u09A7\\u09BE\\u09B0\\u09A3"'
);

code = code.replace(
  'const newQs = rest.map(b => ({ q: b.q, opts: b.opts, topic: activeTopic || "সাধারণ" }));',
  'const newQs = rest.map(b => ({ q: b.q, opts: b.opts, topic: b.topic || activeTopic || "\\u09B8\\u09BE\\u09A7\\u09BE\\u09B0\\u09A3" }));'
);

code = code.replace(
  'const newQs = parsedBlocks.map(b => ({ q: b.q, opts: b.opts, topic: activeTopic || "সাধারণ" }));',
  'const newQs = parsedBlocks.map(b => ({ q: b.q, opts: b.opts, topic: b.topic || activeTopic || "\\u09B8\\u09BE\\u09A7\\u09BE\\u09B0\\u09A3" }));'
);

fs.writeFileSync('src/components/admin/QuestionBuilder.tsx', code, 'utf8');
console.log("Updated handleEdit and handleSubmit with topic overrides safely.");
