import React, { FormEvent, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type ConnectResponse = {
  session_id: string;
  organization: string;
  project_count: number;
};

type Project = {
  id?: string;
  name: string;
};

type Pipeline = {
  id: number;
  name: string;
  latest_status: string;
  latest_result: string;
};

type FailureRun = {
  run_id: number;
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

const API = 'http://localhost:8000';

function App() {
  const [organization, setOrganization] = useState('');
  const [pat, setPat] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [modalContent, setModalContent] = useState<string>('');
  const [showModal, setShowModal] = useState(false);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('Connecting...');

    const response = await fetch(`${API}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization, pat }),
    });

    if (!response.ok) {
      setStatus('Connection failed. Verify organization and PAT.');
      return;
    }

    const payload = (await response.json()) as ConnectResponse;
    setSessionId(payload.session_id);
    setStatus(`Connected. ${payload.project_count} projects detected.`);

    const projectsResponse = await fetch(`${API}/api/projects?session_id=${payload.session_id}`);
    const projectsPayload = (await projectsResponse.json()) as Project[];
    setProjects(projectsPayload);
  };

  const loadProjectData = async (project: string) => {
    if (!sessionId) return;
    setSelectedProject(project);

    const pipelinesResponse = await fetch(
      `${API}/api/projects/${encodeURIComponent(project)}/pipelines?session_id=${sessionId}`,
    );
    const pipelinesPayload = (await pipelinesResponse.json()) as Pipeline[];
    setPipelines(pipelinesPayload);

    const analyticsResponse = await fetch(
      `${API}/api/projects/${encodeURIComponent(project)}/analytics?session_id=${sessionId}`,
    );
    setAnalytics((await analyticsResponse.json()) as Record<string, unknown>);
  };

  const showFailureInsight = async (project: string, pipelineId: number) => {
    if (!sessionId) return;
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
  };

  return (
    <>
      <header>
        <h1>DevOps Ease Access</h1>
        <p>Accessible Azure DevOps dashboard and pipeline intelligence.</p>
      </header>

      <main>
        <section aria-labelledby="auth-heading" className="card">
          <h2 id="auth-heading">Connect to Azure DevOps</h2>
          <form onSubmit={connect}>
            <label htmlFor="organization">Organization Name</label>
            <input
              id="organization"
              value={organization}
              onChange={(event) => setOrganization(event.target.value)}
              required
            />

            <label htmlFor="pat">Personal Access Token</label>
            <input
              id="pat"
              type="password"
              value={pat}
              onChange={(event) => setPat(event.target.value)}
              required
            />

            <button type="submit">Connect</button>
          </form>
          <p aria-live="polite">{status}</p>
        </section>

        <section aria-labelledby="projects-heading" className="card">
          <h2 id="projects-heading">Projects</h2>
          <ul>
            {projects.map((project) => (
              <li key={project.name}>
                <button onClick={() => loadProjectData(project.name)}>{project.name}</button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pipelines-heading" className="card">
          <h2 id="pipelines-heading">Pipelines</h2>
          <table>
            <caption className="sr-only">Pipeline status table</caption>
            <thead>
              <tr>
                <th>Name</th>
                <th>Latest Status</th>
                <th>Latest Result</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {pipelines.map((pipeline) => (
                <tr key={pipeline.id}>
                  <td>{pipeline.name}</td>
                  <td>{pipeline.latest_status}</td>
                  <td>{pipeline.latest_result}</td>
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
        </section>

        <section aria-labelledby="analytics-heading" className="card">
          <h2 id="analytics-heading">Analytics</h2>
          <pre>{analytics ? JSON.stringify(analytics, null, 2) : 'Select a project to view analytics.'}</pre>
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
