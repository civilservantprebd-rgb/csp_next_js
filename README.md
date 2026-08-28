# BCS One - Interactive Quiz & Exam Portal (Next.js)

A modern, secure, full-stack Next.js web application for BCS and Job exam preparation.

## 🚀 Key Features

- **Zero Answer-Leak Architecture**: Exam questions and options are served to students without solution keys during active tests. Evaluation happens securely on the server.
- **Synchronized Bangladesh Standard Time**: Immune to client device clock tampering via network time sync (Cloudflare & NTP API fallback).
- **Interactive Quiz Engine**: High-precision countdown timer, large Bengali typography, option locking, auto-submission.
- **Real-Time Leaderboard**: Time-based and score-based ranking with printable PDF layout.
- **Student Performance Portal**: Accuracy %, best score, average score, and comprehensive question-by-question review history.
- **Teacher & Admin Management**:
  - Firebase Authentication (Email/Password & Google Sign-In) + Sub-admin PIN access.
  - Exam creator with live schedule presets.
  - MCQ question builder with explanations.
  - Enrollment request approval with transaction ID verification.
  - Google Drive routine & syllabus links.

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS & Lucide Icons
- **Database & Auth**: Cloud Firestore & Firebase Auth
- **Font**: Hind Siliguri (Google Fonts)

## 📦 How to Run

1. Open this folder in your IDE / Terminal:
   ```bash
   cd C:\Users\User\.gemini\antigravity\scratch\bcs-one-nextjs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.
