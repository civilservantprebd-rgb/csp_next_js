export interface QuestionItem {
  id?: string;
  q: string;
  opts: string[];
  topic?: string;
  subtopic?: string;
  subject?: string;
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
  endTime?: string;
  isResultPublished?: boolean;
  leaderboardStartTime?: string;
  leaderboardEndTime?: string;
  questions?: QuestionItem[];
}

export interface SubjectItem {
  name: string;
  course: string;
}

export interface TopicItem {
  name: string;
  subject?: string;
  subtopics?: string[];
}

export interface TopicQuestion {
  id: string;
  topic: string;
  subtopic?: string;
  q: string;
  opts: string[];
  correct: number;
  exp: string;
  originalExamTitle?: string;
  originalCourse?: string;
  originalSubject?: string;
  examKey?: string;
  createdAt?: string;
}

export interface SubAdmin {
  name: string;
  pass: string;
}

export interface AppConfigData {
  courses: string[];
  subjects: SubjectItem[];
  topics?: string[];
  topicStructure?: TopicItem[];
  topicQuestions?: TopicQuestion[];
  exams: Record<string, Exam>;
  subAdmins?: SubAdmin[];
  teacherPass?: string;
  driveRoutineUrl?: string;
  driveSyllabusUrl?: string;
}
