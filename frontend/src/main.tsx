import React, { FormEvent, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Step = 'login' | 'projects' | 'dashboard';

type ConnectResponse = {
  session_id: string;
  organization: string;
  project_count: number;
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
  finishedDate?: string;
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
  const [step, setStep] = useState<Step>('login');
  const [organization, setOrganization] = useState('');
  const [pat, setPat] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState('Please login with organization and PAT.');

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [pipelineRuns, setPipelineRuns] = useState<Record<number, PipelineRun[]>>({});

  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [loadingRunsByPipeline, setLoadingRunsByPipeline] = useState<Record<number, boolean>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('Failure Explanation');
  const [modalErrorText, setModalErrorText] = useState('');
  const [modalExplanationText, setModalExplanationText] = useState('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.name.toLowerCase().includes(projectSearch.toLowerCase())),
    [projects, projectSearch],
  );

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setIsConnecting(true);
    setStatus('Connecting to Azure DevOps...');

    try {
      const response = await fetch(`${API}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization, pat }),
      });

      if (!response.ok) {
        setStatus('Login failed. Please verify organization name and PAT.');
        return;
      }

      const payload = (await response.json()) as ConnectResponse;
      setSessionId(payload.session_id);
      setStatus(`Connected successfully. ${payload.project_count} projects found.`);

      const projectsResponse = await fetch(`${API}/api/projects?session_id=${payload.session_id}`);
      const projectsPayload = (await projectsResponse.json()) as Project[];
      setProjects(projectsPayload);
      setStep('projects');
    } catch {
      setStatus('Network error while logging in. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const openProjectDashboard = async (projectName: string) => {
    if (!sessionId) return;
    setSelectedProject(projectName);
    setIsLoadingProject(true);
    setIsLoadingDashboard(true);
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
      setStep('dashboard');
      setStatus(`Loaded dashboard for ${projectName}.`);
    } catch {
      setStatus('Could not load project dashboard. Please try again.');
    } finally {
      setIsLoadingProject(false);
      setIsLoadingDashboard(false);
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
    setIsLoadingExplanation(true);
    setModalOpen(true);

    try {
      const response = await fetch(
        `${API}/api/projects/${encodeURIComponent(selectedProject)}/pipelines/${pipeline.id}/error-intelligence?session_id=${sessionId}`,
      );
      const insight = (await response.json()) as ErrorIntelligenceResponse;

      if (insight.status === 'All Builds Successful') {
        setModalErrorText('No error for this run. It is reported as successful.');
        setModalExplanationText('No explanation needed because this run did not fail.');
        return;
      }

      const matched = insight.failed_runs.find((f) => f.run_id === run.id);
      if (!matched) {
        setModalErrorText('No specific error detail was found for this run.');
        setModalExplanationText('The run failed, but detailed task-level error was not available.');
        return;
      }

      setModalErrorText(
        `Failed task: ${matched.failed_task}
Error: ${matched.error_message}
Timestamp: ${matched.timestamp}
Logs summary: ${matched.logs_summary}`,
      );
      setModalExplanationText(
        insight.ai_summary ?? 'AI explanation is not configured for this environment.',
      );
    } catch {
      setModalErrorText('Unable to load error details right now.');
      setModalExplanationText('Unable to generate explanation right now.');
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  return (
    <>
      <header className="hero">
        <h1>DevOps Ease Access</h1>
        <p>Login first, then choose a project, then view charts and pipeline history.</p>
      </header>

      <p className="status" aria-live="polite">
        {status}
      </p>

      {step === 'login' ? (
        <main className="single-page">
          <section className="card login-card" aria-labelledby="login-title">
            <h2 id="login-title">Login</h2>
            <form onSubmit={connect}>
              <label htmlFor="organization">Organization Name</label>
              <input
                id="organization"
                placeholder="e.g. contoso"
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                required
              />

              <label htmlFor="pat">Personal Access Token (PAT)</label>
              <input
                id="pat"
                type="password"
                placeholder="Paste PAT"
                value={pat}
                onChange={(event) => setPat(event.target.value)}
                required
              />

              <button type="submit" disabled={isConnecting}>
                {isConnecting ? 'Connecting...' : 'Login'}
              </button>
            </form>
          </section>
        </main>
      ) : null}

      {step === 'projects' ? (
        <main className="single-page">
          <section className="card projects-card" aria-labelledby="projects-title">
            <h2 id="projects-title">Select Project</h2>
            <input
              placeholder="Search project..."
              value={projectSearch}
              onChange={(event) => setProjectSearch(event.target.value)}
              aria-label="Search project"
            />
            {isLoadingProject ? <p className="loader">Loading project dashboard...</p> : null}
            <ul className="project-list">
              {filteredProjects.map((project) => (
                <li key={project.name}>
                  <button onClick={() => openProjectDashboard(project.name)} disabled={isLoadingProject}>
                    {project.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </main>
      ) : null}

      {step === 'dashboard' ? (
        <main className="dashboard-page">
          <section className="card wide" aria-labelledby="charts-title">
            <h2 id="charts-title">Charts</h2>
            {isLoadingDashboard ? <p className="loader">Loading charts...</p> : null}
            {analytics ? (
              <div className="chart-grid">
                <SuccessFailureGraph
                  success={analytics.success_count ?? 0}
                  failure={analytics.failure_count ?? 0}
                />
                {analytics.build_trend ? <VerticalBars title="Build Trend" data={analytics.build_trend} /> : null}
                {analytics.code_push_frequency ? (
                  <VerticalBars title="PR / Code Push Frequency" data={analytics.code_push_frequency} />
                ) : null}
                {analytics.failure_distribution ? (
                  <HorizontalBars
                    title="Pipeline Failure Distribution"
                    data={analytics.failure_distribution}
                  />
                ) : null}
              </div>
            ) : (
              <p>No analytics data yet.</p>
            )}
          </section>

          <section className="card wide">
            <div className="row-between">
              <h2>Pipelines • {selectedProject}</h2>
              <button className="small" onClick={() => setStep('projects')}>
                ← Back to Projects
              </button>
            </div>

            {pipelines.length === 0 ? <p className="muted">No pipelines found.</p> : null}

            <div className="pipeline-accordion">
              {pipelines.map((pipeline) => (
                <details
                  key={pipeline.id}
                  className="pipeline-item"
                  onToggle={(event) => {
                    const el = event.currentTarget as HTMLDetailsElement;
                    if (el.open) {
                      void loadRunsForPipeline(pipeline.id);
                    }
                  }}
                >
                  <summary>
                    <span>{pipeline.name}</span>
                    <span className="muted">
                      {pipeline.latest_status} · {pipeline.latest_result}
                    </span>
                  </summary>

                  {loadingRunsByPipeline[pipeline.id] ? (
                    <p className="loader">Loading run history...</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Run ID</th>
                            <th>State</th>
                            <th>Result</th>
                            <th>Created</th>
                            <th>Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(pipelineRuns[pipeline.id] ?? []).map((run) => (
                            <tr key={run.id}>
                              <td>{run.id}</td>
                              <td>{run.state ?? '-'}</td>
                              <td>{run.result ?? '-'}</td>
                              <td>{run.createdDate ?? '-'}</td>
                              <td>
                                {run.result === 'failed' ? (
                                  <button onClick={() => explainRunFailure(pipeline, run)}>Explain error</button>
                                ) : (
                                  <span className="muted">-</span>
                                )}
                              </td>
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
            <dialog open aria-labelledby="modal-title" className="modal">
              <h3 id="modal-title">{modalTitle}</h3>
              {isLoadingExplanation ? <p className="loader">Loading explanation...</p> : null}

              <section className="modal-block">
                <h4>Error</h4>
                <pre className="modal-pre">{modalErrorText}</pre>
              </section>

              <section className="modal-block">
                <h4>Explanation</h4>
                <pre className="modal-pre">{modalExplanationText}</pre>
              </section>

              <button onClick={() => setModalOpen(false)}>Close</button>
            </dialog>
          ) : null}
        </main>
      ) : null}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
