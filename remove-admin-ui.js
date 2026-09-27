const fs = require('fs');
let code = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

code = code.replace(/<div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl mb-6">[\s\S]*?<div className="space-y-1">[\s\S]*?<h3 className="font-bold text-slate-800 text-sm">\+ݦݭ ؅Y ؅ݭ ,ݨ ؅ݪ_, " ݦ \?  \?_  \?Yݨ" ݦ_"<\/h3>[\s\S]*?<\/div>[\s\S]*?<\/div>\s*<\/div>/g, '');

code = code.replace(/<div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl mb-6">[\s\S]*?driveSyllabus[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '');

fs.writeFileSync('src/app/admin/page.tsx', code, 'utf8');
console.log('Fixed admin page');
