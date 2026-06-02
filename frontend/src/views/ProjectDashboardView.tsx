import { HorizontalBars, SuccessFailureGraph, VerticalBars } from '../components/Charts';
import { FailureExplanationModal } from '../components/FailureExplanationModal';
import { ButtonLabel, LoadingMessage } from '../components/Loading';
import type { Analytics, Pipeline, PipelineRun } from '../types';

type ProjectDashboardViewProps = Readonly<{
  analytics: Analytics | null;
  pipelines: Pipeline[];
  selectedProject: string | null;
  pipelineRuns: Record<number, PipelineRun[]>;
  loadingRunsByPipeline: Record<number, boolean>;
  explainingRunId: number | null;
  modalOpen: boolean;
  modalTitle: string;
  modalErrorText: string;
  modalExplanationText: string;
  modalLoading: boolean;
  onBackToProjects: () => void;
  onLoadRunsForPipeline: (pipelineId: number) => void;
  onExplainRunFailure: (pipeline: Pipeline, run: PipelineRun) => void;
  onCloseModal: () => void;
}>;

function ProjectDashboardView({
  analytics,
  pipelines,
  selectedProject,
  pipelineRuns,
  loadingRunsByPipeline,
  explainingRunId,
  modalOpen,
  modalTitle,
  modalErrorText,
  modalExplanationText,
  modalLoading,
  onBackToProjects,
  onLoadRunsForPipeline,
  onExplainRunFailure,
  onCloseModal,
}: ProjectDashboardViewProps) {
  return (
    <main className="dashboard-page">
      <section className="card wide">
        <h2>Charts</h2>
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
        ) : (
          <p>No analytics data yet.</p>
        )}
      </section>

      <section className="card wide">
        <div className="row-between">
          <h2>Pipelines • {selectedProject}</h2>
          <button className="small" onClick={onBackToProjects}>Back to Projects</button>
        </div>
        <div className="pipeline-accordion">
          {pipelines.map((pipeline) => (
            <details
              key={pipeline.id}
              className="pipeline-item"
              onToggle={(event) => {
                const element = event.currentTarget as HTMLDetailsElement;
                if (element.open) {
                  onLoadRunsForPipeline(pipeline.id);
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
                <LoadingMessage title="Loading run history" detail={`Fetching recent runs for ${pipeline.name}.`} compact />
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
                              <button onClick={() => onExplainRunFailure(pipeline, run)} disabled={explainingRunId === run.id}>
                                <ButtonLabel loading={explainingRunId === run.id} idle="Explain error" busy="Analyzing..." />
                              </button>
                            ) : (
                              '-'
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
        <FailureExplanationModal
          title={modalTitle}
          errorText={modalErrorText}
          explanationText={modalExplanationText}
          isLoading={modalLoading}
          onClose={onCloseModal}
        />
      ) : null}
    </main>
  );
}

export { ProjectDashboardView };
