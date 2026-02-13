import React, { FormEvent, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

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

type FailureRun = {
  failed_task: string;
  error_message: string;
  timestamp: string;
  logs_summary: string;
};

type ErrorIntelligenceResponse = {
  status: string;
  ai_summary: string | null;
  failed_runs: FailureRun[];
};

type Analytics = {
  total_runs?: number;
  success_count?: number;
  failure_count?: number;
  success_rate?: number;
  build_trend?: Record<string, number>;
  failure_distribution?: Record<string, number>;
  code_push_frequency?: Record<string, number>;
};

const API = 'http://localhost:8000';

const statusClass = (text: string) => {
  if (text.toLowerCase().includes('fail')) return 'status error';
  if (text.toLowerCase().includes('connected')) return 'status success';
  return 'status';
};

function VerticalBars({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <div className="bars" role="img" aria-label={title}>
        {entries.map(([label, value]) => (
          <div key={label} className="bar-item" title={`${label}: ${value}`}>
            <div
              className="bar"
              style={{ height: `${Math.max((value / max) * 100, 6)}%` }}
              aria-hidden="true"
            />
            <p className="bar-value">{value}</p>
            <p className="bar-label">{label}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function HorizontalBars({
  title,
  data,
}: {
  title: string;
  data: Record<string, number>;
}) {
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
            <div className="hbar-track" aria-hidden="true">
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
      <h3>Success vs Failure</h3>
      <div className="stacked" aria-label="Success and failure ratio" role="img">
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
  const [organization, setOrganization] = useState('');
  const [pat, setPat] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState('Enter your organization and PAT to begin.');
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [showModal, setShowModal] = useState(false);

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
        setStatus('Connection failed. Verify organization name and PAT scope.');
        return;
      }

      const payload = (await response.json()) as ConnectResponse;
      setSessionId(payload.session_id);
      setStatus(`Connected to ${payload.organization}. ${payload.project_count} projects available.`);

      const projectsResponse = await fetch(`${API}/api/projects?session_id=${payload.session_id}`);
      const projectsPayload = (await projectsResponse.json()) as Project[];
      setProjects(projectsPayload);

      if (projectsPayload.length === 0) {
        setStatus('Connected successfully, but no projects were found for this organization.');
      }
    } catch {
      setStatus('Network error while connecting. Check backend availability and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const loadProjectData = async (project: string) => {
    if (!sessionId) return;
    setIsLoadingProject(true);
    setSelectedProject(project);
    setStatus(`Loading data for ${project}...`);

    try {
      const pipelinesResponse = await fetch(
        `${API}/api/projects/${encodeURIComponent(project)}/pipelines?session_id=${sessionId}`,
      );
      const pipelinesPayload = (await pipelinesResponse.json()) as Pipeline[];
      setPipelines(pipelinesPayload);

      const analyticsResponse = await fetch(
        `${API}/api/projects/${encodeURIComponent(project)}/analytics?session_id=${sessionId}`,
      );
      const analyticsPayload = (await analyticsResponse.json()) as Analytics;
      setAnalytics(analyticsPayload);
      setStatus(`Loaded ${pipelinesPayload.length} pipelines for ${project}.`);
    } catch {
      setStatus('Could not load project data. Please try again.');
    } finally {
      setIsLoadingProject(false);
    }
  };

  const showFailureInsight = async (project: string, pipelineId: number) => {
    if (!sessionId) return;

    try {
      const response = await fetch(
        `${API}/api/projects/${encodeURIComponent(project)}/pipelines/${pipelineId}/error-intelligence?session_id=${sessionId}`,
      );
      const payload = (await response.json()) as ErrorIntelligenceResponse;

      if (payload.status === 'All Builds Successful') {
        setModalContent('All Builds Successful');
        setShowModal(true);
        return;
      }

      const first = payload.failed_runs[0];
      setModalContent(
        `Failed task: ${first.failed_task}\nError: ${first.error_message}\nTimestamp: ${first.timestamp}\nLogs summary: ${first.logs_summary}\nAI Summary: ${payload.ai_summary ?? 'AI not configured'}`,
      );
      setShowModal(true);
    } catch {
      setModalContent('Unable to load failure details right now.');
      setShowModal(true);
    }
  };

  const summary = useMemo(
    () => [
      { label: 'Projects', value: projects.length },
      { label: 'Pipelines', value: pipelines.length },
      { label: 'Success Runs', value: analytics?.success_count ?? '-' },
      { label: 'Failure Runs', value: analytics?.failure_count ?? '-' },
    ],
    [projects.length, pipelines.length, analytics],
  );

  return (
    <>
      <header className="hero">
        <h1>DevOps Ease Access</h1>
        <p>A clearer and more accessible Azure DevOps dashboard.</p>
      </header>

      <section className="summary-grid" aria-label="Dashboard summary">
        {summary.map((item) => (
          <article key={item.label} className="summary-card">
            <p className="summary-label">{item.label}</p>
            <p className="summary-value">{item.value}</p>
          </article>
        ))}
      </section>

      <main>
        <section aria-labelledby="auth-heading" className="card">
          <h2 id="auth-heading">Connect</h2>
          <p className="muted">Use organization + PAT authentication.</p>
          <form onSubmit={connect}>
            <label htmlFor="organization">Organization Name</label>
            <input
              id="organization"
              placeholder="e.g. contoso"
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              required
            />

            <label htmlFor="pat">Personal Access Token</label>
            <input
              id="pat"
              type="password"
              placeholder="Paste PAT with required scopes"
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              required
            />

            <button type="submit" disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          </form>
          <p className={statusClass(status)} aria-live="polite">
            {status}
          </p>
        </section>

        <section aria-labelledby="projects-heading" className="card">
          <h2 id="projects-heading">Projects</h2>
          {projects.length === 0 ? (
            <p className="muted">No projects loaded yet.</p>
          ) : (
            <ul className="project-list">
              {projects.map((project) => (
                <li key={project.name}>
                  <button
                    className={selectedProject === project.name ? 'active-project' : ''}
                    onClick={() => loadProjectData(project.name)}
                    disabled={isLoadingProject}
                  >
                    {project.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pipelines-heading" className="card wide">
          <h2 id="pipelines-heading">Pipelines {selectedProject ? `• ${selectedProject}` : ''}</h2>
          {pipelines.length === 0 ? (
            <p className="muted">Select a project to view pipelines.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Pipeline status table</caption>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>State</th>
                    <th>Result</th>
                    <th>Insight</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelines.map((pipeline) => (
                    <tr key={pipeline.id}>
                      <td>{pipeline.name}</td>
                      <td>{pipeline.latest_status}</td>
                      <td>
                        <span
                          className={`pill ${
                            pipeline.latest_result === 'succeeded' ? 'pill-success' : 'pill-fail'
                          }`}
                        >
                          {pipeline.latest_result}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() =>
                            selectedProject && showFailureInsight(selectedProject, pipeline.id)
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="analytics-heading" className="card wide">
          <h2 id="analytics-heading">Analytics & Graphs</h2>
          {analytics ? (
            <>
              <div className="chart-grid">
                <SuccessFailureGraph
                  success={analytics.success_count ?? 0}
                  failure={analytics.failure_count ?? 0}
                />
                {analytics.build_trend ? (
                  <VerticalBars title="Build Trend" data={analytics.build_trend} />
                ) : null}
                {analytics.code_push_frequency ? (
                  <VerticalBars title="Code Push Frequency" data={analytics.code_push_frequency} />
                ) : null}
                {analytics.failure_distribution ? (
                  <HorizontalBars
                    title="Failure Distribution by Pipeline"
                    data={analytics.failure_distribution}
                  />
                ) : null}
              </div>
              <details>
                <summary>Raw analytics JSON</summary>
                <pre>{JSON.stringify(analytics, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p className="muted">No analytics yet.</p>
          )}
        </section>

        {showModal ? (
          <dialog open aria-labelledby="modal-title" className="modal">
            <h3 id="modal-title">Pipeline Failure Insight</h3>
            <pre>{modalContent}</pre>
            <button onClick={() => setShowModal(false)}>Close</button>
          </dialog>
        ) : null}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
