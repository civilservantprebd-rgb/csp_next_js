const fs = require('fs');
let code = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

code = code.replace(
  '</li>\n                      ))}',
  '</li>\n                      );})}'
);
code = code.replace(
  '</li>\r\n                      ))}',
  '</li>\r\n                      );})}'
);
fs.writeFileSync('src/app/admin/page.tsx', code, 'utf8');
console.log("Fixed loop");
