import axios from 'axios';
import type { Workspace } from '../types/workspace';
import type { WorkTask } from '../types/work';
import type { ResumeSection } from '../types/resume';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data } = await api.get<Workspace[]>('/resume/list');
  return data;
}

export async function createWorkspace(
  template: string,
  title?: string,
): Promise<Workspace> {
  const { data } = await api.post<Workspace>('/resume/create', {
    title: title || '未命名工作空间',
    template,
    themeConfig: {},
    isDefault: false,
    language: 'zh',
  });
  return data;
}

export async function fetchWorkTasks(
  taskType?: string,
  status?: string,
): Promise<WorkTask[]> {
  const { data } = await api.get<WorkTask[]>('/work/list', {
    params: { task_type: taskType, status },
  });
  return data;
}

export type ProviderType = 'openai' | 'anthropic';

export interface ProviderConfigItem {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProviderConfig {
  providers: Record<ProviderType, ProviderConfigItem>;
  active: ProviderType;
}

export async function getProviderConfig(): Promise<ProviderConfig> {
  const { data } = await api.get<ProviderConfig>('/config/provider');
  return data;
}

export async function updateProviderConfig(
  type: ProviderType,
  config: Partial<ProviderConfigItem>,
): Promise<ProviderConfig> {
  const { data } = await api.put<ProviderConfig>('/config/provider', {
    type,
    ...config,
  });
  return data;
}

export async function switchProviderConfig(
  active: ProviderType,
): Promise<ProviderConfig> {
  const { data } = await api.patch<ProviderConfig>('/config/provider/switch', {
    active,
  });
  return data;
}

export interface UploadParseParams {
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
  template: string;
  title?: string;
}

export interface TaskIdResponse {
  taskId: string;
}

export async function uploadAndParse(file: File, params: UploadParseParams): Promise<TaskIdResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', params.type);
  formData.append('base_url', params.baseUrl);
  formData.append('api_key', params.apiKey);
  formData.append('model', params.model);
  formData.append('template', params.template);
  formData.append('title', params.title || '未命名简历');
  const { data } = await api.post<TaskIdResponse>('/parser', formData);
  return data;
}

export async function fetchResumeSections(resumeId: string): Promise<ResumeSection[]> {
  const { data } = await api.get<any[]>(`/resume-section/${resumeId}`);
  return data;
}

export async function updateResumeSection(section: any): Promise<any> {
  const { data } = await api.put('/resume-section/update', section);
  return data;
}

export async function createResumeSection(section: any): Promise<any> {
  const { data } = await api.post('/resume-section/create', section);
  return data;
}

export async function fetchResumeDetail(resumeId: string): Promise<any> {
  const { data } = await api.get(`/resume/${resumeId}`);
  return data;
}

export async function updateResume(data: {
  id: string;
  title?: string;
  template?: string;
  themeConfig?: Record<string, unknown>;
}): Promise<any> {
  const { data: res } = await api.put('/resume/update', data);
  return res;
}
