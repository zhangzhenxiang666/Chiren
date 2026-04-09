export interface WorkTask {
  id: string;
  file_name: string;
  src: string;
  status: string;
  template: string;
  title: string;
  created_at: string | null;
  updated_at: string | null;
}
