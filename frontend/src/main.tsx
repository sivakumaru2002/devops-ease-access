import React, { FormEvent, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Step = 'userAuth' | 'homeChoice' | 'dashboardPortal' | 'devopsLogin' | 'projects' | 'dashboard';

type ConnectResponse = { session_id: string; organization: string; project_count: number };
type AuthResponse = { auth_token: string; email: string; username: string; is_admin: boolean; approved: boolean };
type DevOpsCredentialInfo = { organization?: string | null; has_pat: boolean; updated_at?: string | null };
type DashboardItem = { id: string; name: string; description?: string | null; created_by: string; created_at: string };
type DashboardResourceItem = {
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
type PendingUser = { id: string; email: string; username: string };
type Project = { name: string };
type Pipeline = { id: number; name: string; latest_status: string; latest_result: string };
type PipelineRun = { id: number; state?: string; result?: string; createdDate?: string };
type FailedRun = { run_id: number; failed_task: string; error_message: string; timestamp: string; logs_summary: string };
type ErrorIntelligenceResponse = { status: string; ai_summary: string | null; failed_runs: FailedRun[] };
type Analytics = {
  success_count?: number;
  failure_count?: number;
  build_trend?: Record<string, number>;
  failure_distribution?: Record<string, number>;
  code_push_frequency?: Record<string, number>;
};
type ResourceItem = {
  id: string;
  organization: string;
  project: string;
  environment: string;
  name: string;
  url: string;
  resource_type?: string | null;
  notes?: string | null;
};

const API = 'http://localhost:8000';

function VerticalBars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <div className="bars" role="img" aria-label={title}>
        {entries.map(([label, value]) => (
          <div key={label} className="bar-item" title={`${label}: ${value}`}>
            <div className="bar" style={{ height: `${Math.max((value / max) * 100, 6)}%` }} />
            <p className="bar-value">{value}</p>
            <p className="bar-label">{label}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function HorizontalBars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <ul className="hbar-list" aria-label={title}>
        {entries.map(([label, value]) => (
          <li key={label}>
            <div className="hbar-head"><span>{label}</span><strong>{value}</strong></div>
            <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(value / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function SuccessFailureGraph({ success = 0, failure = 0 }: { success?: number; failure?: number }) {
  const total = Math.max(success + failure, 1);
  const successPct = Math.round((success / total) * 100);
  const failPct = 100 - successPct;
  return (
    <article className="chart-card">
      <h3>Success vs Failure Rate</h3>
      <div className="stacked" role="img" aria-label="Success and failure ratio">
        <div className="stack-ok" style={{ width: `${successPct}%` }} />
        <div className="stack-fail" style={{ width: `${failPct}%` }} />
      </div>
      <p className="muted">Success: {success} ({successPct}%) · Failure: {failure} ({failPct}%)</p>
    </article>
  );
}

function App() {
  const [step, setStep] = useState<Step>('userAuth');
  const [status, setStatus] = useState('Sign in to dashboard account.');
  const [isBusy, setIsBusy] = useState(false);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loginEmailOrUser, setLoginEmailOrUser] = useState('admin@gmail.com');
  const [loginPassword, setLoginPassword] = useState('admin');

  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
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

  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourceEnvironment, setResourceEnvironment] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [resourceNotes, setResourceNotes] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Failure Explanation');
  const [modalErrorText, setModalErrorText] = useState('');
  const [modalExplanationText, setModalExplanationText] = useState('');

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase())),
    [projects, projectSearch],
  );

  const resourcesByEnvironment = useMemo(() => {
    const grouped: Record<string, ResourceItem[]> = {};
    for (const resource of resources) {
      const key = resource.environment || 'Unspecified';
      grouped[key] = grouped[key] ?? [];
      grouped[key].push(resource);
    }
    return grouped;
  }, [resources]);

  const loadDashboards = async (token = authToken) => {
    if (!token) return;
    const response = await fetch(`${API}/api/dashboards?auth_token=${token}`);
    if (!response.ok) return;
    const items = (await response.json()) as DashboardItem[];
    setDashboards(items);
    if (!selectedDashboardId && items.length > 0) {
      setSelectedDashboardId(items[0].id);
      await loadDashboardResources(items[0].id, token);
    }
  };

  const loadPendingUsers = async (token = authToken) => {
    if (!token) return;
    const response = await fetch(`${API}/api/admin/pending-users?auth_token=${token}`);
    if (response.ok) setPendingUsers((await response.json()) as PendingUser[]);
  };

  const loadDashboardResources = async (dashboardId = selectedDashboardId, token = authToken) => {
    if (!token || !dashboardId) return;
    const response = await fetch(`${API}/api/dashboards/${dashboardId}/resources?auth_token=${token}`);
    if (response.ok) setDashboardResources((await response.json()) as DashboardResourceItem[]);
  };

  const createDashboardResource = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken || !selectedDashboardId) return;
    setIsBusy(true);
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
        setStatus('Failed to add dashboard resource card.');
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
      setIsBusy(false);
    }
  };

  const loadDevopsCredentials = async (token = authToken) => {
    if (!token) return;
    const response = await fetch(`${API}/api/devops/credentials?auth_token=${token}`);
    if (!response.ok) return;
    const payload = (await response.json()) as DevOpsCredentialInfo;
    setOrganization(payload.organization ?? '');
    setPatConfigured(payload.has_pat);
    setCredUpdatedAt(payload.updated_at ?? null);
  };

  const loginDashboardUser = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_or_username: loginEmailOrUser, password: loginPassword }),
      });
      if (!response.ok) {
        setStatus('Dashboard login failed.');
        return;
      }
      const payload = (await response.json()) as AuthResponse;
      setAuthToken(payload.auth_token);
      setUserEmail(payload.email);
      setUserName(payload.username);
      setIsAdmin(payload.is_admin);
      setIsApproved(payload.approved);
      if (!payload.approved) {
        setStatus('Your account is waiting for admin approval.');
        return;
      }
      await loadDashboards(payload.auth_token);
      if (payload.is_admin) await loadPendingUsers(payload.auth_token);
      setStatus(`Welcome ${payload.username}. Choose Dashboard or DevOps.`);
      setStep('homeChoice');
    } catch {
      setStatus('Network error during login.');
    } finally {
      setIsBusy(false);
    }
  };

  const createDashboard = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken) return;
    setIsBusy(true);
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
      setIsBusy(false);
    }
  };

  const approveUser = async (userId: string) => {
    if (!authToken) return;
    setIsBusy(true);
    try {
      await fetch(`${API}/api/admin/users/${userId}/approve?auth_token=${authToken}`, { method: 'POST' });
      await loadPendingUsers();
      setStatus('User approved.');
    } finally {
      setIsBusy(false);
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
    if (!authToken || !selectedDashboardId || !editingResourceId) return;

    setIsBusy(true);
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
      setIsBusy(false);
    }
  };

  const saveDevopsCredentials = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken) return;
    setIsBusy(true);
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
      setIsBusy(false);
    }
  };

  const connectDevops = async () => {
    if (!authToken) return;
    setIsBusy(true);
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
      setIsBusy(false);
    }
  };

  const openProjectDashboard = async (projectName: string) => {
    if (!sessionId) return;
    setSelectedProject(projectName);
    setIsBusy(true);
    try {
      const [pResp, aResp] = await Promise.all([
        fetch(`${API}/api/projects/${encodeURIComponent(projectName)}/pipelines?session_id=${sessionId}`),
        fetch(`${API}/api/projects/${encodeURIComponent(projectName)}/analytics?session_id=${sessionId}`),
      ]);
      setPipelines((await pResp.json()) as Pipeline[]);
      setAnalytics((await aResp.json()) as Analytics);
      setPipelineRuns({});
      await loadResources(projectName);
      setStep('dashboard');
      setStatus(`Loaded dashboard for ${projectName}.`);
    } finally {
      setIsBusy(false);
    }
  };

  const loadResources = async (projectName?: string) => {
    if (!sessionId) return;
    const response = await fetch(
      `${API}/api/resources?session_id=${sessionId}&project=${encodeURIComponent(projectName ?? selectedProject ?? '')}`,
    );
    if (response.ok) setResources((await response.json()) as ResourceItem[]);
  };

  const createResource = async (event: FormEvent) => {
    event.preventDefault();
    if (!sessionId || !selectedProject) return;
    setIsBusy(true);
    try {
      const response = await fetch(`${API}/api/resources?session_id=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: selectedProject,
          environment: resourceEnvironment,
          name: resourceName,
          url: resourceUrl,
          resource_type: resourceType || undefined,
          notes: resourceNotes || undefined,
        }),
      });
      if (response.ok) {
        setResourceEnvironment('');
        setResourceName('');
        setResourceUrl('');
        setResourceType('');
        setResourceNotes('');
        await loadResources(selectedProject);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const loadRunsForPipeline = async (pipelineId: number) => {
    if (!sessionId || !selectedProject || pipelineRuns[pipelineId]) return;
    setLoadingRunsByPipeline((prev) => ({ ...prev, [pipelineId]: true }));
    try {
      const response = await fetch(
        `${API}/api/projects/${encodeURIComponent(selectedProject)}/pipelines/${pipelineId}/runs?session_id=${sessionId}`,
      );
      const runs = (await response.json()) as PipelineRun[];
      setPipelineRuns((prev) => ({ ...prev, [pipelineId]: runs }));
    } finally {
      setLoadingRunsByPipeline((prev) => ({ ...prev, [pipelineId]: false }));
    }
  };

  const explainRunFailure = async (pipeline: Pipeline, run: PipelineRun) => {
    if (!sessionId || !selectedProject) return;
    setModalTitle(`Failure Explanation · ${pipeline.name} · Run ${run.id}`);
    setModalErrorText('Loading error details...');
    setModalExplanationText('Loading explanation...');
    setModalOpen(true);
    try {
      const response = await fetch(
        `${API}/api/projects/${encodeURIComponent(selectedProject)}/pipelines/${pipeline.id}/error-intelligence?session_id=${sessionId}&run_id=${run.id}`,
      );
      const insight = (await response.json()) as ErrorIntelligenceResponse;
      const matched = insight.failed_runs.find((f) => f.run_id === run.id);
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
    }
  };

  return (
    <>
      <header className="hero">
        <h1>DevOps Ease Access</h1>
        <p>Dashboard login first. Then choose Dashboard or DevOps.</p>
      </header>
      <p className="status" aria-live="polite">{status}</p>

      {step === 'userAuth' ? (
        <main className="single-page">
          <section className="card login-card">
            <h2>Dashboard Login</h2>
            <form onSubmit={loginDashboardUser}>
              <label>Email or Username</label>
              <input value={loginEmailOrUser} onChange={(e) => setLoginEmailOrUser(e.target.value)} required />
              <label>Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              <button type="submit" disabled={isBusy}>{isBusy ? 'Please wait...' : 'Login'}</button>
            </form>
            <p className="muted">Ask admin to create/approve your account. Default admin: admin@gmail.com / admin.</p>
          </section>
        </main>
      ) : null}

      {step === 'homeChoice' ? (
        <main className="single-page two-col">
          <section className="card">
            <h2>Dashboard Portal</h2>
            <p>Create dashboard cards (admin) and view them (users).</p>
            <button onClick={() => setStep('dashboardPortal')}>Open Dashboard Portal</button>
          </section>
          <section className="card">
            <h2>DevOps Page</h2>
            <p>Configure Org + PAT (saved against your user), then connect.</p>
            <button onClick={() => { void loadDevopsCredentials(); setStep('devopsLogin'); }}>Open DevOps Page</button>
          </section>
        </main>
      ) : null}

      {step === 'dashboardPortal' ? (
        <main className="single-page">
          <section className="card">
            <div className="row-between">
              <h2>Dashboards</h2>
              <button className="small" onClick={() => setStep('homeChoice')}>Back</button>
            </div>
            <p>{userEmail} {isAdmin ? '(Admin)' : '(Viewer)'}</p>
            <button className="small" onClick={() => void loadDashboards()} disabled={isBusy}>Refresh Dashboards</button>
            <ul className="resource-list">
              {dashboards.map((d) => (
                <li key={d.id} className="resource-item"><strong>{d.name}</strong><p className="muted">{d.description ?? 'No description'}</p></li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>Add Resource Card (Manual)</h3>
            <p className="muted">Add cards by project and environment (e.g., GPMD → stage/prod/preprod).</p>
            <label>Select Dashboard</label>
            <select
              value={selectedDashboardId}
              onChange={(e) => {
                setSelectedDashboardId(e.target.value);
                void loadDashboardResources(e.target.value);
              }}
            >
              <option value="">Select dashboard</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <form className="resource-form" onSubmit={createDashboardResource}>
              <label>Project</label><input placeholder="e.g. gpmd" value={portalProject} onChange={(e) => setPortalProject(e.target.value)} required />
              <label>Environment</label><input placeholder="stage / prod / preprod" value={portalEnvironment} onChange={(e) => setPortalEnvironment(e.target.value)} required />
              <label>Resource Name</label><input placeholder="storage-account-name" value={portalResourceName} onChange={(e) => setPortalResourceName(e.target.value)} required />
              <label>Resource URL</label><input placeholder="https://..." value={portalResourceUrl} onChange={(e) => setPortalResourceUrl(e.target.value)} required />
              <label>Resource Type</label><input value={portalResourceType} onChange={(e) => setPortalResourceType(e.target.value)} />
              <label>Notes</label><input value={portalResourceNotes} onChange={(e) => setPortalResourceNotes(e.target.value)} />
              <button type="submit" disabled={isBusy || !selectedDashboardId}>Add Card</button>
            </form>

            <button className="small" onClick={() => void loadDashboardResources()} disabled={isBusy || !selectedDashboardId}>Refresh Resource Cards</button>
            <p className="muted">Resource cards shown below are shared for the selected dashboard.</p>
            {dashboardResources.length === 0 ? <p className="muted">No resource cards yet for this dashboard.</p> : null}
            <ul className="resource-list">
              {dashboardResources.map((r) => (
                <li key={r.id} className="resource-item">
                  <p><strong>{r.project}</strong> · <strong>{r.environment}</strong></p>
                  <p><strong>{r.name}</strong>{r.resource_type ? ` · ${r.resource_type}` : ''}</p>
                  <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                  {r.notes ? <p className="muted">{r.notes}</p> : null}
                  {isAdmin || r.owner_email === userEmail ? (
                    <button className="small" onClick={() => startEditResource(r)} disabled={isBusy}>Edit</button>
                  ) : null}
                </li>
              ))}
            </ul>

            {editingResourceId ? (
              <form className="resource-form" onSubmit={updateDashboardResource}>
                <h4>Edit Resource Card</h4>
                <label>Project</label><input value={editProject} onChange={(e) => setEditProject(e.target.value)} required />
                <label>Environment</label><input value={editEnvironment} onChange={(e) => setEditEnvironment(e.target.value)} required />
                <label>Resource Name</label><input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                <label>Resource URL</label><input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} required />
                <label>Resource Type</label><input value={editType} onChange={(e) => setEditType(e.target.value)} />
                <label>Notes</label><input value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                <button type="submit" disabled={isBusy}>Save Changes</button>
                <button type="button" className="small" onClick={cancelEditResource}>Cancel</button>
              </form>
            ) : null}
          </section>

          {isAdmin ? (
            <section className="card">
              <h3>Create Dashboard (Admin)</h3>
              <form onSubmit={createDashboard}>
                <label>Name</label>
                <input value={dashboardName} onChange={(e) => setDashboardName(e.target.value)} required />
                <label>Description</label>
                <input value={dashboardDescription} onChange={(e) => setDashboardDescription(e.target.value)} />
                <button type="submit" disabled={isBusy}>Create</button>
              </form>

              <h3>Pending Users</h3>
              <button className="small" onClick={() => void loadPendingUsers()} disabled={isBusy}>Refresh Pending</button>
              <ul className="resource-list">
                {pendingUsers.map((u) => (
                  <li key={u.id} className="resource-item">
                    <p><strong>{u.username}</strong> · {u.email}</p>
                    <button className="small" onClick={() => void approveUser(u.id)}>Approve</button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>
      ) : null}

      {step === 'devopsLogin' ? (
        <main className="single-page">
          <section className="card login-card">
            <div className="row-between">
              <h2>DevOps Page</h2>
              <button className="small" onClick={() => setStep('homeChoice')}>Back</button>
            </div>
            {!isApproved ? <p className="muted">Waiting for admin approval.</p> : null}
            <form onSubmit={saveDevopsCredentials}>
              <label>Organization Name</label>
              <input value={organization} onChange={(e) => setOrganization(e.target.value)} required />
              <label>PAT {patConfigured ? '(Update if expired)' : ''}</label>
              <input type="password" value={pat} onChange={(e) => setPat(e.target.value)} required />
              <button type="submit" disabled={isBusy || !isApproved}>{isBusy ? 'Saving...' : 'Save / Update PAT'}</button>
            </form>
            <p className="muted">PAT configured: {patConfigured ? 'Yes' : 'No'} {credUpdatedAt ? `· Updated: ${credUpdatedAt}` : ''}</p>
            <button onClick={() => void connectDevops()} disabled={isBusy || !isApproved || !patConfigured}>Connect to DevOps</button>
          </section>
        </main>
      ) : null}

      {step === 'projects' ? (
        <main className="single-page">
          <section className="card projects-card">
            <h2>Select Project</h2>
            <input placeholder="Search project..." value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} />
            <ul className="project-list">
              {filteredProjects.map((project) => (
                <li key={project.name}><button onClick={() => void openProjectDashboard(project.name)}>{project.name}</button></li>
              ))}
            </ul>
            <button className="small" onClick={() => setStep('homeChoice')}>Back to choice</button>
          </section>
        </main>
      ) : null}

      {step === 'dashboard' ? (
        <main className="dashboard-page">
          <section className="card wide">
            <h2>Charts</h2>
            {analytics ? (
              <div className="chart-grid">
                <SuccessFailureGraph success={analytics.success_count ?? 0} failure={analytics.failure_count ?? 0} />
                {analytics.build_trend ? <VerticalBars title="Build Trend" data={analytics.build_trend} /> : null}
                {analytics.code_push_frequency ? <VerticalBars title="PR / Code Push Frequency" data={analytics.code_push_frequency} /> : null}
                {analytics.failure_distribution ? <HorizontalBars title="Pipeline Failure Distribution" data={analytics.failure_distribution} /> : null}
              </div>
            ) : <p>No analytics data yet.</p>}
          </section>

          <section className="card wide">
            <div className="row-between">
              <h2>Resource Cards • {selectedProject}</h2>
              <button className="small" onClick={() => void loadResources(selectedProject ?? undefined)}>Refresh</button>
            </div>
            <form className="resource-form" onSubmit={createResource}>
              <label>Environment</label><input value={resourceEnvironment} onChange={(e) => setResourceEnvironment(e.target.value)} required />
              <label>Resource Name</label><input value={resourceName} onChange={(e) => setResourceName(e.target.value)} required />
              <label>Resource URL</label><input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} required />
              <label>Resource Type</label><input value={resourceType} onChange={(e) => setResourceType(e.target.value)} />
              <label>Notes</label><input value={resourceNotes} onChange={(e) => setResourceNotes(e.target.value)} />
              <button type="submit" disabled={isBusy}>Add Resource</button>
            </form>

            {Object.entries(resourcesByEnvironment).map(([env, items]) => (
              <article key={env} className="resource-group">
                <h3>{env}</h3>
                <ul className="resource-list">
                  {items.map((r) => (
                    <li key={r.id} className="resource-item">
                      <p><strong>{r.name}</strong>{r.resource_type ? ` · ${r.resource_type}` : ''}</p>
                      <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>
                      {r.notes ? <p className="muted">{r.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="card wide">
            <div className="row-between"><h2>Pipelines • {selectedProject}</h2><button className="small" onClick={() => setStep('projects')}>Back to Projects</button></div>
            <div className="pipeline-accordion">
              {pipelines.map((pipeline) => (
                <details key={pipeline.id} className="pipeline-item" onToggle={(e) => { const el = e.currentTarget as HTMLDetailsElement; if (el.open) void loadRunsForPipeline(pipeline.id); }}>
                  <summary><span>{pipeline.name}</span><span className="muted">{pipeline.latest_status} · {pipeline.latest_result}</span></summary>
                  {loadingRunsByPipeline[pipeline.id] ? <p className="loader">Loading run history...</p> : (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Run ID</th><th>State</th><th>Result</th><th>Created</th><th>Error</th></tr></thead>
                        <tbody>
                          {(pipelineRuns[pipeline.id] ?? []).map((run) => (
                            <tr key={run.id}>
                              <td>{run.id}</td><td>{run.state ?? '-'}</td><td>{run.result ?? '-'}</td><td>{run.createdDate ?? '-'}</td>
                              <td>{run.result === 'failed' ? <button onClick={() => void explainRunFailure(pipeline, run)}>Explain error</button> : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </details>
              ))}
            </div>
          </section>

          {modalOpen ? (
            <dialog open className="modal">
              <h3>{modalTitle}</h3>
              <section className="modal-block"><h4>Error</h4><pre className="modal-pre">{modalErrorText}</pre></section>
              <section className="modal-block"><h4>Explanation</h4><pre className="modal-pre">{modalExplanationText}</pre></section>
              <button onClick={() => setModalOpen(false)}>Close</button>
            </dialog>
          ) : null}
        </main>
      ) : null}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
