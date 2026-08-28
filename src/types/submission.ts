export interface Submission {
  id?: string;
  studentName: string;
  studentId: string;
  examKey: string;
  examTitle: string;
  score: number;
  correct: number;
  incorrect: number;
  totalQuestions: number;
  timeSpent: string;
  answers: (number | null)[];
  isPendingEvaluation?: boolean;
  isLiveSubmission?: boolean;
  timestamp?: any;
  submittedAtISO?: string;
}

export interface LeaderboardItem {
  studentName: string;
  studentId?: string;
  score: number;
  timeSpent: string;
  isPassed: boolean;
  rank: number;
}
