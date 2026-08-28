export interface Student {
  id: string;
  name: string;
  courses?: string[];
  course?: string;
  createdAt?: string;
  approvedAt?: string;
}

export interface AllowedStudent {
  docId?: string;
  id: string;
  name: string;
  courses: string[];
}

export interface EnrollmentRequest {
  docId?: string;
  id: string;
  name: string;
  course: string;
  trxId: string;
  timestamp: string;
}
