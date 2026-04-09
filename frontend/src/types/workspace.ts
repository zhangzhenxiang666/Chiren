export interface Workspace {
  id: string;
  workspace_id: string | null;
  title: string;
  template: string;
  theme_config: Record<string, unknown>;
  is_default: boolean;
  language: string;
  share_token: string | null;
  is_public: boolean;
  share_password: string | null;
  view_count: number;
  sub_resume_count: number;
  created_at: string;
  updated_at: string;
}
