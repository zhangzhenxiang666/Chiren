export interface WorkTask {
  id: string;
  fileName: string;
  src: string;
  status: string;
  template: string;
  title: string;
  createdAt: string | null;
  updatedAt: string | null;
}
