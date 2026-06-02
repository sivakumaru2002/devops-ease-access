import { API } from './constants';

export type EnvApprovalResourceType = 'webapp' | 'function_app';

export type EnvApprovalKeyValue = {
  key: string;
  value: string;
};

export type EnvApprovalEnvironment = {
  name: string;
  resource_name?: string | null;
  resource_group?: string | null;
  subscription_id?: string | null;
  values: EnvApprovalKeyValue[];
};

export type EnvApprovalTags = {
  release_name: string;
  release_id: string;
};

export type EnvApprovalTemplate = {
  id: string;
  project: string;
  repo: string;
  repo_url?: string | null;
  resource_type: EnvApprovalResourceType;
  environments: EnvApprovalEnvironment[];
  created_at: string;
  updated_at: string;
  updated_by: string;
};

export type EnvApprovalFlow = {
  id: string;
  flow_name: string;
  repo_url: string;
  resource_type: EnvApprovalResourceType;
  resource_name?: string | null;
  resource_group?: string | null;
  subscription_id?: string | null;
  environments: EnvApprovalEnvironment[];
  tags: EnvApprovalTags;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: string;
};

export type EnvApprovalSnapshot = {
  id: string;
  flow_id: string;
  snapshot_type: string;
  environments: EnvApprovalEnvironment[];
  created_at: string;
  created_by: string;
  change_reason?: string | null;
};

export type EnvApprovalApplyResult = {
  flow_id: string;
  status: string;
  message: string;
  applied_at: string;
  applied_envs: string[];
  failed_envs: string[];
};

export type EnvApprovalTemplateForm = {
  project: string;
  repo: string;
  repo_url: string;
  resource_type: EnvApprovalResourceType;
  environments: Array<{
    name: string;
    resource_name: string;
    resource_group: string;
    subscription_id: string;
  }>;
};

export type EnvApprovalCreateForm = {
  flow_name: string;
  repo_url: string;
  resource_type: EnvApprovalResourceType;
  resource_name: string;
  resource_group: string;
  subscription_id: string;
  environments: EnvApprovalEnvironment[];
  tags: EnvApprovalTags;
};

export const INITIAL_ENVS = ['stage', 'preprod', 'prod'];
export const DEFAULT_ENV_KEYS = ['DB_CONNECTION', 'LOG_LEVEL'];

export function buildDefaultEnvironments(initialEnvs = INITIAL_ENVS, defaultKeys = DEFAULT_ENV_KEYS): EnvApprovalEnvironment[] {
  return initialEnvs.map((name) => ({
    name,
    resource_name: '',
    resource_group: '',
    subscription_id: '',
    values: defaultKeys.map((key) => ({ key, value: '' })),
  }));
}

export function buildEnvironmentsFromTemplateConfig(
  templateEnvs: EnvApprovalEnvironment[],
  keys: string[],
): EnvApprovalEnvironment[] {
  return templateEnvs.map((env) => ({
    name: env.name,
    resource_name: env.resource_name ?? '',
    resource_group: env.resource_group ?? '',
    subscription_id: env.subscription_id ?? '',
    values: keys.map((key) => ({ key, value: '' })),
  }));
}

export function buildInitialTemplateForm(): EnvApprovalTemplateForm {
  return {
    project: '',
    repo: '',
    repo_url: '',
    resource_type: 'webapp',
    environments: INITIAL_ENVS.map((name) => ({
      name,
      resource_name: '',
      resource_group: '',
      subscription_id: '',
    })),
  };
}

export function buildInitialCreateForm(): EnvApprovalCreateForm {
  return {
    flow_name: '',
    repo_url: '',
    resource_type: 'webapp',
    resource_name: '',
    resource_group: '',
    subscription_id: '',
    environments: buildDefaultEnvironments(),
    tags: {
      release_name: '',
      release_id: '',
    },
  };
}

type ImportedVariable = {
  key: string;
  value: string;
};

function stringifyImportedValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function stripWrappingQuotes(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseDotEnvVariables(raw: string): ImportedVariable[] {
  const entries: ImportedVariable[] = [];
  for (const sourceLine of raw.split(/\r?\n/)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(normalizedLine.slice(separatorIndex + 1).trim());
    if (key) {
      entries.push({ key, value });
    }
  }

  return entries;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function flattenJsonValue(keyPrefix: string, value: unknown): ImportedVariable[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenJsonValue(`${keyPrefix}__${index}`, item));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([childKey, childValue]) => flattenJsonValue(`${keyPrefix}__${childKey}`, childValue));
  }

  return [{ key: keyPrefix, value: stringifyImportedValue(value) }];
}

function parseJsonVariables(raw: string): ImportedVariable[] {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => {
      if (item && typeof item === 'object' && 'key' in item && 'value' in item && typeof item.key === 'string') {
        return [{ key: item.key, value: stringifyImportedValue(item.value) }];
      }
      return [];
    });
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('JSON import must be an object or an array of { key, value } entries.');
  }

  return Object.entries(parsed).flatMap(([key, value]) => flattenJsonValue(key, value));
}

export function parseImportedVariables(raw: string): ImportedVariable[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  const entries = trimmed.startsWith('{') || trimmed.startsWith('[') ? parseJsonVariables(trimmed) : parseDotEnvVariables(trimmed);
  const merged = new Map<string, string>();
  for (const entry of entries) {
    const key = entry.key.trim();
    if (key) {
      merged.set(key, entry.value);
    }
  }
  return [...merged.entries()].map(([key, value]) => ({ key, value }));
}

export async function loadTextFromFile(file: File): Promise<string> {
  return await file.text();
}

async function request<T>(path: string, authToken: string, init?: RequestInit): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${API}${path}${separator}auth_token=${encodeURIComponent(authToken)}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export const envApprovalApi = {
  listTemplates: (authToken: string) => request<EnvApprovalTemplate[]>('/api/env-approval/templates', authToken),
  saveTemplate: (authToken: string, payload: Omit<EnvApprovalTemplateForm, never>) =>
    request<EnvApprovalTemplate>('/api/env-approval/templates', authToken, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listFlows: (authToken: string) => request<EnvApprovalFlow[]>('/api/env-approval/flows', authToken),
  getFlow: (authToken: string, flowId: string) => request<EnvApprovalFlow>(`/api/env-approval/flows/${flowId}`, authToken),
  createFlow: (authToken: string, payload: EnvApprovalCreateForm) =>
    request<EnvApprovalFlow>('/api/env-approval/flows', authToken, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateValues: (authToken: string, flowId: string, key: string, values: Record<string, string>, updatedBy: string) =>
    request<EnvApprovalFlow>(`/api/env-approval/flows/${flowId}/values`, authToken, {
      method: 'PATCH',
      body: JSON.stringify({ key, values, updated_by: updatedBy }),
    }),
  listSnapshots: (authToken: string, flowId: string) =>
    request<EnvApprovalSnapshot[]>(`/api/env-approval/flows/${flowId}/snapshots`, authToken),
  applyFlow: (authToken: string, flowId: string, environments: string[] | undefined, approvedBy: string, approvalReason?: string) =>
    request<EnvApprovalApplyResult>(`/api/env-approval/flows/${flowId}/apply`, authToken, {
      method: 'POST',
      body: JSON.stringify({ flow_id: flowId, environments, approved_by: approvedBy, approval_reason: approvalReason }),
    }),
  rollbackFlow: (authToken: string, flowId: string, snapshotId: string) =>
    request<EnvApprovalFlow>(`/api/env-approval/flows/${flowId}/rollback/${snapshotId}`, authToken, {
      method: 'POST',
    }),
};