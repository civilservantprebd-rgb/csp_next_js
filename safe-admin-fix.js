const fs = require('fs');
let code = fs.readFileSync('src/actions/admin-actions.ts', 'utf8');

// 1. Remove DEFAULT_DATA links
code = code.replace(/driveRoutineUrl: "https:\/\/drive\.google\.com",\s*driveSyllabusUrl: "https:\/\/drive\.google\.com",/g, '');

// 2. Remove settings extraction
code = code.replace(/const driveRoutineUrl = settings\.drive_routine_url \|\| DEFAULT_DATA\.driveRoutineUrl;\s*const driveSyllabusUrl = settings\.drive_syllabus_url \|\| DEFAULT_DATA\.driveSyllabusUrl;/g, '');

// 3. Remove from returned objects (subjects, etc.)
code = code.replace(/driveRoutineUrl,\s*driveSyllabusUrl,/g, '');

// 4. Remove from updateData assignments in saveAppConfig
code = code.replace(/if \(config\.driveRoutineUrl\) updateData\.drive_routine_url = config\.driveRoutineUrl;\s*if \(config\.driveSyllabusUrl\) updateData\.drive_syllabus_url = config\.driveSyllabusUrl;/g, '');

// 5. Remove fetchDriveLinks COMPLETELY (using index/substring to be safe)
const fetchDriveLinksStart = code.indexOf('export async function fetchDriveLinks');
if (fetchDriveLinksStart !== -1) {
  // Find previous JSDoc block start
  const jsdocStart = code.lastIndexOf('/**', fetchDriveLinksStart);
  // Find the end of the function. It ends with catch { return { ... }; }
  const funcRegex = /export async function fetchDriveLinks\(\)[\s\S]*?catch\s*\{[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/;
  const match = code.match(funcRegex);
  if (match) {
    const fullMatch = jsdocStart !== -1 ? code.substring(jsdocStart, fetchDriveLinksStart) + match[0] : match[0];
    code = code.replace(fullMatch, '');
  }
}

// 6. Fix fetchPortalLite return type
code = code.replace(/driveRoutineUrl:\s*string;\s*driveSyllabusUrl:\s*string;/g, '');
code = code.replace(/driveRoutineUrl:\s*settingsRes\?\.data\?\.drive_routine_url\s*\|\|\s*DEFAULT_DATA\.driveRoutineUrl,\s*driveSyllabusUrl:\s*settingsRes\?\.data\?\.drive_syllabus_url\s*\|\|\s*DEFAULT_DATA\.driveSyllabusUrl/g, '');
code = code.replace(/return\s*\{\s*exams,\s*driveRoutineUrl:\s*"",\s*driveSyllabusUrl:\s*""\s*\}/g, 'return { exams }');

// 7. Fix fetchPortalLite settingsRes query
code = code.replace(
  /const \[exams, settingsRes\] = await Promise\.all\(\[\s*fetchExamMetaList\(\),\s*supabase\s*\.from\("app_settings"\)\s*\.select\("drive_routine_url, drive_syllabus_url"\)\s*\.eq\("id", "main"\)\s*\.maybeSingle\(\)\s*\]\);/g,
  'const exams = await fetchExamMetaList();'
);
// Make sure return { exams, } is fixed if it has trailing comma
code = code.replace(/return\s*\{\s*exams,\s*\};\s*\}\s*catch/g, 'return { exams };\n    } catch');

fs.writeFileSync('src/actions/admin-actions.ts', code, 'utf8');
console.log('Fixed admin-actions safely');
