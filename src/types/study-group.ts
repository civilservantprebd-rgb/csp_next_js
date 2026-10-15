export interface StudyGroup {
  id: string;
  course: string;
  name: string;
  inviteCode: string;
  description?: string;
  createdAt: string;
  memberCount?: number;
}

export interface StudyGroupMember {
  id: string;
  groupId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  joinedAt: string;
  courses?: string[];
  totalExamsCount?: number;
  lastActiveDate?: string | null;
}

export interface GroupExamAttendance {
  examKey: string;
  examTitle: string;
  totalMembers: number;
  attendedCount: number;
  missedCount: number;
  attendanceRate: number;
  averageScore: number;
  attendedMembers: {
    studentId: string;
    studentName: string;
    score: number;
    submittedAt?: string;
  }[];
  missedMembers: {
    studentId: string;
    studentName: string;
    email?: string;
  }[];
}
