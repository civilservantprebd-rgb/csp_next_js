const fs = require('fs');
let qbm = fs.readFileSync('src/components/admin/QuestionBankManager.tsx', 'utf8');

// Find all indices of 'const toggleMaster ='
const searchStr = 'const toggleMaster =';
const firstIndex = qbm.indexOf(searchStr);
if (firstIndex !== -1) {
  const secondIndex = qbm.indexOf(searchStr, firstIndex + 1);
  if (secondIndex !== -1) {
    // We have a duplicate. We can just delete from the second index until '};'
    // Actually, safer to use regex replacement on the second one.
    // Let's just find the first block and keep it, or remove the second one.
    const beforeSecond = qbm.substring(0, secondIndex);
    const rest = qbm.substring(secondIndex);
    const endOfFunction = rest.indexOf('};') + 2;
    const afterFunction = rest.substring(endOfFunction);
    qbm = beforeSecond + afterFunction;
    fs.writeFileSync('src/components/admin/QuestionBankManager.tsx', qbm);
    console.log('Removed duplicate toggleMaster');
  }
}

