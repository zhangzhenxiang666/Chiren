export interface SubResume {
  id: string;
  title: string;
  jobTitle?: string;
  matchScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  workspaceId: string | null;
  title: string;
  template: string;
  themeConfig: Record<string, unknown>;
  isDefault: boolean;
  language: string;
  shareToken: string | null;
  isPublic: boolean;
  sharePassword: string | null;
  viewCount: number;
  subResumeIds: string[];
  createdAt: string;
  updatedAt: string;
}
