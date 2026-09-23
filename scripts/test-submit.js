const http = require('http');

async function run() {
  const payload = {
    answers: { "123": "A", "456": "B" },
    clientSubmittedAtMs: Date.now()
  };

  const response = await fetch("http://localhost:3000/api/exams/test-exam/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-student-id": "test-student"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  console.log(response.status, text);
}
run();
