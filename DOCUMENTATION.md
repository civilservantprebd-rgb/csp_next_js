# BCS One - System Documentation

## Overview
BCS One is an online examination and learning platform built with **Next.js (App Router)** and **Supabase**. The platform allows students to take live and practice exams, view leaderboards, and read daily news. Teachers can manage exams, questions, and view analytics.

## Tech Stack
* **Frontend:** Next.js 14, React, Tailwind CSS, Lucide Icons
* **Backend/Database:** Supabase (PostgreSQL), Supabase Auth
* **Deployment:** Vercel

## Core Features
1. **Live Exams:** Students can participate in scheduled live exams. Results are hidden until the exam time officially ends.
2. **Practice Exams:** Students can take self-practice exams anytime.
3. **Leaderboard:** Real-time leaderboard generation based on exam submissions. Features automatic recalculation if answer keys are changed.
4. **Mistake Bookmarks:** When students make mistakes, those questions are automatically bookmarked for later review.
5. **Teacher Panel:** A secure admin dashboard to manage courses, exams, questions, and students.
6. **Daily News:** A section for students to read important updates and news.

## Database Schema (Key Tables)

### `exams`
Stores information about an exam.
* `id` (text, PK)
* `course`, `subject`, `title` (text)
* `timer_minutes` (integer)
* `is_free` (boolean)
* `start_time`, `end_time` (timestamptz)
* `is_result_published` (boolean)

### `question_bank`
Stores all questions in the system.
* `id` (uuid, PK)
* `q` (text) - The question text
* `opts` (jsonb) - Array of options
* `correct` (integer) - Index of the correct option
* `exp` (text) - Explanation

### `exam_questions_link`
Links questions from the question bank to a specific exam.
* `exam_id` (text, FK to exams)
* `question_id` (uuid, FK to question_bank)
* `order_index` (integer)

### `submissions`
Stores student exam submissions.
* `id` (uuid, PK)
* `student_name`, `student_id`
* `exam_key`, `exam_title`
* `score`, `correct`, `incorrect`, `total_questions`
* `answers` (jsonb) - Array of student's answers `[{qid, ans}]`
* `is_pending_evaluation`, `is_live_submission`
* `submitted_at` (timestamptz)

## Development Workflow
To maintain the stability of the `main` branch, all new features or experiments should follow this workflow:
1. Create a new branch: `git checkout -b feature-name`
2. Develop and test locally using `npm run dev`.
3. Push the branch to the remote repository.
4. Only merge into `main` when fully stable and tested.
