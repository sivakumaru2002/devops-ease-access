import type {
  AppUser,
  ApplyPayload,
  ApplyResult,
  ChangePasswordPayload,
  CreateUserPayload,
  CreateFlowPayload,
  Flow,
  FlowTemplate,
  LoginPayload,
  LoginResponse,
  SaveTemplatePayload,
  Snapshot,
  UpdateValuesPayload
} from "../types";

const API_BASE = "http://localhost:8000";
let authToken = "";

function buildHeaders(init?: RequestInit): HeadersInit {
  const baseHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers ? init.headers : {})
  };

  if (authToken) {
    return {
      ...baseHeaders,
      Authorization: `Bearer ${authToken}`
    };
  }

  return baseHeaders;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(init),
    ...init
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  setAuthToken: (token: string) => {
    authToken = token;
  },
  login: (payload: LoginPayload) =>
    request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listUsers: () => request<AppUser[]>("/api/v1/auth/users"),
  createUser: (payload: CreateUserPayload) =>
    request<AppUser>("/api/v1/auth/users", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  changePassword: (payload: ChangePasswordPayload) =>
    request<void>("/api/v1/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listFlows: () => request<Flow[]>("/api/v1/flows"),
  getFlow: (flowId: string) => request<Flow>(`/api/v1/flows/${flowId}`),
  createFlow: (payload: CreateFlowPayload) =>
    request<Flow>("/api/v1/flows/", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateValues: (flowId: string, payload: UpdateValuesPayload) =>
    request<Flow>(`/api/v1/flows/${flowId}/values`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  getSnapshots: (flowId: string) =>
    request<Snapshot[]>(`/api/v1/flows/${flowId}/snapshots`),
  rollback: (flowId: string, snapshotId: string) =>
    request<Flow>(`/api/v1/flows/${flowId}/rollback/${snapshotId}`, {
      method: "POST"
    }),
  apply: (flowId: string, payload: ApplyPayload) =>
    request<ApplyResult>(`/api/v1/flows/${flowId}/apply`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  validateAzureCredentials: () => request<{ valid: boolean; message: string }>("/api/v1/flows/azure/validate", { method: "POST" }),
  listTemplates: () => request<FlowTemplate[]>("/api/v1/templates/"),
  saveTemplate: (payload: SaveTemplatePayload) =>
    request<FlowTemplate>("/api/v1/templates/", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};
