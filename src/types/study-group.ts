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

export interface GroupDailyRanking {
  groupId: string;
  groupName: string;
  course: string;
  totalMembers: number;
  activeCount: number;
  participationRate: number;
  submissionsCount: number;
  liveExamsCount?: number;
  averageScore: number;
  rank: number;
}

export interface GroupPeriodRankingResponse {
  startDate: string;
  endDate: string;
  rankings: GroupDailyRanking[];
  availableLiveExams: { id: string; title: string; course: string }[];
}

export interface AmbassadorApplication {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  photoURL?: string;
  whatsapp?: string;
  university: string;
  session: string;
  reason: string;
  groupId: string;
  groupName: string;
  course: string;
  status: "pending" | "approved";
  appliedAt: string;
  approvedAt?: string;
}

export interface GroupPeriodMemberActivity {
  studentId: string;
  studentName: string;
  examsTakenCount: number;
  liveExamsTakenCount: number;
  averageScore: number;
  lastSubmittedAt?: string;
  submissions: {
    examKey: string;
    examTitle: string;
    score: number;
    submittedAt: string;
    isLive: boolean;
  }[];
}
