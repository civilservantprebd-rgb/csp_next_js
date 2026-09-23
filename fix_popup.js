const fs = require("fs");
let c = fs.readFileSync("src/components/modals/ExamDetailPopup.tsx", "utf8");
c = c.replace(/saveMistakesFromSubmission\([\s\S]*?\);/g, `
            let mappedAnswers = submission.answers || [];
            if (mappedAnswers.length > 0 && typeof mappedAnswers[0] === "object" && mappedAnswers[0] !== null && "qid" in mappedAnswers[0]) {
               const answerMap = new Map();
               mappedAnswers.forEach((a: any) => { if (a && a.qid) answerMap.set(a.qid, Number(a.ans)); });
               mappedAnswers = qs.map(q => {
                 const ans = q.id && answerMap.has(q.id) ? answerMap.get(q.id) : null;
                 return (ans === -1 || ans === undefined) ? null : ans;
               });
            }
            saveMistakesFromSubmission(
              submission.studentId,
              submission.examTitle,
              qs,
              bundle.solutions,
              mappedAnswers as (number | null)[],
              bundle.exam.subject || exam?.subject || ""
            );`);
fs.writeFileSync("src/components/modals/ExamDetailPopup.tsx", c);
