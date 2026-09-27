import * as fs from 'fs';

let componentCode = fs.readFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', 'utf8');

// Replace the try/catch block around the while loop to handle errors gracefully
componentCode = componentCode.replace(
  /const draftData = await draftRes\.json\(\);\s+if \(draftData\.error\) throw new Error\(draftData\.error\);/g,
  `const draftData = await draftRes.json();
        if (draftData.error) {
          console.error("Draft error:", draftData.error);
          setStatusText("Retrying due to model error...");
          continue;
        }`
);

fs.writeFileSync('src/components/admin/AiQuestionGeneratorUI.tsx', componentCode, 'utf8');
console.log("Updated UI error handling!");
