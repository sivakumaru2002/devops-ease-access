import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';

import { ButtonLabel, LoadingMessage } from './components/Loading';
import { API, APP_STATE_STORAGE_KEY } from './constants';
import {
  buildEnvironmentsFromTemplateConfig,
  buildInitialCreateForm,
  buildInitialTemplateForm,
  DEFAULT_ENV_KEYS,
  envApprovalApi,
  INITIAL_ENVS,
  loadTextFromFile,
  parseImportedVariables,
  type EnvApprovalApplyResult,
  type EnvApprovalCreateForm,
  type EnvApprovalFlow,
  type EnvApprovalSnapshot,
  type EnvApprovalTemplate,
  type EnvApprovalTemplateForm,
} from './envApproval';
import { AuthView } from './views/AuthView';
import { DashboardPortalView } from './views/DashboardPortalView';
import { DevOpsLoginView } from './views/DevOpsLoginView';
import { EnvApprovalWorkspaceView } from './views/EnvApprovalWorkspaceView';
import { HomeChoiceView } from './views/HomeChoiceView';
import { ProjectDashboardView } from './views/ProjectDashboardView';
import { ProjectsView } from './views/ProjectsView';
import type {
  Analytics,
  AuthResponse,
  ConnectResponse,
  DashboardItem,
  DashboardResourceItem,
  DevOpsCredentialInfo,
  ErrorIntelligenceResponse,
  LoadingState,
  PendingUser,
  PersistedAppState,
  Pipeline,
  PipelineRun,
  Project,
  Step,
  UserRole,
} from './types';

function resolveUserRole(role: UserRole | null | undefined, isAdmin: boolean): UserRole {
  if (role) {
    return role;
  }

  return isAdmin ? 'admin' : 'tester';
}

function canManageEnvTemplates(role: UserRole | null): boolean {
  return role === 'admin' || role === 'devops';
}

function canManageEnvFlows(role: UserRole | null): boolean {
  return role === 'admin' || role === 'devops';
}

function canApplyEnvFlows(role: UserRole | null): boolean {
  return role === 'admin' || role === 'devops' || role === 'tester';
}

function buildPendingUserRoles(users: PendingUser[], current: Record<string, UserRole>): Record<string, UserRole> {
  const next: Record<string, UserRole> = {};
  for (const user of users) {
    next[user.id] = current[user.id] ?? user.role;
  }
  return next;
}

