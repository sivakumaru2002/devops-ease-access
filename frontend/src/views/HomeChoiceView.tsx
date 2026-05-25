import { ButtonLabel } from '../components/Loading';

type HomeChoiceViewProps = Readonly<{
  loadingDevopsCredentials: boolean;
  onOpenDashboardPortal: () => void;
  onOpenDevOpsPage: () => void;
  onOpenEnvApprovalFlow: () => void;
}>;

function HomeChoiceView({
  loadingDevopsCredentials,
  onOpenDashboardPortal,
  onOpenDevOpsPage,
  onOpenEnvApprovalFlow,
}: HomeChoiceViewProps) {
  return (
    <main className="single-page choice-grid">
      <section className="card">
        <h2>Dashboard Portal</h2>
        <p style={{ padding: '10px' }}>Dashboard portal which allows user to access azure portal resource at ease.</p>
        <button onClick={onOpenDashboardPortal}>Open Dashboard Portal</button>
      </section>
      <section className="card">
        <h2>DevOps Page</h2>
        <p style={{ padding: '10px' }}>Configure Org + PAT (saved against your user), then connect.</p>
        <button onClick={onOpenDevOpsPage} disabled={loadingDevopsCredentials}>
          <ButtonLabel loading={loadingDevopsCredentials} idle="Open DevOps Page" busy="Loading DevOps page..." />
        </button>
      </section>
      <section className="card card-accent-emerald">
        <h2>Env Approval Flow</h2>
        <p style={{ padding: '10px' }}>Create environment variable release flows, apply approvals per environment, and rollback from snapshots.</p>
        <button className="btn-success" onClick={onOpenEnvApprovalFlow}>Open Env Approval Flow</button>
      </section>
    </main>
  );
}

export { HomeChoiceView };
