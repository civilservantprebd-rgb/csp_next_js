const fs = require('fs');

let modal = fs.readFileSync('src/components/admin/BulkQuestionImporterModal.tsx', 'utf8');

const updateState = `        setAiPayload(data.payload);
        setAiWarnings(data.payload.warnings || []);
        
        // Auto-set the topic dropdown from AI extraction
        if (data.payload.topic) {
          let aiFullTopic = data.payload.topic;
          if (data.payload.subtopic) {
            aiFullTopic += " > " + data.payload.subtopic;
          }
          setSelectedTopic(aiFullTopic);
          setAllTopics(prev => prev.includes(aiFullTopic) ? prev : [...prev, aiFullTopic]);
        }`;

if (!modal.includes('// Auto-set the topic dropdown')) {
  modal = modal.replace(/setAiPayload\(data\.payload\);\s*setAiWarnings\(data\.payload\.warnings \|\| \[\]\);/, updateState);
  fs.writeFileSync('src/components/admin/BulkQuestionImporterModal.tsx', modal);
}
