import React, { FormEvent, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Step = 'userAuth' | 'homeChoice' | 'devopsLogin' | 'projects' | 'dashboard';

type ConnectResponse = {
  session_id: string;
  organization: string;
  project_count: number;
};

type AuthResponse = {
  auth_token: string;
  email: string;
  username: string;
  is_admin: boolean;
  approved: boolean;
};

type DashboardItem = {
  id: string;
  name: string;
  description?: string | null;
  created_by: string;
  created_at: string;
};

type PendingUser = {
  id: string;
  email: string;
  username: string;
};

type Project = { name: string };

type Pipeline = {
  id: number;
  name: string;
  latest_status: string;
  latest_result: string;
};

type PipelineRun = {
  id: number;
  state?: string;
  result?: string;
  createdDate?: string;
};

type FailedRun = {
  run_id: number;
  failed_task: string;
  error_message: string;
  timestamp: string;
  logs_summary: string;
};

type ErrorIntelligenceResponse = {
  status: string;
  ai_summary: string | null;
  failed_runs: FailedRun[];
};

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
  const max = Math.max(...entries.map(([, value]) => value), 1);
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
  const max = Math.max(...entries.map(([, value]) => value), 1);
  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <ul className="hbar-list" aria-label={title}>
        {entries.map(([label, value]) => (
          <li key={label}>
            <div className="hbar-head">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(value / max) * 100}%` }} />
            </div>
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
      <p className="muted">
        Success: {success} ({successPct}%) · Failure: {failure} ({failPct}%)
      </p>
    </article>
  );
}

function App() {
  const [step, setStep] = useState<Step>('userAuth');
  const [status, setStatus] = useState('Sign in with dashboard account or register a new user.');

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const [loginEmailOrUser, setLoginEmailOrUser] = useState('admin@gmail.com');
  const [loginPassword, setLoginPassword] = useState('admin');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUserName, setRegisterUserName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [dashboardName, setDashboardName] = useState('');
  const [dashboardDescription, setDashboardDescription] = useState('');

  const [organization, setOrganization] = useState('');
  const [pat, setPat] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pipelineRuns, setPipelineRuns] = useState<Record<number, PipelineRun[]>>({});

  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [resourceEnvironment, setResourceEnvironment] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [resourceNotes, setResourceNotes] = useState('');

  const [isBusy, setIsBusy] = useState(false);
  const [loadingRunsByPipeline, setLoadingRunsByPipeline] = useState<Record<number, boolean>>({});

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

      setStatus(`Welcome ${payload.username}. Choose Dashboard or DevOps.`);
      await loadDashboards(payload.auth_token);
      if (payload.is_admin) {
        await loadPendingUsers(payload.auth_token);
      }
      setStep('homeChoice');
    } catch {
      setStatus('Network error during login.');
    } finally {
      setIsBusy(false);
    }
  };

  const registerDashboardUser = async (event: FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    try {
      const response = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerEmail, username: registerUserName, password: registerPassword }),
      });
      if (!response.ok) {
        setStatus('Registration failed. User/email may already exist.');
        return;
      }
      setRegisterEmail('');
      setRegisterUserName('');
      setRegisterPassword('');
      setStatus('Registration submitted. Wait for admin approval, then login.');
    } catch {
      setStatus('Network error during registration.');
    } finally {
      setIsBusy(false);
    }
  };

  const loadDashboards = async (token = authToken) => {
    if (!token) return;
    const response = await fetch(`${API}/api/dashboards?auth_token=${token}`);
    if (response.ok) {
      setDashboards((await response.json()) as DashboardItem[]);
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
      if (response.ok) {
        setDashboardName('');
        setDashboardDescription('');
        setStatus('Dashboard created.');
        await loadDashboards();
      } else {
        setStatus('Only admin can create dashboards.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const loadPendingUsers = async (token = authToken) => {
    if (!token) return;
    const response = await fetch(`${API}/api/admin/pending-users?auth_token=${token}`);
    if (response.ok) {
      setPendingUsers((await response.json()) as PendingUser[]);
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

  const connectDevops = async (event: FormEvent) => {
    event.preventDefault();
    if (!authToken) return;
    setIsBusy(true);
    setStatus('Connecting to Azure DevOps...');
    try {
      const response = await fetch(`${API}/api/connect?auth_token=${authToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization, pat }),
      });
      if (!response.ok) {
        setStatus('DevOps login failed. Verify org/PAT and user approval.');
        return;
      }
      const payload = (await response.json()) as ConnectResponse;
      setSessionId(payload.session_id);
      setStatus(`DevOps connected. ${payload.project_count} projects found.`);

      const projectsResponse = await fetch(`${API}/api/projects?session_id=${payload.session_id}`);
      const projectsPayload = (await projectsResponse.json()) as Project[];
      setProjects(projectsPayload);
      setStep('projects');
    } catch {
      setStatus('Network error while connecting DevOps.');
    } finally {
      setIsBusy(false);
    }
  };

  const openProjectDashboard = async (projectName: string) => {
    if (!sessionId) return;
    setSelectedProject(projectName);
    setIsBusy(true);
    setStatus(`Loading dashboard for ${projectName}...`);
    try {
      const [pipelinesResponse, analyticsResponse] = await Promise.all([
        fetch(`${API}/api/projects/${encodeURIComponent(projectName)}/pipelines?session_id=${sessionId}`),
        fetch(`${API}/api/projects/${encodeURIComponent(projectName)}/analytics?session_id=${sessionId}`),
      ]);

      const pipelinesPayload = (await pipelinesResponse.json()) as Pipeline[];
      const analyticsPayload = (await analyticsResponse.json()) as Analytics;
      setPipelines(pipelinesPayload);
      setAnalytics(analyticsPayload);
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
    const projectParam = encodeURIComponent(projectName ?? selectedProject ?? '');
    const response = await fetch(`${API}/api/resources?session_id=${sessionId}&project=${projectParam}`);
    if (response.ok) {
      setResources((await response.json()) as ResourceItem[]);
    }
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
      setModalErrorText(
        `Failed task: ${matched.failed_task}\nError: ${matched.error_message}\nTimestamp: ${matched.timestamp}\nSummary: ${matched.logs_summary}`,
      );
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
        <p>Secure dashboard login, admin approval, then choose Dashboard or DevOps.</p>
      </header>

      <p className="status" aria-live="polite">{status}</p>

      {step === 'userAuth' ? (
        <main className="single-page two-col">
          <section className="card login-card">
            <h2>Dashboard Login</h2>
            <form onSubmit={loginDashboardUser}>
              <label>Email or Username</label>
              <input value={loginEmailOrUser} onChange={(e) => setLoginEmailOrUser(e.target.value)} required />
              <label>Password</label>
              <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              <button type="submit" disabled={isBusy}>{isBusy ? 'Please wait...' : 'Login'}</button>
            </form>
            <p className="muted">Default admin: admin@gmail.com / admin</p>
          </section>

          <section className="card login-card">
            <h2>Register User</h2>
            <form onSubmit={registerDashboardUser}>
              <label>Email</label>
              <input value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required />
              <label>Username</label>
              <input value={registerUserName} onChange={(e) => setRegisterUserName(e.target.value)} required />
              <label>Password</label>
              <input type="password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required />
              <button type="submit" disabled={isBusy}>{isBusy ? 'Submitting...' : 'Register'}</button>
            </form>
          </section>
        </main>
      ) : null}

      {step === 'homeChoice' ? (
        <main className="single-page">
          <section className="card">
            <h2>Welcome {userName}</h2>
            <p>{userEmail} {isAdmin ? '(Admin)' : '(Viewer)'}</p>
            <div className="row-between">
              <button className="small" onClick={() => setStep('devopsLogin')}>Go to DevOps</button>
              <button className="small" onClick={() => void loadDashboards()}>Refresh Dashboards</button>
            </div>
            <h3>Dashboards</h3>
            <ul className="resource-list">
              {dashboards.map((dashboard) => (
                <li key={dashboard.id} className="resource-item">
                  <strong>{dashboard.name}</strong>
                  <p className="muted">{dashboard.description ?? 'No description'}</p>
                </li>
              ))}
            </ul>
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
            <h2>DevOps Login</h2>
            {!isApproved ? <p className="muted">Waiting for admin approval.</p> : null}
            <form onSubmit={connectDevops}>
              <label>Organization Name</label>
              <input value={organization} onChange={(e) => setOrganization(e.target.value)} required />
              <label>PAT</label>
              <input type="password" value={pat} onChange={(e) => setPat(e.target.value)} required />
              <button type="submit" disabled={isBusy || !isApproved}>{isBusy ? 'Connecting...' : 'Connect DevOps'}</button>
            </form>
            <button className="small" onClick={() => setStep('homeChoice')}>Back</button>
          </section>
        </main>
      ) : null}

      {step === 'projects' ? (
        <main className="single-page">
          <section className="card projects-card">
            <h2>Select Project</h2>
            <input
              placeholder="Search project..."
              value={projectSearch}
              onChange={(event) => setProjectSearch(event.target.value)}
            />
            <ul className="project-list">
              {filteredProjects.map((project) => (
                <li key={project.name}>
                  <button onClick={() => void openProjectDashboard(project.name)}>{project.name}</button>
                </li>
              ))}
            </ul>
            <button className="small" onClick={() => setStep('homeChoice')}>Back to choice</button>
          </section>
        </main>
      ) : null}

      {step === 'dashboard' ? (
        <main className="dashboard-page">
          <section className="card wide" aria-labelledby="charts-title">
            <h2 id="charts-title">Charts</h2>
            {analytics ? (
              <div className="chart-grid">
                <SuccessFailureGraph success={analytics.success_count ?? 0} failure={analytics.failure_count ?? 0} />
                {analytics.build_trend ? <VerticalBars title="Build Trend" data={analytics.build_trend} /> : null}
                {analytics.code_push_frequency ? (
                  <VerticalBars title="PR / Code Push Frequency" data={analytics.code_push_frequency} />
                ) : null}
                {analytics.failure_distribution ? (
                  <HorizontalBars title="Pipeline Failure Distribution" data={analytics.failure_distribution} />
                ) : null}
              </div>
            ) : <p>No analytics data yet.</p>}
          </section>

          <section className="card wide">
            <div className="row-between">
              <h2>Resource Cards • {selectedProject}</h2>
              <button className="small" onClick={() => void loadResources(selectedProject ?? undefined)}>Refresh</button>
            </div>
            <form className="resource-form" onSubmit={createResource}>
              <label>Environment</label>
              <input value={resourceEnvironment} onChange={(e) => setResourceEnvironment(e.target.value)} required />
              <label>Resource Name</label>
              <input value={resourceName} onChange={(e) => setResourceName(e.target.value)} required />
              <label>Resource URL</label>
              <input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} required />
              <label>Resource Type</label>
              <input value={resourceType} onChange={(e) => setResourceType(e.target.value)} />
              <label>Notes</label>
              <input value={resourceNotes} onChange={(e) => setResourceNotes(e.target.value)} />
              <button type="submit" disabled={isBusy}>Add Resource</button>
            </form>

            {Object.entries(resourcesByEnvironment).map(([env, items]) => (
              <article key={env} className="resource-group">
                <h3>{env}</h3>
                <ul className="resource-list">
                  {items.map((resource) => (
                    <li key={resource.id} className="resource-item">
                      <p><strong>{resource.name}</strong> {resource.resource_type ? `· ${resource.resource_type}` : ''}</p>
                      <a href={resource.url} target="_blank" rel="noreferrer">{resource.url}</a>
                      {resource.notes ? <p className="muted">{resource.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>

          <section className="card wide">
            <div className="row-between">
              <h2>Pipelines • {selectedProject}</h2>
              <button className="small" onClick={() => setStep('projects')}>Back to Projects</button>
            </div>
            <div className="pipeline-accordion">
              {pipelines.map((pipeline) => (
                <details
                  key={pipeline.id}
                  className="pipeline-item"
                  onToggle={(event) => {
                    const el = event.currentTarget as HTMLDetailsElement;
                    if (el.open) void loadRunsForPipeline(pipeline.id);
                  }}
                >
                  <summary>
                    <span>{pipeline.name}</span>
                    <span className="muted">{pipeline.latest_status} · {pipeline.latest_result}</span>
                  </summary>
                  {loadingRunsByPipeline[pipeline.id] ? <p className="loader">Loading run history...</p> : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr><th>Run ID</th><th>State</th><th>Result</th><th>Created</th><th>Error</th></tr>
                        </thead>
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
