const fs = require('fs');

function removeRegex(filePath, regexStr) {
  if (fs.existsSync(filePath)) {
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(regexStr, '');
    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function processReplacements(filePath, replacements) {
  if (fs.existsSync(filePath)) {
    let code = fs.readFileSync(filePath, 'utf8');
    for (let r of replacements) {
      code = code.replace(r.target, r.replacement);
    }
    fs.writeFileSync(filePath, code, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// 1. Types
processReplacements('src/types/exam.ts', [
  { target: /driveRoutineUrl\?: string;\s*driveSyllabusUrl\?: string;\s*/, replacement: '' }
]);

// 2. Admin actions
processReplacements('src/actions/admin-actions.ts', [
  { target: /driveRoutineUrl: "https:\/\/drive\.google\.com",\s*driveSyllabusUrl: "https:\/\/drive\.google\.com",\s*/g, replacement: '' },
  { target: /const driveRoutineUrl = settings\.drive_routine_url \|\| DEFAULT_DATA\.driveRoutineUrl;\s*const driveSyllabusUrl = settings\.drive_syllabus_url \|\| DEFAULT_DATA\.driveSyllabusUrl;\s*/g, replacement: '' },
  { target: /driveRoutineUrl,\s*driveSyllabusUrl,\s*/g, replacement: '' },
  { target: /if \(config\.driveRoutineUrl\) updateData\.drive_routine_url = config\.driveRoutineUrl;\s*if \(config\.driveSyllabusUrl\) updateData\.drive_syllabus_url = config\.driveSyllabusUrl;\s*/g, replacement: '' },
  { target: /\/\*\*[\s\S]*?export async function fetchDriveLinks\(\)[\s\S]*?\}\s*\}\s*/g, replacement: '' },
  { target: /driveRoutineUrl: string;\s*driveSyllabusUrl: string;\s*/g, replacement: '' },
  { target: /driveRoutineUrl: settingsRes\?\.data\?\.drive_routine_url \|\| DEFAULT_DATA\.driveRoutineUrl,\s*driveSyllabusUrl: settingsRes\?\.data\?\.drive_syllabus_url \|\| DEFAULT_DATA\.driveSyllabusUrl/g, replacement: '' },
  { target: /driveRoutineUrl: "", driveSyllabusUrl: ""/g, replacement: '' },
  { target: /return \{ exams,  \};\s*\} catch \{/g, replacement: 'return { exams };\n  } catch {' },
  { target: /return \{\s*exams,\s*\}\s*\} catch/g, replacement: 'return { exams };\n    } catch' }
]);

// 3. Student actions
processReplacements('src/actions/student-actions.ts', [
  { target: /driveRoutineUrl: string;\s*driveSyllabusUrl: string;\s*/g, replacement: '' },
  { target: /driveRoutineUrl: settingsRes\?\.data\?\.drive_routine_url \|\| "",\s*driveSyllabusUrl: settingsRes\?\.data\?\.drive_syllabus_url \|\| ""/g, replacement: '' }
]);

// 4. Admin page
processReplacements('src/app/admin/page.tsx', [
  { target: /const \[driveRoutine, setDriveRoutine\] = useState\(""\);\s*const \[driveSyllabus, setDriveSyllabus\] = useState\(""\);\s*/, replacement: '' },
  { target: /setDriveRoutine\(data\.driveRoutineUrl \|\| ""\);\s*setDriveSyllabus\(data\.driveSyllabusUrl \|\| ""\);\s*/, replacement: '' },
  { target: /driveRoutineUrl: driveRoutine\.trim\(\),\s*driveSyllabusUrl: driveSyllabus\.trim\(\),\s*/, replacement: '' }
]);
// Remove the two input divs from admin page
let adminCode = fs.readFileSync('src/app/admin/page.tsx', 'utf8');
const adminInputsRegex = /<div className="grid grid-cols-1 md:grid-cols-2 gap-4">[\s\S]*?value=\{driveSyllabus\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
adminCode = adminCode.replace(adminInputsRegex, '');
fs.writeFileSync('src/app/admin/page.tsx', adminCode, 'utf8');

// 5. PortalClient
processReplacements('src/app/portal/PortalClient.tsx', [
  { target: /initialDriveLinks: \{ driveRoutineUrl: string; driveSyllabusUrl: string \} \| null;\s*/, replacement: '' },
  { target: /const \[routineUrl, setRoutineUrl\] = useState\(initialDriveLinks\?\.driveRoutineUrl \|\| ""\);\s*const \[syllabusUrl, setSyllabusUrl\] = useState\(initialDriveLinks\?\.driveSyllabusUrl \|\| ""\);\s*/, replacement: '' }
]);
let portalCode = fs.readFileSync('src/app/portal/PortalClient.tsx', 'utf8');
// Remove useEffect block for fetchDriveLinks
const portalUseEffect = /if \(!initialDriveLinks\) \{[\s\S]*?\}\s*\}\);\s*\}\s*\}\);/;
portalCode = portalCode.replace(portalUseEffect, '');
// Remove the UI block
const portalUIRegex = /\{\(routineUrl \|\| syllabusUrl\) && \([\s\S]*?Calendar className="w-3\.5 h-3\.5" \/> [^<]*?<\/a>\s*\)\}\s*<\/div>\s*<\/div>\s*\)\}/;
portalCode = portalCode.replace(portalUIRegex, '');
fs.writeFileSync('src/app/portal/PortalClient.tsx', portalCode, 'utf8');

