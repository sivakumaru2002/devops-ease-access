type AppPage = "dashboard" | "templates" | "create-flow" | "flows" | "users" | "account";

interface DashboardPageProps {
  role: "admin" | "devops" | "tester";
  flowCount: number;
  templateCount: number;
  selectedFlowName: string;
  onNavigate: (page: AppPage) => void;
}

export function DashboardPage({ role, flowCount, templateCount, selectedFlowName, onNavigate }: DashboardPageProps) {
  return (
    <section className="stack page-stack">
      <section className="card dashboard-hero-card">
        <div className="stack">
          <h2>Workspace Dashboard</h2>
          <p>Use separate pages for template setup, flow creation, and approval operations.</p>
        </div>
      </section>

      <section className="dashboard-grid">
        {(role === "admin" || role === "devops") ? (
          <article className="card nav-card">
            <h3>Template Registry</h3>
            <p>Manage reusable project and repo environment definitions.</p>
            <div className="stat">{templateCount} templates saved</div>
            <button type="button" className="btn primary" onClick={() => onNavigate("templates")}>
              Open Templates
            </button>
          </article>
        ) : null}

        {(role === "admin" || role === "devops") ? (
          <article className="card nav-card">
            <h3>Create Flow</h3>
            <p>Create a new flow using only required fields and optional saved templates.</p>
            <div className="stat">{flowCount} flows available</div>
            <button type="button" className="btn primary" onClick={() => onNavigate("create-flow")}>
              Open Flow Creation
            </button>
          </article>
        ) : null}

        <article className="card nav-card">
          <h3>Flow Approval</h3>
          <p>Review flows, update variables, approve apply, and perform rollback from snapshots.</p>
          <div className="stat">{selectedFlowName || "No flow selected"}</div>
          <button type="button" className="btn primary" onClick={() => onNavigate("flows")}>
            Open Flow Dashboard
          </button>
        </article>

        {role === "admin" ? (
          <article className="card nav-card">
            <h3>User Management</h3>
            <p>Create users, assign roles, and manage access for the application.</p>
            <div className="stat">Admin only</div>
            <button type="button" className="btn primary" onClick={() => onNavigate("users")}>
              Open User Management
            </button>
          </article>
        ) : null}

        <article className="card nav-card">
          <h3>My Account</h3>
          <p>Change your own password without admin help.</p>
          <div className="stat">Self service</div>
          <button type="button" className="btn primary" onClick={() => onNavigate("account")}>
            Open Account
          </button>
        </article>
      </section>
    </section>
  );
}