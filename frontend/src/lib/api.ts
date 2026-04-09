import axios from 'axios';
import type { Workspace } from '../types/workspace';
import type { WorkTask } from '../types/work';

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
    theme_config: {},
    is_default: false,
    language: 'zh',
  });
  return data;
}

export async function fetchWorkTasks(): Promise<WorkTask[]> {
  const { data } = await api.get<WorkTask[]>('/work/list');
  return data;
}

export async function fetchWorkByStatus(status: string): Promise<WorkTask[]> {
  const { data } = await api.get<WorkTask[]>('/work/list-by-status', {
    params: { status },
  });
  return data;
}

export type ProviderType = 'openai' | 'anthropic';

export interface ProviderConfigItem {
  base_url: string;
  api_key: string;
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
  base_url: string;
  api_key: string;
  model: string;
  template: string;
  title?: string;
}

export interface TaskIdResponse {
  task_id: string;
}

export async function uploadAndParse(file: File, params: UploadParseParams): Promise<TaskIdResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', params.type);
  formData.append('base_url', params.base_url);
  formData.append('api_key', params.api_key);
  formData.append('model', params.model);
  formData.append('template', params.template);
  formData.append('title', params.title || '未命名简历');
  const { data } = await api.post<TaskIdResponse>('/parser', formData);
  return data;
}