// 6. PortalSectionClient
processReplacements('src/app/portal/[section]/PortalSectionClient.tsx', [
  { target: /initialDriveLinks: \{ driveRoutineUrl: string; driveSyllabusUrl: string \} \| null;\s*/, replacement: '' },
  { target: /,\s*initialDriveLinks/, replacement: '' },
  { target: /driveRoutineUrl: initialData\.driveRoutineUrl,\s*driveSyllabusUrl: initialData\.driveSyllabusUrl,\s*/g, replacement: '' },
  { target: /: initialDriveLinks[\s\S]*?driveRoutineUrl: initialDriveLinks\.driveRoutineUrl,\s*driveSyllabusUrl: initialDriveLinks\.driveSyllabusUrl,[\s\S]*?\}\s*as AppConfigData/, replacement: '' },
  { target: /driveRoutineUrl: data\.driveRoutineUrl,\s*driveSyllabusUrl: data\.driveSyllabusUrl,\s*/g, replacement: '' },
  { target: /driveRoutineUrl: d\.driveRoutineUrl,\s*driveSyllabusUrl: d\.driveSyllabusUrl,\s*/g, replacement: '' },
  { target: /routineUrl=\{config\?\.driveRoutineUrl\}\s*syllabusUrl=\{config\?\.driveSyllabusUrl\}\s*/, replacement: '' }
]);
let pscCode = fs.readFileSync('src/app/portal/[section]/PortalSectionClient.tsx', 'utf8');
// Fix the fetchDriveLinks part
const pscFetchDriveLinks = /if \(!initialDriveLinks\) \{[\s\S]*?fetchDriveLinks\(\)[\s\S]*?as AppConfigData\)[\s\S]*?\)[\s\S]*?\.catch\(\(\) => \{\}\);[\s\S]*?\}/;
pscCode = pscCode.replace(pscFetchDriveLinks, '');
// Fix any trailing null from the initialConfig condition
pscCode = pscCode.replace(/:\s*null\s*\)/g, ')');
fs.writeFileSync('src/app/portal/[section]/PortalSectionClient.tsx', pscCode, 'utf8');

// 7. StudentDashboardModal
processReplacements('src/components/modals/StudentDashboardModal.tsx', [
  { target: /routineUrl\?: string;\s*syllabusUrl\?: string;\s*/, replacement: '' },
  { target: /routineUrl = "https:\/\/drive\.google\.com",\s*syllabusUrl = "https:\/\/drive\.google\.com",\s*/, replacement: '' }
]);

// 8. HomeClient
processReplacements('src/components/home/HomeClient.tsx', [
  { target: /routineUrl=\{config\.driveRoutineUrl\}\s*syllabusUrl=\{config\.driveSyllabusUrl\}\s*/, replacement: '' }
]);

console.log('Done!');
