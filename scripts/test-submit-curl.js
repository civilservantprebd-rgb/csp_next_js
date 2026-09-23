async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/exams/exam_1788910575221/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-student-id": "test-student-123",
        "x-student-name": "Test Student"
      },
      body: JSON.stringify({
        answers: { "q1": "A", "q2": "B" },
        clientSubmittedAtMs: Date.now()
      })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);
  } catch (e) {
    console.error(e);
  }
}
run();