function App() {
  const [step, setStep] = useState<Step>('userAuth');
  const [status, setStatus] = useState('Sign in to dashboard account.');
  const [loadingState, setLoadingState] = useState<LoadingState>({
    appBoot: true,
    login: false,
    register: false,
    dashboards: false,
    dashboardResources: false,
    createDashboardResource: false,
    createDashboard: false,
    updateDashboardResource: false,
    pendingUsers: false,
    devopsCredentials: false,
    connectDevops: false,
    createResource: false,
    modalExplanation: false,
    logout: false,
    envApprovalTemplates: false,
    envApprovalFlows: false,
    envApprovalSaveTemplate: false,
    envApprovalCreateFlow: false,
    envApprovalUpdateValues: false,
    envApprovalApplyFlow: false,
    envApprovalRollbackFlow: false,
  });

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loginEmailOrUser, setLoginEmailOrUser] = useState('admin@gmail.com');
  const [loginPassword, setLoginPassword] = useState('admin');
  const [showRegister, setShowRegister] = useState(false);
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');

  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingUserRoles, setPendingUserRoles] = useState<Record<string, UserRole>>({});
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');
  const [selectedDashboardId, setSelectedDashboardId] = useState('');
  const [dashboardResources, setDashboardResources] = useState<DashboardResourceItem[]>([]);
  const [portalProject, setPortalProject] = useState('');
  const [portalEnvironment, setPortalEnvironment] = useState('');
  const [portalResourceName, setPortalResourceName] = useState('');
  const [portalResourceUrl, setPortalResourceUrl] = useState('');
  const [portalResourceType, setPortalResourceType] = useState('');
  const [portalResourceNotes, setPortalResourceNotes] = useState('');
  const [editingResourceId, setEditingResourceId] = useState('');
  const [editProject, setEditProject] = useState('');
  const [editEnvironment, setEditEnvironment] = useState('');
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editType, setEditType] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [selectedEnvironmentFilter, setSelectedEnvironmentFilter] = useState('all');
  const [resourceSearchQuery, setResourceSearchQuery] = useState('');

  const [organization, setOrganization] = useState('');
  const [pat, setPat] = useState('');
  const [patConfigured, setPatConfigured] = useState(false);
  const [credUpdatedAt, setCredUpdatedAt] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pipelineRuns, setPipelineRuns] = useState<Record<number, PipelineRun[]>>({});
  const [loadingRunsByPipeline, setLoadingRunsByPipeline] = useState<Record<number, boolean>>({});

  const [envTemplates, setEnvTemplates] = useState<EnvApprovalTemplate[]>([]);
  const [envFlows, setEnvFlows] = useState<EnvApprovalFlow[]>([]);
  const [envSelectedFlowId, setEnvSelectedFlowId] = useState('');
  const [envSelectedFlow, setEnvSelectedFlow] = useState<EnvApprovalFlow | null>(null);
  const [envSnapshots, setEnvSnapshots] = useState<EnvApprovalSnapshot[]>([]);
  const [envApplyResult, setEnvApplyResult] = useState<EnvApprovalApplyResult | null>(null);
  const [envTemplateForm, setEnvTemplateForm] = useState<EnvApprovalTemplateForm>(buildInitialTemplateForm());
  const [envNewTemplateEnvName, setEnvNewTemplateEnvName] = useState('');
  const [envCreateForm, setEnvCreateForm] = useState<EnvApprovalCreateForm>(buildInitialCreateForm());
  const [envCreateKeys, setEnvCreateKeys] = useState<string[]>(DEFAULT_ENV_KEYS);
  const [envTemplateProject, setEnvTemplateProject] = useState('');
  const [envTemplateRepo, setEnvTemplateRepo] = useState('');
  const [envNewCreateEnvName, setEnvNewCreateEnvName] = useState('');
  const [envNewCreateKeyName, setEnvNewCreateKeyName] = useState('');
  const [envCreateImportEnv, setEnvCreateImportEnv] = useState(INITIAL_ENVS[0]);
  const [envCreateImportText, setEnvCreateImportText] = useState('');
  const [envUpdateKey, setEnvUpdateKey] = useState(DEFAULT_ENV_KEYS[0]);
  const [envEditValues, setEnvEditValues] = useState<Record<string, string>>({});
  const [envUpdateBy, setEnvUpdateBy] = useState('');
  const [envApprovalBy, setEnvApprovalBy] = useState('');
  const [envEditImportEnv, setEnvEditImportEnv] = useState(INITIAL_ENVS[0]);
  const [envEditImportText, setEnvEditImportText] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Failure Explanation');
  const [modalErrorText, setModalErrorText] = useState('');
  const [modalExplanationText, setModalExplanationText] = useState('');
  const [expandedResourceIds, setExpandedResourceIds] = useState<Set<string>>(new Set());
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [explainingRunId, setExplainingRunId] = useState<number | null>(null);

  const updateLoading = (key: keyof LoadingState, value: boolean) => {
    setLoadingState((previous) => ({ ...previous, [key]: value }));
  };

  const effectiveUserRole = resolveUserRole(userRole, isAdmin);
  const canManageTemplates = canManageEnvTemplates(effectiveUserRole);
  const canManageFlows = canManageEnvFlows(effectiveUserRole);
  const canApplyFlows = canApplyEnvFlows(effectiveUserRole);

  useEffect(() => {
    const savedState = localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!savedState) {
      updateLoading('appBoot', false);
      return;
    }

    try {
      const restored = JSON.parse(savedState) as PersistedAppState;
      const safeStep = restored.step === 'projects' || restored.step === 'dashboard' ? 'homeChoice' : restored.step;
      setAuthToken(restored.authToken);
      setUserEmail(restored.userEmail);
      setUserName(restored.userName);
      setUserRole(resolveUserRole(restored.userRole, restored.isAdmin));
      setIsAdmin(restored.isAdmin);
      setIsApproved(restored.isApproved);
      setSelectedDashboardId(restored.selectedDashboardId);
      setStep(restored.isApproved ? safeStep : 'userAuth');
      setStatus(restored.isApproved ? `Welcome back ${restored.userName}.` : 'Your account is waiting for admin approval.');
    } catch {
      localStorage.removeItem(APP_STATE_STORAGE_KEY);
    } finally {
      updateLoading('appBoot', false);
    }
  }, []);

  useEffect(() => {
    if (!authToken) {
      localStorage.removeItem(APP_STATE_STORAGE_KEY);
      return;
    }

    const safeStep = step === 'projects' || step === 'dashboard' ? 'homeChoice' : step;
    const nextState: PersistedAppState = {
      authToken,
      userEmail,
      userName,
      userRole,
      isAdmin,
      isApproved,
      step: safeStep,
      selectedDashboardId,
    };
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(nextState));
  }, [authToken, userEmail, userName, userRole, isAdmin, isApproved, step, selectedDashboardId]);

  const toggleResourceExpansion = (id: string) => {
    setExpandedResourceIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(projectSearch.toLowerCase())),
    [projects, projectSearch],
  );

  useEffect(() => {
    if (!userName) {
      return;
    }

    setEnvUpdateBy((previous) => previous || userName);
    setEnvApprovalBy((previous) => previous || userName);
  }, [userName]);

  useEffect(() => {
    const envNames = envCreateForm.environments.map((environment) => environment.name);
    if (!envNames.includes(envCreateImportEnv)) {
      setEnvCreateImportEnv(envNames[0] ?? '');
    }
  }, [envCreateForm.environments, envCreateImportEnv]);

  useEffect(() => {
    if (!envSelectedFlow) {
      setEnvEditValues({});
      return;
    }

    const nextValues: Record<string, string> = {};
    for (const environment of envSelectedFlow.environments) {
      const found = environment.values.find((entry) => entry.key === envUpdateKey);
      nextValues[environment.name] = found?.value ?? '';
    }
    setEnvEditValues(nextValues);
    setEnvEditImportEnv((previous) => {
      if (previous && envSelectedFlow.environments.some((environment) => environment.name === previous)) {
        return previous;
      }
      return envSelectedFlow.environments[0]?.name ?? '';
    });
  }, [envSelectedFlow, envUpdateKey]);

  const loadEnvApprovalTemplates = async (token = authToken) => {
    if (!token) {
      return;
    }

    updateLoading('envApprovalTemplates', true);
    try {
      const templates = await envApprovalApi.listTemplates(token);
      setEnvTemplates(templates);
    } catch {
      setStatus('Unable to load env approval templates.');
    } finally {
      updateLoading('envApprovalTemplates', false);
    }
  };

  const loadEnvApprovalFlowDetails = async (flowId: string, token = authToken) => {
    if (!token || !flowId) {
      setEnvSelectedFlow(null);
      setEnvSnapshots([]);
      return;
    }

    updateLoading('envApprovalFlows', true);
    try {
      const [flow, snapshots] = await Promise.all([
        envApprovalApi.getFlow(token, flowId),
        envApprovalApi.listSnapshots(token, flowId),
      ]);
      setEnvSelectedFlow(flow);
      setEnvSnapshots(snapshots);
    } catch {
      setStatus('Unable to load env approval flow details.');
    } finally {
      updateLoading('envApprovalFlows', false);
    }
  };

  const loadEnvApprovalFlows = async (token = authToken, preferredFlowId = envSelectedFlowId) => {
    if (!token) {
      return;
    }

    updateLoading('envApprovalFlows', true);
    try {
      const flows = await envApprovalApi.listFlows(token);
      setEnvFlows(flows);

      if (!flows.length) {
        setEnvSelectedFlowId('');
        setEnvSelectedFlow(null);
        setEnvSnapshots([]);
        return;
      }

      const nextFlowId = flows.some((flow) => flow.id === preferredFlowId) ? preferredFlowId : flows[0].id;
      setEnvSelectedFlowId(nextFlowId);
      const [flow, snapshots] = await Promise.all([
        envApprovalApi.getFlow(token, nextFlowId),
        envApprovalApi.listSnapshots(token, nextFlowId),
      ]);
      setEnvSelectedFlow(flow);
      setEnvSnapshots(snapshots);
    } catch {
      setStatus('Unable to load env approval flows.');
    } finally {
      updateLoading('envApprovalFlows', false);
    }
  };

  const openEnvApprovalWorkspace = async () => {
    if (!authToken) {
      return;
    }

    setStep('envApproval');
    setStatus('Loading env approval flow workspace...');
    await Promise.all([loadEnvApprovalTemplates(authToken), loadEnvApprovalFlows(authToken)]);
    setStatus('Env approval flow workspace ready.');
  };

  const saveEnvApprovalTemplate = async () => {
    if (!authToken) {
      return;
    }
    if (!canManageTemplates) {
      setStatus('Only admin and DevOps users can save env approval templates.');
      return;
    }

    const isExistingTemplate = envTemplates.some(
      (template) => template.project === envTemplateForm.project.trim() && template.repo === envTemplateForm.repo.trim(),
    );

    updateLoading('envApprovalSaveTemplate', true);
    try {
      await envApprovalApi.saveTemplate(authToken, envTemplateForm);
      await loadEnvApprovalTemplates(authToken);
      setStatus(isExistingTemplate ? 'Env approval template updated.' : 'Env approval template saved.');
    } catch {
      setStatus('Unable to save env approval template.');
    } finally {
      updateLoading('envApprovalSaveTemplate', false);
    }
  };

  const editEnvApprovalTemplate = (template: EnvApprovalTemplate) => {
    setEnvTemplateForm({
      project: template.project,
      repo: template.repo,
      repo_url: template.repo_url ?? '',
      resource_type: template.resource_type,
      environments: template.environments.map((environment) => ({
        name: environment.name,
        resource_name: environment.resource_name ?? '',
        resource_group: environment.resource_group ?? '',
        subscription_id: environment.subscription_id ?? '',
      })),
    });
    setEnvNewTemplateEnvName('');
    setStatus(`Editing template ${template.project} / ${template.repo}. Save to update it.`);
  };

  const resetEnvApprovalTemplateForm = () => {
    setEnvTemplateForm(buildInitialTemplateForm());
    setEnvNewTemplateEnvName('');
    setStatus('Template editor reset.');
  };

  const addEnvTemplateEnvironment = () => {
    const name = envNewTemplateEnvName.trim();
    if (!name) {
      return;
    }

    setEnvTemplateForm((previous) => {
      if (previous.environments.some((environment) => environment.name.toLowerCase() === name.toLowerCase())) {
        return previous;
      }
      return {
        ...previous,
        environments: [...previous.environments, { name, resource_name: '', resource_group: '', subscription_id: '' }],
      };
    });
    setEnvNewTemplateEnvName('');
  };

  const removeEnvTemplateEnvironment = (envName: string) => {
    setEnvTemplateForm((previous) => ({
      ...previous,
      environments: previous.environments.filter((environment) => environment.name !== envName),
    }));
  };

  const applySelectedEnvTemplate = () => {
    const selectedTemplate = envTemplates.find(
      (template) => template.project === envTemplateProject && template.repo === envTemplateRepo,
    );
    if (!selectedTemplate) {
      setStatus('Select a project and repo template first.');
      return;
    }

    const currentKeys = envCreateKeys.length ? envCreateKeys : DEFAULT_ENV_KEYS;
    setEnvCreateForm((previous) => ({
      ...previous,
      repo_url: selectedTemplate.repo_url ?? previous.repo_url,
      resource_type: selectedTemplate.resource_type,
      environments: buildEnvironmentsFromTemplateConfig(selectedTemplate.environments, currentKeys),
    }));
    setStatus(`Applied template ${selectedTemplate.project} / ${selectedTemplate.repo}.`);
  };

  const addEnvCreateEnvironment = () => {
    const name = envNewCreateEnvName.trim();
    if (!name) {
      return;
    }

    setEnvCreateForm((previous) => {
      if (previous.environments.some((environment) => environment.name.toLowerCase() === name.toLowerCase())) {
        return previous;
      }
      return {
        ...previous,
        environments: [
          ...previous.environments,
          {
            name,
            resource_name: '',
            resource_group: '',
            subscription_id: '',
            values: envCreateKeys.map((key) => ({ key, value: '' })),
          },
        ],
      };
    });
    setEnvNewCreateEnvName('');
  };

  const removeEnvCreateEnvironment = (envName: string) => {
    setEnvCreateForm((previous) => ({
      ...previous,
      environments: previous.environments.filter((environment) => environment.name !== envName),
    }));
  };

  const addEnvCreateKeyRow = () => {
    const keyName = envNewCreateKeyName.trim();
    if (!keyName) {
      setStatus('Enter a key name before adding a new row.');
      return;
    }
    if (envCreateKeys.includes(keyName)) {
      setStatus('That key already exists in the flow draft.');
      return;
    }

    setEnvCreateKeys((previous) => [...previous, keyName]);
    setEnvCreateForm((previous) => ({
      ...previous,
      environments: previous.environments.map((environment) => ({
        ...environment,
        values: [...environment.values, { key: keyName, value: '' }],
      })),
    }));
    setEnvNewCreateKeyName('');
  };

  const removeEnvCreateKeyRow = (key: string) => {
    setEnvCreateKeys((previous) => previous.filter((item) => item !== key));
    setEnvCreateForm((previous) => ({
      ...previous,
      environments: previous.environments.map((environment) => ({
        ...environment,
        values: environment.values.filter((entry) => entry.key !== key),
      })),
    }));
  };

  const setEnvCreateValue = (envName: string, key: string, value: string) => {
    setEnvCreateForm((previous) => ({
      ...previous,
      environments: previous.environments.map((environment) => {
        if (environment.name !== envName) {
          return environment;
        }

        const existing = environment.values.some((entry) => entry.key === key);
        return {
          ...environment,
          values: existing
            ? environment.values.map((entry) => (entry.key === key ? { ...entry, value } : entry))
            : [...environment.values, { key, value }],
        };
      }),
    }));
  };

  const applyImportedCreateVariables = (raw: string) => {
    const entries = parseImportedVariables(raw);
    if (!entries.length || !envCreateImportEnv) {
      return;
    }

    const newKeys = entries.map((entry) => entry.key).filter((key) => !envCreateKeys.includes(key));
    if (newKeys.length) {
      setEnvCreateKeys((previous) => [...previous, ...newKeys]);
    }

    setEnvCreateForm((previous) => ({
      ...previous,
      environments: previous.environments.map((environment) => {
        const keys = new Set(environment.values.map((entry) => entry.key));
        let values = [...environment.values];

        for (const key of newKeys) {
          if (!keys.has(key)) {
            values = [...values, { key, value: '' }];
          }
        }

        if (environment.name === envCreateImportEnv) {
          for (const entry of entries) {
            if (values.some((item) => item.key === entry.key)) {
              values = values.map((item) => (item.key === entry.key ? entry : item));
            } else {
              values = [...values, entry];
            }
          }
        }

        return { ...environment, values };
      }),
    }));
  };

  const handleEnvCreateFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await loadTextFromFile(file);
    setEnvCreateImportText(text);
    applyImportedCreateVariables(text);
    event.target.value = '';
  };

  const createEnvApprovalFlow = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken) {
      return;
    }
    if (!canManageFlows) {
      setStatus('Only admin and devops users can create env approval flows.');
      return;
    }

    updateLoading('envApprovalCreateFlow', true);
    try {
      const created = await envApprovalApi.createFlow(authToken, envCreateForm);
      setEnvCreateForm(buildInitialCreateForm());
      setEnvCreateKeys(DEFAULT_ENV_KEYS);
      setEnvNewCreateEnvName('');
      setEnvNewCreateKeyName('');
      setEnvCreateImportText('');
      setEnvSelectedFlowId(created.id);
      await loadEnvApprovalFlows(authToken, created.id);
      setStatus('Env approval flow created.');
    } catch {
      setStatus('Unable to create env approval flow.');
    } finally {
      updateLoading('envApprovalCreateFlow', false);
    }
  };

  const handleEnvFlowSelection = async (flowId: string) => {
    setEnvSelectedFlowId(flowId);
    setEnvApplyResult(null);
    await loadEnvApprovalFlowDetails(flowId);
  };

  const applyImportedEditValue = (raw: string) => {
    const entries = parseImportedVariables(raw);
    if (!entries.length) {
      return;
    }

    if (entries.length > 1) {
      setStatus('Bulk edit import is limited to one key at a time in the integrated workspace.');
      return;
    }

    const [entry] = entries;
    setEnvUpdateKey(entry.key);
    if (envEditImportEnv) {
      setEnvEditValues((previous) => ({ ...previous, [envEditImportEnv]: entry.value }));
    }
  };

  const handleEnvEditFileImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await loadTextFromFile(file);
    setEnvEditImportText(text);
    applyImportedEditValue(text);
    event.target.value = '';
  };

  const submitEnvApprovalValueUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken || !envSelectedFlowId) {
      return;
    }
    if (!canManageFlows) {
      setStatus('Only admin and devops users can update env approval values.');
      return;
    }

    updateLoading('envApprovalUpdateValues', true);
    try {
      const updated = await envApprovalApi.updateValues(authToken, envSelectedFlowId, envUpdateKey, envEditValues, envUpdateBy || userName);
      setEnvSelectedFlow(updated);
      setEnvFlows((previous) => previous.map((flow) => (flow.id === updated.id ? updated : flow)));
      setEnvSnapshots(await envApprovalApi.listSnapshots(authToken, envSelectedFlowId));
      setStatus('Env approval flow values updated.');
    } catch {
      setStatus('Unable to update env approval values.');
    } finally {
      updateLoading('envApprovalUpdateValues', false);
    }
  };

  const applyEnvApprovalFlow = async (environmentName?: string) => {
    if (!authToken || !envSelectedFlowId) {
      return;
    }
    if (!canApplyFlows) {
      setStatus('A valid env approval role is required to apply flows.');
      return;
    }

    updateLoading('envApprovalApplyFlow', true);
    try {
      const result = await envApprovalApi.applyFlow(
        authToken,
        envSelectedFlowId,
        environmentName ? [environmentName] : undefined,
        envApprovalBy || userName,
        environmentName ? `Approved ${environmentName} rollout` : 'Approved all environment rollouts',
      );
      setEnvApplyResult(result);
      setStatus(result.message);
    } catch {
      setStatus('Unable to apply env approval flow.');
    } finally {
      updateLoading('envApprovalApplyFlow', false);
    }
  };

  const rollbackEnvApprovalFlow = async (snapshotId: string) => {
    if (!authToken || !envSelectedFlowId) {
      return;
    }
    if (!canManageFlows) {
      setStatus('Only admin and devops users can run rollback.');
      return;
    }

    updateLoading('envApprovalRollbackFlow', true);
    try {
      const updated = await envApprovalApi.rollbackFlow(authToken, envSelectedFlowId, snapshotId);
      setEnvSelectedFlow(updated);
      setEnvFlows((previous) => previous.map((flow) => (flow.id === updated.id ? updated : flow)));
      setEnvSnapshots(await envApprovalApi.listSnapshots(authToken, envSelectedFlowId));
      setStatus('Env approval flow rolled back to the selected snapshot.');
    } catch {
      setStatus('Unable to rollback env approval flow.');
    } finally {
      updateLoading('envApprovalRollbackFlow', false);
    }
  };

  const loadDashboardResources = async (dashboardId = selectedDashboardId, token = authToken) => {
    if (!token || !dashboardId) {
      setDashboardResources([]);
      return;
    }

    updateLoading('dashboardResources', true);
    try {
      const response = await fetch(`${API}/api/dashboards/${dashboardId}/resources?auth_token=${token}`);
      if (!response.ok) {
        setDashboardResources([]);
        setStatus('Unable to load resource cards for this dashboard.');
        return;
      }
      setDashboardResources((await response.json()) as DashboardResourceItem[]);
    } finally {
      updateLoading('dashboardResources', false);
    }
  };

  const loadDashboards = async (token = authToken) => {
    if (!token) {
      return;
    }

    updateLoading('dashboards', true);
    const response = await fetch(`${API}/api/dashboards?auth_token=${token}`);
    try {
      if (!response.ok) {
        setStatus('Unable to load dashboards.');
        return;
      }

      const items = (await response.json()) as DashboardItem[];
      setDashboards(items);

      if (items.length === 0) {
        setSelectedDashboardId('');
        setDashboardResources([]);
        return;
      }

      const stillExists = items.some((item) => item.id === selectedDashboardId);
      const nextDashboardId = stillExists ? selectedDashboardId : items[0].id;
      setSelectedDashboardId(nextDashboardId);
      await loadDashboardResources(nextDashboardId, token);
    } finally {
      updateLoading('dashboards', false);
    }
  };

  const loadPendingUsers = async (token = authToken) => {
    if (!token) {
      return;
    }

    updateLoading('pendingUsers', true);
    try {
      const response = await fetch(`${API}/api/admin/pending-users?auth_token=${token}`);
      if (response.ok) {
        const items = (await response.json()) as PendingUser[];
        setPendingUsers(items);
        setPendingUserRoles((previous) => buildPendingUserRoles(items, previous));
      }
    } finally {
      updateLoading('pendingUsers', false);
    }
  };

  useEffect(() => {
    if (!authToken || !isApproved) {
      return;
    }

    void loadDashboards(authToken);
    void loadDevopsCredentials(authToken);
    if (isAdmin) {
      void loadPendingUsers(authToken);
    }
  }, [authToken, isApproved, isAdmin]);

  const createDashboardResource = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken || !selectedDashboardId) {
      return;
    }

    updateLoading('createDashboardResource', true);
    try {
      const response = await fetch(`${API}/api/dashboards/${selectedDashboardId}/resources?auth_token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: portalProject,
          environment: portalEnvironment,
          name: portalResourceName,
          url: portalResourceUrl,
          resource_type: portalResourceType || undefined,
          notes: portalResourceNotes || undefined,
        }),
      });
      if (!response.ok) {
        setStatus('Failed to add dashboard resource card. Check dashboard selection and required fields.');
        return;
      }
      setPortalProject('');
      setPortalEnvironment('');
      setPortalResourceName('');
      setPortalResourceUrl('');
      setPortalResourceType('');
      setPortalResourceNotes('');
      await loadDashboardResources(selectedDashboardId);
      setStatus('Resource card added to dashboard.');
    } finally {
      updateLoading('createDashboardResource', false);
    }
  };

  const loadDevopsCredentials = async (token = authToken) => {
    if (!token) {
      return;
    }

    updateLoading('devopsCredentials', true);
    try {
      const response = await fetch(`${API}/api/devops/credentials?auth_token=${token}`);
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as DevOpsCredentialInfo;
      setOrganization(payload.organization ?? '');
      setPatConfigured(payload.has_pat);
      setCredUpdatedAt(payload.updated_at ?? null);
    } finally {
      updateLoading('devopsCredentials', false);
    }
  };

  const loginDashboardUser = async (event: FormEvent) => {
    event.preventDefault();
    updateLoading('login', true);
    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_or_username: loginEmailOrUser, password: loginPassword }),
      });
      if (!response.ok) {
        setStatus('❌ Login failed. Please check your credentials.');
        return;
      }
      const payload = (await response.json()) as AuthResponse;
      setAuthToken(payload.auth_token);
      setUserEmail(payload.email);
      setUserName(payload.username);
      setUserRole(payload.role);
      setIsAdmin(payload.is_admin);
      setIsApproved(payload.approved);
      if (!payload.approved) {
        setStatus('⏳ Your account is waiting for admin approval.');
        return;
      }
      await loadDashboards(payload.auth_token);
      if (payload.is_admin) {
        await loadPendingUsers(payload.auth_token);
      }
      setStatus(`✅ Welcome ${payload.username} (${payload.role})! Choose Dashboard, DevOps, or Env Approval Flow.`);
      setStep('homeChoice');
    } catch {
      setStatus('❌ Network error during login.');
    } finally {
      updateLoading('login', false);
    }
  };

  const registerDashboardUser = async (event: FormEvent) => {
    event.preventDefault();

    if (registerPassword !== registerConfirmPassword) {
      setStatus('❌ Passwords do not match.');
      return;
    }

    if (registerPassword.length < 4) {
      setStatus('❌ Password must be at least 4 characters.');
      return;
    }

    updateLoading('register', true);
    try {
      const response = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerEmail,
          username: registerUsername,
          password: registerPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Registration failed' }));
        setStatus(`❌ ${errorData.detail || 'Registration failed. Email or username may already exist.'}`);
        return;
      }

      setStatus('✅ Registration successful! Your account is pending admin approval. You can try logging in once approved.');
      setRegisterEmail('');
      setRegisterUsername('');
      setRegisterPassword('');
      setRegisterConfirmPassword('');
      setShowRegister(false);
    } catch {
      setStatus('❌ Network error during registration.');
    } finally {
      updateLoading('register', false);
    }
  };

  const createDashboard = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken) {
      return;
    }

    updateLoading('createDashboard', true);
    try {
      const response = await fetch(`${API}/api/dashboards?auth_token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dashboardName, description: dashboardDescription }),
      });
      if (!response.ok) {
        setStatus('Only admin can create dashboards.');
        return;
      }
      setDashboardName('');
      setDashboardDescription('');
      await loadDashboards();
      setStatus('Dashboard created.');
    } finally {
      updateLoading('createDashboard', false);
    }
  };

  const approveUser = async (userId: string, role: UserRole) => {
    if (!authToken) {
      return;
    }

    setApprovingUserId(userId);
    try {
      await fetch(`${API}/api/admin/users/${userId}/approve?auth_token=${authToken}&role=${encodeURIComponent(role)}`, { method: 'POST' });
      await loadPendingUsers();
      setStatus(`User approved with ${role} role.`);
    } finally {
      setApprovingUserId(null);
    }
  };

  const startEditResource = (resource: DashboardResourceItem) => {
    setEditingResourceId(resource.id);
    setEditProject(resource.project);
    setEditEnvironment(resource.environment);
    setEditName(resource.name);
    setEditUrl(resource.url);
    setEditType(resource.resource_type ?? '');
    setEditNotes(resource.notes ?? '');
  };

  const cancelEditResource = () => {
    setEditingResourceId('');
    setEditProject('');
    setEditEnvironment('');
    setEditName('');
    setEditUrl('');
    setEditType('');
    setEditNotes('');
  };

  const updateDashboardResource = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken || !selectedDashboardId || !editingResourceId) {
      return;
    }

    updateLoading('updateDashboardResource', true);
    try {
      const response = await fetch(
        `${API}/api/dashboards/${selectedDashboardId}/resources/${editingResourceId}?auth_token=${authToken}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: editProject,
            environment: editEnvironment,
            name: editName,
            url: editUrl,
            resource_type: editType || undefined,
            notes: editNotes || undefined,
          }),
        },
      );

      if (!response.ok) {
        setStatus('Unable to update resource card. Admin or owner access is required.');
        return;
      }

      await loadDashboardResources(selectedDashboardId);
      setStatus('Resource card updated.');
      cancelEditResource();
    } finally {
      updateLoading('updateDashboardResource', false);
    }
  };

  const saveDevopsCredentials = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken) {
      return;
    }

    updateLoading('devopsCredentials', true);
    try {
      const response = await fetch(`${API}/api/devops/credentials?auth_token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization, pat }),
      });
      if (!response.ok) {
        setStatus('Failed to save org/PAT. Please verify values.');
        return;
      }
      const payload = (await response.json()) as DevOpsCredentialInfo;
      setPat('');
      setPatConfigured(payload.has_pat);
      setCredUpdatedAt(payload.updated_at ?? null);
      setStatus('DevOps org/PAT saved. You can update PAT anytime when expired.');
    } finally {
      updateLoading('devopsCredentials', false);
    }
  };

  const connectDevops = async () => {
    if (!authToken) {
      return;
    }

    updateLoading('connectDevops', true);
    setStatus('Connecting to Azure DevOps...');
    try {
      const response = await fetch(`${API}/api/devops/connect?auth_token=${authToken}`, { method: 'POST' });
      if (!response.ok) {
        setStatus('DevOps connect failed. Save/update PAT then retry.');
        return;
      }
      const payload = (await response.json()) as ConnectResponse;
      setSessionId(payload.session_id);
      const projectsResponse = await fetch(`${API}/api/projects?session_id=${payload.session_id}`);
      setProjects((await projectsResponse.json()) as Project[]);
      setStatus(`DevOps connected. ${payload.project_count} projects found.`);
      setStep('projects');
    } finally {
      updateLoading('connectDevops', false);
    }
  };

  const openProjectDashboard = async (projectName: string) => {
    if (!sessionId) {
      return;
    }

    setSelectedProject(projectName);
    setActiveProjectName(projectName);
    try {
      const [pipelinesResponse, analyticsResponse] = await Promise.all([
        fetch(`${API}/api/projects/${encodeURIComponent(projectName)}/pipelines?session_id=${sessionId}`),
        fetch(`${API}/api/projects/${encodeURIComponent(projectName)}/analytics?session_id=${sessionId}`),
      ]);
      setPipelines((await pipelinesResponse.json()) as Pipeline[]);
      setAnalytics((await analyticsResponse.json()) as Analytics);
      setPipelineRuns({});
      await loadResources(projectName);
      setStep('dashboard');
      setStatus(`Loaded dashboard for ${projectName}.`);
    } finally {
      setActiveProjectName(null);
    }
  };

  const loadResources = async (projectName?: string) => {
    if (!sessionId) {
      return;
    }

    await fetch(
      `${API}/api/resources?session_id=${sessionId}&project=${encodeURIComponent(projectName ?? selectedProject ?? '')}`,
    );
  };

  const loadRunsForPipeline = async (pipelineId: number) => {
    if (!sessionId || !selectedProject || pipelineRuns[pipelineId]) {
      return;
    }

    setLoadingRunsByPipeline((previous) => ({ ...previous, [pipelineId]: true }));
    try {
      const response = await fetch(
        `${API}/api/projects/${encodeURIComponent(selectedProject)}/pipelines/${pipelineId}/runs?session_id=${sessionId}`,
      );
      const runs = (await response.json()) as PipelineRun[];
      setPipelineRuns((previous) => ({ ...previous, [pipelineId]: runs }));
    } finally {
      setLoadingRunsByPipeline((previous) => ({ ...previous, [pipelineId]: false }));
    }
  };

  const explainRunFailure = async (pipeline: Pipeline, run: PipelineRun) => {
    if (!sessionId || !selectedProject) {
      return;
    }

    setModalTitle(`Failure Explanation · ${pipeline.name} · Run ${run.id}`);
    setModalErrorText('');
    setModalExplanationText('');
    setExplainingRunId(run.id);
    updateLoading('modalExplanation', true);
    setModalOpen(true);
    try {
      const response = await fetch(
        `${API}/api/projects/${encodeURIComponent(selectedProject)}/pipelines/${pipeline.id}/error-intelligence?session_id=${sessionId}&run_id=${run.id}`,
      );
      const insight = (await response.json()) as ErrorIntelligenceResponse;
      const matched = insight.failed_runs.find((failedRun) => failedRun.run_id === run.id);
      if (!matched) {
        setModalErrorText('No specific error detail was found for this run.');
        setModalExplanationText('No explanation available.');
        return;
      }
      setModalErrorText(`Failed task: ${matched.failed_task}\nError: ${matched.error_message}\nTimestamp: ${matched.timestamp}`);
      setModalExplanationText(insight.ai_summary ?? 'AI explanation not configured.');
    } catch {
      setModalErrorText('Unable to load error details right now.');
      setModalExplanationText('Unable to generate explanation right now.');
    } finally {
      updateLoading('modalExplanation', false);
      setExplainingRunId(null);
    }
  };

  const logout = () => {
    updateLoading('logout', true);
    localStorage.removeItem(APP_STATE_STORAGE_KEY);
    setAuthToken(null);
    setUserEmail('');
    setUserName('');
    setUserRole(null);
    setIsAdmin(false);
    setIsApproved(false);
    setDashboards([]);
    setPendingUsers([]);
    setPendingUserRoles({});
    setDashboardName('');
    setDashboardDescription('');
    setSelectedDashboardId('');
    setDashboardResources([]);
    setPortalProject('');
    setPortalEnvironment('');
    setPortalResourceName('');
    setPortalResourceUrl('');
    setPortalResourceType('');
    setPortalResourceNotes('');
    cancelEditResource();
    setSelectedEnvironmentFilter('all');
    setResourceSearchQuery('');
    setOrganization('');
    setPat('');
    setPatConfigured(false);
    setCredUpdatedAt(null);
    setSessionId(null);
    setProjects([]);
    setProjectSearch('');
    setSelectedProject(null);
    setPipelines([]);
    setAnalytics(null);
    setPipelineRuns({});
    setLoadingRunsByPipeline({});
    setEnvTemplates([]);
    setEnvFlows([]);
    setEnvSelectedFlowId('');
    setEnvSelectedFlow(null);
    setEnvSnapshots([]);
    setEnvApplyResult(null);
    setEnvTemplateForm(buildInitialTemplateForm());
    setEnvNewTemplateEnvName('');
    setEnvCreateForm(buildInitialCreateForm());
    setEnvCreateKeys(DEFAULT_ENV_KEYS);
    setEnvTemplateProject('');
    setEnvTemplateRepo('');
    setEnvNewCreateEnvName('');
    setEnvNewCreateKeyName('');
    setEnvCreateImportEnv(INITIAL_ENVS[0]);
    setEnvCreateImportText('');
    setEnvUpdateKey(DEFAULT_ENV_KEYS[0]);
    setEnvEditValues({});
    setEnvUpdateBy('');
    setEnvApprovalBy('');
    setEnvEditImportEnv(INITIAL_ENVS[0]);
    setEnvEditImportText('');
    setModalOpen(false);
    setModalTitle('Failure Explanation');
    setModalErrorText('');
    setModalExplanationText('');
    setExpandedResourceIds(new Set());
    setActiveProjectName(null);
    setApprovingUserId(null);
    setExplainingRunId(null);
    setShowRegister(false);
    setStep('userAuth');
    setStatus('Signed out. Sign in to dashboard account.');
    updateLoading('logout', false);
  };

  const availableEnvironments = useMemo(() => {
    const environmentSet = new Set<string>();
    for (const item of dashboardResources) {
      environmentSet.add(item.environment);
    }
    return Array.from(environmentSet).sort((left, right) => left.localeCompare(right));
  }, [dashboardResources]);

  const filteredDashboardResources = useMemo(() => {
    let filtered = dashboardResources;

    if (selectedEnvironmentFilter !== 'all') {
      filtered = filtered.filter((item) => item.environment === selectedEnvironmentFilter);
    }

    if (resourceSearchQuery.trim()) {
      const query = resourceSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.url.toLowerCase().includes(query) ||
          item.project.toLowerCase().includes(query) ||
            item.resource_type?.toLowerCase().includes(query) ||
            item.notes?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [dashboardResources, selectedEnvironmentFilter, resourceSearchQuery]);

  return (
    <>
      <header className="hero">
        <h1>DevOps Ease Access</h1>
        <p>Dashboard login first. Then choose Dashboard, DevOps, or Env Approval Flow.</p>
      </header>
      <div className="status-row">
        <p className="status" aria-live="polite">{status}</p>
        {authToken ? (
          <button type="button" className="small btn-danger logout-button" onClick={logout} disabled={loadingState.logout}>
            <ButtonLabel loading={loadingState.logout} idle="Logout" busy="Signing out..." />
          </button>
        ) : null}
      </div>

      {loadingState.appBoot ? (
        <main className="single-page">
          <section className="card login-card">
            <LoadingMessage title="Restoring your workspace" detail="Recovering your dashboard session and saved preferences." />
          </section>
        </main>
      ) : null}

      {!loadingState.appBoot && step === 'userAuth' ? (
        <AuthView
          showRegister={showRegister}
          setShowRegister={setShowRegister}
          setStatus={setStatus}
          loginEmailOrUser={loginEmailOrUser}
          setLoginEmailOrUser={setLoginEmailOrUser}
          loginPassword={loginPassword}
          setLoginPassword={setLoginPassword}
          registerEmail={registerEmail}
          setRegisterEmail={setRegisterEmail}
          registerUsername={registerUsername}
          setRegisterUsername={setRegisterUsername}
          registerPassword={registerPassword}
          setRegisterPassword={setRegisterPassword}
          registerConfirmPassword={registerConfirmPassword}
          setRegisterConfirmPassword={setRegisterConfirmPassword}
          loadingLogin={loadingState.login}
          loadingRegister={loadingState.register}
          onLogin={loginDashboardUser}
          onRegister={registerDashboardUser}
        />
      ) : null}

      {!loadingState.appBoot && step === 'homeChoice' ? (
        <HomeChoiceView
          loadingDevopsCredentials={loadingState.devopsCredentials}
          onOpenDashboardPortal={() => setStep('dashboardPortal')}
          onOpenDevOpsPage={() => {
            void loadDevopsCredentials();
            setStep('devopsLogin');
          }}
          onOpenEnvApprovalFlow={() => {
            void openEnvApprovalWorkspace();
          }}
        />
      ) : null}

      {!loadingState.appBoot && step === 'envApproval' ? (
        <EnvApprovalWorkspaceView
          userName={userName}
          userRole={userRole}
          isAdmin={isAdmin}
          canManageTemplates={canManageTemplates}
          canManageFlows={canManageFlows}
          canApplyFlows={canApplyFlows}
          templates={envTemplates}
          flows={envFlows}
          selectedFlowId={envSelectedFlowId}
          selectedFlow={envSelectedFlow}
          snapshots={envSnapshots}
          applyResult={envApplyResult}
          templateForm={envTemplateForm}
          setTemplateForm={setEnvTemplateForm}
          newTemplateEnvName={envNewTemplateEnvName}
          setNewTemplateEnvName={setEnvNewTemplateEnvName}
          createForm={envCreateForm}
          setCreateForm={setEnvCreateForm}
          createKeys={envCreateKeys}
          templateProject={envTemplateProject}
          setTemplateProject={setEnvTemplateProject}
          templateRepo={envTemplateRepo}
          setTemplateRepo={setEnvTemplateRepo}
          newCreateEnvName={envNewCreateEnvName}
          setNewCreateEnvName={setEnvNewCreateEnvName}
          newCreateKeyName={envNewCreateKeyName}
          setNewCreateKeyName={setEnvNewCreateKeyName}
          createImportEnv={envCreateImportEnv}
          setCreateImportEnv={setEnvCreateImportEnv}
          createImportText={envCreateImportText}
          setCreateImportText={setEnvCreateImportText}
          updateKey={envUpdateKey}
          setUpdateKey={setEnvUpdateKey}
          editValues={envEditValues}
          updateBy={envUpdateBy}
          setUpdateBy={setEnvUpdateBy}
          approvalBy={envApprovalBy}
          setApprovalBy={setEnvApprovalBy}
          editImportEnv={envEditImportEnv}
          setEditImportEnv={setEnvEditImportEnv}
          editImportText={envEditImportText}
          setEditImportText={setEnvEditImportText}
          loadingTemplates={loadingState.envApprovalTemplates}
          loadingFlows={loadingState.envApprovalFlows}
          loadingSaveTemplate={loadingState.envApprovalSaveTemplate}
          loadingCreateFlow={loadingState.envApprovalCreateFlow}
          loadingUpdateValues={loadingState.envApprovalUpdateValues}
          loadingApplyFlow={loadingState.envApprovalApplyFlow}
          loadingRollbackFlow={loadingState.envApprovalRollbackFlow}
          onBack={() => setStep('homeChoice')}
          onRefreshTemplates={() => {
            void loadEnvApprovalTemplates();
          }}
          onSaveTemplate={() => {
            void saveEnvApprovalTemplate();
          }}
          onEditTemplate={editEnvApprovalTemplate}
          onResetTemplateForm={resetEnvApprovalTemplateForm}
          onAddTemplateEnvironment={addEnvTemplateEnvironment}
          onRemoveTemplateEnvironment={removeEnvTemplateEnvironment}
          onApplySelectedTemplate={applySelectedEnvTemplate}
          onAddCreateEnvironment={addEnvCreateEnvironment}
          onRemoveCreateEnvironment={removeEnvCreateEnvironment}
          onAddCreateKeyRow={addEnvCreateKeyRow}
          onRemoveCreateKeyRow={removeEnvCreateKeyRow}
          onSetCreateValue={setEnvCreateValue}
          onHandleCreateFileImport={(event) => {
            void handleEnvCreateFileImport(event);
          }}
          onApplyCreateTextImport={() => {
            applyImportedCreateVariables(envCreateImportText);
          }}
          onCreateFlow={createEnvApprovalFlow}
          onRefreshFlows={() => {
            void loadEnvApprovalFlows();
          }}
          onSelectedFlowIdChange={(flowId) => {
            void handleEnvFlowSelection(flowId);
          }}
          onEditValueChange={(envName, value) => {
            setEnvEditValues((previous) => ({ ...previous, [envName]: value }));
          }}
          onHandleEditFileImport={(event) => {
            void handleEnvEditFileImport(event);
          }}
          onApplyEditTextImport={() => {
            applyImportedEditValue(envEditImportText);
          }}
          onSubmitUpdateValues={submitEnvApprovalValueUpdate}
          onApplyFlow={(environmentName) => {
            void applyEnvApprovalFlow(environmentName);
          }}
          onRollbackFlow={(snapshotId) => {
            void rollbackEnvApprovalFlow(snapshotId);
          }}
        />
      ) : null}

      {!loadingState.appBoot && step === 'dashboardPortal' ? (
        <DashboardPortalView
          userEmail={userEmail}
          isAdmin={isAdmin}
          dashboards={dashboards}
          pendingUsers={pendingUsers}
          pendingUserRoles={pendingUserRoles}
          selectedDashboardId={selectedDashboardId}
          dashboardResources={dashboardResources}
          filteredDashboardResources={filteredDashboardResources}
          availableEnvironments={availableEnvironments}
          selectedEnvironmentFilter={selectedEnvironmentFilter}
          setSelectedEnvironmentFilter={setSelectedEnvironmentFilter}
          resourceSearchQuery={resourceSearchQuery}
          setResourceSearchQuery={setResourceSearchQuery}
          expandedResourceIds={expandedResourceIds}
          portalProject={portalProject}
          setPortalProject={setPortalProject}
          portalEnvironment={portalEnvironment}
          setPortalEnvironment={setPortalEnvironment}
          portalResourceName={portalResourceName}
          setPortalResourceName={setPortalResourceName}
          portalResourceUrl={portalResourceUrl}
          setPortalResourceUrl={setPortalResourceUrl}
          portalResourceType={portalResourceType}
          setPortalResourceType={setPortalResourceType}
          portalResourceNotes={portalResourceNotes}
          setPortalResourceNotes={setPortalResourceNotes}
          editingResourceId={editingResourceId}
          editProject={editProject}
          setEditProject={setEditProject}
          editEnvironment={editEnvironment}
          setEditEnvironment={setEditEnvironment}
          editName={editName}
          setEditName={setEditName}
          editUrl={editUrl}
          setEditUrl={setEditUrl}
          editType={editType}
          setEditType={setEditType}
          editNotes={editNotes}
          setEditNotes={setEditNotes}
          dashboardName={dashboardName}
          setDashboardName={setDashboardName}
          dashboardDescription={dashboardDescription}
          setDashboardDescription={setDashboardDescription}
          approvingUserId={approvingUserId}
          loadingDashboards={loadingState.dashboards}
          loadingDashboardResources={loadingState.dashboardResources}
          loadingCreateDashboardResource={loadingState.createDashboardResource}
          loadingUpdateDashboardResource={loadingState.updateDashboardResource}
          loadingCreateDashboard={loadingState.createDashboard}
          loadingPendingUsers={loadingState.pendingUsers}
          onBack={() => setStep('homeChoice')}
          onRefreshDashboards={() => {
            void loadDashboards();
          }}
          onSelectDashboard={(dashboardId) => {
            setSelectedDashboardId(dashboardId);
            void loadDashboardResources(dashboardId);
          }}
          onCreateDashboardResource={createDashboardResource}
          onRefreshResources={() => {
            void loadDashboardResources();
          }}
          onToggleResourceExpansion={toggleResourceExpansion}
          onStartEditResource={startEditResource}
          onUpdateDashboardResource={updateDashboardResource}
          onCancelEditResource={cancelEditResource}
          onCreateDashboard={createDashboard}
          onRefreshPendingUsers={() => {
            void loadPendingUsers();
          }}
          onPendingUserRoleChange={(userId, role) => {
            setPendingUserRoles((previous) => ({ ...previous, [userId]: role }));
          }}
          onApproveUser={(userId, role) => {
            void approveUser(userId, role);
          }}
        />
      ) : null}

      {!loadingState.appBoot && step === 'devopsLogin' ? (
        <DevOpsLoginView
          isApproved={isApproved}
          organization={organization}
          setOrganization={setOrganization}
          pat={pat}
          setPat={setPat}
          patConfigured={patConfigured}
          credUpdatedAt={credUpdatedAt}
          loadingDevopsCredentials={loadingState.devopsCredentials}
          loadingConnectDevops={loadingState.connectDevops}
          onBack={() => setStep('homeChoice')}
          onSaveCredentials={saveDevopsCredentials}
          onConnectDevops={() => {
            void connectDevops();
          }}
        />
      ) : null}

      {!loadingState.appBoot && step === 'projects' ? (
        <ProjectsView
          projectSearch={projectSearch}
          setProjectSearch={setProjectSearch}
          filteredProjects={filteredProjects}
          activeProjectName={activeProjectName}
          loadingConnectDevops={loadingState.connectDevops}
          onOpenProjectDashboard={(projectName) => {
            void openProjectDashboard(projectName);
          }}
          onBack={() => setStep('homeChoice')}
        />
      ) : null}

      {!loadingState.appBoot && step === 'dashboard' ? (
        <ProjectDashboardView
          analytics={analytics}
          pipelines={pipelines}
          selectedProject={selectedProject}
          pipelineRuns={pipelineRuns}
          loadingRunsByPipeline={loadingRunsByPipeline}
          explainingRunId={explainingRunId}
          modalOpen={modalOpen}
          modalTitle={modalTitle}
          modalErrorText={modalErrorText}
          modalExplanationText={modalExplanationText}
          modalLoading={loadingState.modalExplanation}
          onBackToProjects={() => setStep('projects')}
          onLoadRunsForPipeline={(pipelineId) => {
            void loadRunsForPipeline(pipelineId);
          }}
          onExplainRunFailure={(pipeline, run) => {
            void explainRunFailure(pipeline, run);
          }}
          onCloseModal={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

export default App;
