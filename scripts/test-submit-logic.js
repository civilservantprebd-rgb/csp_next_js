const body = {
  answers: { "q1": "A", "q2": 1, "q3": "c" }
};

let rawAnswers = [];
if (Array.isArray(body?.answers)) {
  rawAnswers = body.answers;
} else if (body?.answers && typeof body.answers === 'object') {
  for (const [key, val] of Object.entries(body.answers)) {
    let numericVal = val;
    if (typeof val === 'string') {
      const up = val.toUpperCase();
      if (up === 'A') numericVal = 0;
      else if (up === 'B') numericVal = 1;
      else if (up === 'C') numericVal = 2;
      else if (up === 'D') numericVal = 3;
      else if (up === 'E') numericVal = 4;
      else numericVal = Number(val);
    }
    rawAnswers.push({ qid: key, ans: numericVal });
  }
}

const answers = rawAnswers.map((v) => {
  if (v === null || v === undefined || v === -1) return null;
  if (typeof v === 'object' && 'qid' in v) {
    return v;
  }
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
});

console.log(JSON.stringify(answers, null, 2));
