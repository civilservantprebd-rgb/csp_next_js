export interface CourseVideo {
  id: number;
  course: string;
  subject?: string;
  title: string;
  youtubeId: string;
  description?: string;
  sortOrder: number;
  createdAt?: string;
}
