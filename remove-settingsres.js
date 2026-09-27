const fs = require('fs');

let code = fs.readFileSync('src/actions/admin-actions.ts', 'utf8');
code = code.replace(
  /const \[exams, settingsRes\] = await Promise\.all\(\[\s*fetchExamMetaList\(\),\s*supabase\s*\.from\("app_settings"\)\s*\.select\("drive_routine_url, drive_syllabus_url"\)\s*\.eq\("id", "main"\)\s*\.maybeSingle\(\)\s*\]\);/g,
  'const exams = await fetchExamMetaList();'
);
// In case the previous replace left [exams] = await Promise.all([ fetchExamMetaList(), ...
code = code.replace(
  /const \[exams\] = await Promise\.all\(\[\s*fetchExamMetaList\(\),\s*supabase\s*\.from\("app_settings"\)\s*\.select\("drive_routine_url, drive_syllabus_url"\)\s*\.eq\("id", "main"\)\s*\.maybeSingle\(\)\s*\]\);/g,
  'const exams = await fetchExamMetaList();'
);
fs.writeFileSync('src/actions/admin-actions.ts', code, 'utf8');

let code2 = fs.readFileSync('src/actions/student-actions.ts', 'utf8');
code2 = code2.replace(
  /const \[subs, exams, settingsRes\] = await Promise\.all\(\[\s*getStudentSubmissions\(cleanId\),\s*fetchExamMetaList\(\),\s*supabase\s*\.from\("app_settings"\)\s*\.select\("drive_routine_url, drive_syllabus_url"\)\s*\.eq\("id", "main"\)\s*\.maybeSingle\(\)\s*\]\);/g,
  'const [subs, exams] = await Promise.all([\n      getStudentSubmissions(cleanId),\n      fetchExamMetaList()\n    ]);'
);
fs.writeFileSync('src/actions/student-actions.ts', code2, 'utf8');

console.log('Fixed async calls');
