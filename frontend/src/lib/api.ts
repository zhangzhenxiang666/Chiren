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

export async function deleteResumeSection(id: string): Promise<void> {
  await api.delete('/resume-section/delete', { params: { id } });
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

export interface JdAnalysis {
  id: number;
  resumeId: string;
  overallScore: number;
  atsScore: number;
  summary: string;
  keywordMatches: string[];
  missingKeywords: string[];
  suggestions: any[];
  createdAt: string;
}

export async function fetchJdAnalysisList(resumeId: string): Promise<JdAnalysis[]> {
  const { data } = await api.get<JdAnalysis[]>(`/jd-analysis/list/${resumeId}`);
  return data;
}

export interface CreateSubResumeParams {
  workspaceId: string;
  jobDescription: string;
  title?: string;
  jobTitle?: string;
  template?: string;
  themeConfig?: Record<string, unknown>;
  language?: string;
}

export interface WorkspaceSummary {
  id: string;
  title: string;
  template: string;
  themeConfig: Record<string, unknown>;
  isDefault: boolean;
  language: string;
  createdAt: string;
  updatedAt: string;
  subResumeIds: string[];
}

export async function createSubResume(params: CreateSubResumeParams): Promise<WorkspaceSummary> {
  const { data } = await api.post<WorkspaceSummary>('/resume/sub/create', {
    workspaceId: params.workspaceId,
    jobDescription: params.jobDescription,
    title: params.title || '未命名简历',
    jobTitle: params.jobTitle || null,
    template: params.template || 'classic',
    themeConfig: params.themeConfig || {},
    language: params.language || 'zh',
  });
  return data;
}

export interface CreateSubResumeWithAIParams {
  workspaceId: string;
  jobDescription: string;
  jobTitle?: string;
  template?: string;
  title?: string;
  themeConfig?: Record<string, unknown>;
  language?: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export async function createSubResumeWithAI(params: CreateSubResumeWithAIParams): Promise<TaskIdResponse> {
  const { data } = await api.post<TaskIdResponse>('/resume-assistant/sub-resumes', {
    workspaceId: params.workspaceId,
    jobDescription: params.jobDescription,
    title: params.title || '未命名简历',
    jobTitle: params.jobTitle || '',
    template: params.template || 'classic',
    themeConfig: params.themeConfig || {},
    language: params.language || 'zh',
    type: params.type,
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    model: params.model,
  });
  return data;
}

export async function fetchErrorTasks(): Promise<WorkTask[]> {
  const [parseErrors, jdErrors] = await Promise.all([
    fetchWorkTasks('parse', 'error'),
    fetchWorkTasks('jd_generate', 'error'),
  ]);
  return [...parseErrors, ...jdErrors];
}

export interface RetryTaskParams {
  taskId: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export async function retryTask(params: RetryTaskParams): Promise<TaskIdResponse> {
  const formData = new FormData();
  formData.append('type', params.type);
  formData.append('base_url', params.baseUrl);
  formData.append('api_key', params.apiKey);
  formData.append('model', params.model);
  const { data } = await api.post<TaskIdResponse>(`/parser/retry/${params.taskId}`, formData);
  return data;
}

export interface CreateMatchTaskParams {
  resume_id: string;
  type: ProviderType;
  base_url: string;
  api_key: string;
  model: string;
}

export async function createMatchTask(params: CreateMatchTaskParams): Promise<TaskIdResponse> {
  const { data } = await api.post<TaskIdResponse>('/jd-analysis/match', {
    resume_id: params.resume_id,
    type: params.type,
    base_url: params.base_url,
    api_key: params.api_key,
    model: params.model,
  });
  return data;
}
