import type { Dispatch, SetStateAction } from 'react';

import { ButtonLabel, LoadingMessage } from '../components/Loading';
import type { Project } from '../types';

type StringSetter = Dispatch<SetStateAction<string>>;

type ProjectsViewProps = Readonly<{
  projectSearch: string;
  setProjectSearch: StringSetter;
  filteredProjects: Project[];
  activeProjectName: string | null;
  loadingConnectDevops: boolean;
  onOpenProjectDashboard: (projectName: string) => void;
  onBack: () => void;
}>;

function ProjectsView({
  projectSearch,
  setProjectSearch,
  filteredProjects,
  activeProjectName,
  loadingConnectDevops,
  onOpenProjectDashboard,
  onBack,
}: ProjectsViewProps) {
  return (
    <main className="single-page">
      <section className="card projects-card">
        <h2>Select Project</h2>
        {loadingConnectDevops ? (
          <LoadingMessage title="Loading project list" detail="Azure DevOps is returning the projects available for this account." compact />
        ) : null}
        <input placeholder="Search project..." value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} />
        <ul className="project-list">
          {filteredProjects.map((project) => (
            <li key={project.name}>
              <button onClick={() => onOpenProjectDashboard(project.name)} disabled={activeProjectName === project.name}>
                <ButtonLabel
                  loading={activeProjectName === project.name}
                  idle={project.name}
                  busy={`Opening ${project.name}...`}
                />
              </button>
            </li>
          ))}
        </ul>
        {activeProjectName ? (
          <LoadingMessage
            title="Opening project dashboard"
            detail={`Loading pipelines, analytics, and resources for ${activeProjectName}.`}
            compact
          />
        ) : null}
        <button className="small" onClick={onBack}>Back to choice</button>
      </section>
    </main>
  );
}

export { ProjectsView };
