export type Step = 'userAuth' | 'homeChoice' | 'dashboardPortal' | 'devopsLogin' | 'projects' | 'dashboard' | 'envApproval';

export type ConnectResponse = {
  session_id: string;
  organization: string;
  project_count: number;
};

export type AuthResponse = {
  auth_token: string;
  email: string;
  username: string;
  is_admin: boolean;
  approved: boolean;
};

export type DevOpsCredentialInfo = {
  organization?: string | null;
  has_pat: boolean;
  updated_at?: string | null;
};

export type DashboardItem = {
  id: string;
  name: string;
  description?: string | null;
  created_by: string;
  created_at: string;
};

export type DashboardResourceItem = {
  id: string;
  dashboard_id: string;
  owner_email: string;
  project: string;
  environment: string;
  name: string;
  url: string;
  resource_type?: string | null;
  notes?: string | null;
};

export type PendingUser = {
  id: string;
  email: string;
  username: string;
};

export type Project = {
  name: string;
};

export type Pipeline = {
  id: number;
  name: string;
  latest_status: string;
  latest_result: string;
};

export type PipelineRun = {
  id: number;
  state?: string;
  result?: string;
  createdDate?: string;
};

export type FailedRun = {
  run_id: number;
  failed_task: string;
  error_message: string;
  timestamp: string;
  logs_summary: string;
};

export type ErrorIntelligenceResponse = {
  status: string;
  ai_summary: string | null;
  failed_runs: FailedRun[];
};

export type Analytics = {
  success_count?: number;
  failure_count?: number;
  build_trend?: Record<string, number>;
  failure_distribution?: Record<string, number>;
  code_push_frequency?: Record<string, number>;
};

export type ResourceItem = {
  id: string;
  organization: string;
  project: string;
  environment: string;
  name: string;
  url: string;
  resource_type?: string | null;
  notes?: string | null;
};

export type PersistedAppState = {
  authToken: string;
  userEmail: string;
  userName: string;
  isAdmin: boolean;
  isApproved: boolean;
  step: Step;
  selectedDashboardId: string;
};

export type LoadingState = {
  appBoot: boolean;
  login: boolean;
  register: boolean;
  dashboards: boolean;
  dashboardResources: boolean;
  createDashboardResource: boolean;
  createDashboard: boolean;
  updateDashboardResource: boolean;
  pendingUsers: boolean;
  devopsCredentials: boolean;
  connectDevops: boolean;
  createResource: boolean;
  modalExplanation: boolean;
  logout: boolean;
  envApprovalTemplates: boolean;
  envApprovalFlows: boolean;
  envApprovalSaveTemplate: boolean;
  envApprovalCreateFlow: boolean;
  envApprovalUpdateValues: boolean;
  envApprovalApplyFlow: boolean;
  envApprovalRollbackFlow: boolean;
};
