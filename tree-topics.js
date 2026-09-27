const fs = require('fs');

let pageCode = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

// 1. Change the map
pageCode = pageCode.replace(
  '{(config.topics || []).map((topic, idx) => (',
  `{(config.topics || []).map((topic, idx) => ({topic, idx})).sort((a,b) => a.topic.localeCompare(b.topic)).map(({topic, idx}) => {
    const parts = topic.split('>').map(p => p.trim());
    const depth = parts.length - 1;
    const displayName = parts[depth];
    return (`
);

// 2. Add style to li
pageCode = pageCode.replace(
  '<li key={idx} className="p-3 sm:p-4 hover:bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition">',
  '<li key={idx} className="p-3 sm:p-4 hover:bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition border-l-2 border-transparent hover:border-indigo-300" style={{ paddingLeft: `calc(1rem + ${depth * 2}rem)` }}>'
);

// 3. Change the span to show displayName
pageCode = pageCode.replace(
  '<span className="font-medium text-slate-700 text-xs sm:text-sm">{topic}</span>',
  '<span className="font-medium text-slate-700 text-xs sm:text-sm" title={topic}>{depth > 0 && <span className="text-slate-300 mr-1">↳</span>} {displayName}</span>'
);

// 4. Close the map callback properly
pageCode = pageCode.replace(
  /<\/>\s*?}\s*?<\/li>\s*?\)\)}/,
  '</>\n                          )}\n                        </li>\n                      );})} '
);

fs.writeFileSync('src/app/admin/page.tsx', pageCode, 'utf8');
console.log("Updated topics to render as a tree");
