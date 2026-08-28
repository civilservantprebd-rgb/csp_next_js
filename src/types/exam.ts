export interface QuestionItem {
  id?: string;
  q: string;
  opts: string[];
}

export interface QuestionSolution {
  correct: number;
  exp: string;
}

export interface FullQuestion extends QuestionItem {
  correct: number;
  exp: string;
}

export interface Exam {
  id: string;
  course: string;
  subject: string;
  title: string;
  timerMinutes: number;
  isFree?: boolean;
  passMark?: number;
  startTime?: string;
  answerReleaseTime?: string;
  leaderboardStartTime?: string;
  leaderboardEndTime?: string;
  questions?: QuestionItem[];
}

export interface SubjectItem {
  name: string;
  course: string;
}

export interface SubAdmin {
  name: string;
  pass: string;
}

export interface AppConfigData {
  courses: string[];
  subjects: SubjectItem[];
  exams: Record<string, Exam>;
  subAdmins?: SubAdmin[];
  teacherPass?: string;
  driveRoutineUrl?: string;
  driveSyllabusUrl?: string;
}
