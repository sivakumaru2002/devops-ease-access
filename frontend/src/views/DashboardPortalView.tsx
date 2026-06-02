import type { Dispatch, FormEventHandler, SetStateAction } from 'react';

import { ButtonLabel, LoadingMessage } from '../components/Loading';
import type { DashboardItem, DashboardResourceItem, PendingUser, UserRole } from '../types';

type StringSetter = Dispatch<SetStateAction<string>>;

type DashboardPortalViewProps = Readonly<{
  userEmail: string;
  isAdmin: boolean;
  dashboards: DashboardItem[];
  pendingUsers: PendingUser[];
  pendingUserRoles: Record<string, UserRole>;
  selectedDashboardId: string;
  dashboardResources: DashboardResourceItem[];
  filteredDashboardResources: DashboardResourceItem[];
  availableEnvironments: string[];
  selectedEnvironmentFilter: string;
  setSelectedEnvironmentFilter: StringSetter;
  resourceSearchQuery: string;
  setResourceSearchQuery: StringSetter;
  expandedResourceIds: Set<string>;
  portalProject: string;
  setPortalProject: StringSetter;
  portalEnvironment: string;
  setPortalEnvironment: StringSetter;
  portalResourceName: string;
  setPortalResourceName: StringSetter;
  portalResourceUrl: string;
  setPortalResourceUrl: StringSetter;
  portalResourceType: string;
  setPortalResourceType: StringSetter;
  portalResourceNotes: string;
  setPortalResourceNotes: StringSetter;
  editingResourceId: string;
  editProject: string;
  setEditProject: StringSetter;
  editEnvironment: string;
  setEditEnvironment: StringSetter;
  editName: string;
  setEditName: StringSetter;
  editUrl: string;
  setEditUrl: StringSetter;
  editType: string;
  setEditType: StringSetter;
  editNotes: string;
  setEditNotes: StringSetter;
  dashboardName: string;
  setDashboardName: StringSetter;
  dashboardDescription: string;
  setDashboardDescription: StringSetter;
  approvingUserId: string | null;
  loadingDashboards: boolean;
  loadingDashboardResources: boolean;
  loadingCreateDashboardResource: boolean;
  loadingUpdateDashboardResource: boolean;
  loadingCreateDashboard: boolean;
  loadingPendingUsers: boolean;
  onBack: () => void;
  onRefreshDashboards: () => void;
  onSelectDashboard: (dashboardId: string) => void;
  onCreateDashboardResource: FormEventHandler<HTMLFormElement>;
  onRefreshResources: () => void;
  onToggleResourceExpansion: (resourceId: string) => void;
  onStartEditResource: (resource: DashboardResourceItem) => void;
  onUpdateDashboardResource: FormEventHandler<HTMLFormElement>;
  onCancelEditResource: () => void;
  onCreateDashboard: FormEventHandler<HTMLFormElement>;
  onRefreshPendingUsers: () => void;
  onPendingUserRoleChange: (userId: string, role: UserRole) => void;
  onApproveUser: (userId: string, role: UserRole) => void;
}>;

function DashboardPortalView({
  userEmail,
  isAdmin,
  dashboards,
  pendingUsers,
  pendingUserRoles,
  selectedDashboardId,
  dashboardResources,
  filteredDashboardResources,
  availableEnvironments,
  selectedEnvironmentFilter,
  setSelectedEnvironmentFilter,
  resourceSearchQuery,
  setResourceSearchQuery,
  expandedResourceIds,
  portalProject,
  setPortalProject,
  portalEnvironment,
  setPortalEnvironment,
  portalResourceName,
  setPortalResourceName,
  portalResourceUrl,
  setPortalResourceUrl,
  portalResourceType,
  setPortalResourceType,
  portalResourceNotes,
  setPortalResourceNotes,
  editingResourceId,
  editProject,
  setEditProject,
  editEnvironment,
  setEditEnvironment,
  editName,
  setEditName,
  editUrl,
  setEditUrl,
  editType,
  setEditType,
  editNotes,
  setEditNotes,
  dashboardName,
  setDashboardName,
  dashboardDescription,
  setDashboardDescription,
  approvingUserId,
  loadingDashboards,
  loadingDashboardResources,
  loadingCreateDashboardResource,
  loadingUpdateDashboardResource,
  loadingCreateDashboard,
  loadingPendingUsers,
  onBack,
  onRefreshDashboards,
  onSelectDashboard,
  onCreateDashboardResource,
  onRefreshResources,
  onToggleResourceExpansion,
  onStartEditResource,
  onUpdateDashboardResource,
  onCancelEditResource,
  onCreateDashboard,
  onRefreshPendingUsers,
  onPendingUserRoleChange,
  onApproveUser,
}: DashboardPortalViewProps) {
  return (
    <main className="single-page">
      <section className="card">
        <div className="row-between">
          <h2>Dashboard Portal</h2>
          <button className="small btn-secondary" onClick={onBack}>← Back</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>{userEmail}</p>
          <span className={isAdmin ? 'badge badge-admin' : 'badge badge-user'}>
            {isAdmin ? '👑 ADMIN' : '👤 USER'}
          </span>
        </div>
        {!isAdmin ? (
          <p
            className="muted"
            style={{
              padding: '0.75rem',
              background: 'rgba(99, 142, 255, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(99, 142, 255, 0.2)',
            }}
          >
            📋 You have view-only access. Only admins can create dashboards and add resources.
          </p>
        ) : null}
        <button className="small btn-secondary" onClick={onRefreshDashboards} disabled={loadingDashboards}>
          <ButtonLabel loading={loadingDashboards} idle="🔄 Refresh Dashboards" busy="Refreshing dashboards..." />
        </button>
        {loadingDashboards ? (
          <LoadingMessage
            title="Refreshing dashboards"
            detail="Fetching the latest dashboard list and default selection."
            compact
          />
        ) : null}
        {dashboards.length === 0 ? (
          <p className="muted">No dashboards available yet.</p>
        ) : (
          <ul className="resource-list">
            {dashboards.map((dashboard) => (
              <li key={dashboard.id} className="resource-item">
                <strong>{dashboard.name}</strong>
                <p className="muted">{dashboard.description ?? 'No description'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h3>{isAdmin ? '📦 Manage Resources' : '📦 View Resources'}</h3>
        </div>
        <label>Select Dashboard</label>
        <select value={selectedDashboardId} onChange={(event) => onSelectDashboard(event.target.value)}>
          <option value="">Select dashboard</option>
          {dashboards.map((dashboard) => (
            <option key={dashboard.id} value={dashboard.id}>
              {dashboard.name}
            </option>
          ))}
        </select>

        {isAdmin ? (
          <>
            <h4 style={{ marginTop: '1.5rem' }}>➕ Add New Resource</h4>
            <p className="muted">Add resource cards by project and environment (e.g., GPMD → stage/prod/preprod).</p>
            <form className="resource-form" onSubmit={onCreateDashboardResource}>
              <label>Project</label>
              <input
                placeholder="e.g. gpmd"
                value={portalProject}
                onChange={(event) => setPortalProject(event.target.value)}
                required
                disabled={!selectedDashboardId}
              />
              <label>Environment</label>
              <input
                placeholder="stage / prod / preprod"
                value={portalEnvironment}
                onChange={(event) => setPortalEnvironment(event.target.value)}
                required
                disabled={!selectedDashboardId}
              />
              <label>Resource Name</label>
              <input
                placeholder="storage-account-name"
                value={portalResourceName}
                onChange={(event) => setPortalResourceName(event.target.value)}
                required
                disabled={!selectedDashboardId}
              />
              <label>Resource URL</label>
              <input
                placeholder="https://..."
                value={portalResourceUrl}
                onChange={(event) => setPortalResourceUrl(event.target.value)}
                required
                disabled={!selectedDashboardId}
              />
              <label>Resource Type</label>
              <input
                placeholder="e.g., Storage, Database"
                value={portalResourceType}
                onChange={(event) => setPortalResourceType(event.target.value)}
                disabled={!selectedDashboardId}
              />
              <label>Notes</label>
              <input
                placeholder="Optional notes"
                value={portalResourceNotes}
                onChange={(event) => setPortalResourceNotes(event.target.value)}
                disabled={!selectedDashboardId}
              />
              <button type="submit" disabled={loadingCreateDashboardResource || !selectedDashboardId}>
                <ButtonLabel loading={loadingCreateDashboardResource} idle="➕ Add Resource" busy="Adding resource..." />
              </button>
            </form>
          </>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0 }}>📋 Resources in Selected Dashboard</h4>
          {selectedDashboardId && dashboardResources.length > 0 ? (
            <span className="badge badge-user" style={{ fontSize: '0.75rem' }}>
              {filteredDashboardResources.length} {selectedEnvironmentFilter === 'all' ? 'total' : `in ${selectedEnvironmentFilter}`}
            </span>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px' }}>
            <label>🔍 Search Resources</label>
            <input
              type="text"
              placeholder="Search by name, URL, type, or notes..."
              value={resourceSearchQuery}
              onChange={(event) => setResourceSearchQuery(event.target.value)}
              disabled={!selectedDashboardId || dashboardResources.length === 0}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label>Filter by Environment</label>
            <select
              value={selectedEnvironmentFilter}
              onChange={(event) => setSelectedEnvironmentFilter(event.target.value)}
              disabled={!selectedDashboardId || dashboardResources.length === 0}
            >
              <option value="all">🌐 All Environments</option>
              {availableEnvironments.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
          </div>
          <button className="small btn-secondary" onClick={onRefreshResources} disabled={loadingDashboardResources || !selectedDashboardId}>
            <ButtonLabel loading={loadingDashboardResources} idle="🔄 Refresh" busy="Refreshing resources..." />
          </button>
        </div>
        {loadingDashboardResources ? (
          <LoadingMessage
            title="Loading dashboard resources"
            detail="Grouping cards, links, and environment details for the selected dashboard."
            compact
          />
        ) : null}
        {!selectedDashboardId ? (
          <p className="muted">Select a dashboard above to view its resources.</p>
        ) : dashboardResources.length === 0 ? (
          <p className="muted" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(15, 20, 32, 0.4)', borderRadius: '8px' }}>
            📭 No resources added yet for this dashboard.
          </p>
        ) : filteredDashboardResources.length === 0 ? (
          <p className="muted" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(15, 20, 32, 0.4)', borderRadius: '8px' }}>
            🔍 No resources found matching your {resourceSearchQuery ? 'search' : 'filters'}.{' '}
            {resourceSearchQuery
              ? 'Try a different search term.'
              : selectedEnvironmentFilter !== 'all'
                ? `No resources in environment: ${selectedEnvironmentFilter}`
                : ''}
          </p>
        ) : null}
        <div className="table-wrap" style={{ marginTop: '1.5rem' }}>
          <table className="resource-table">
            <thead>
              <tr>
                <th>Resource Name</th>
                <th>Resource Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDashboardResources.map((resource) => (
                <>
                  <tr key={resource.id} className={expandedResourceIds.has(resource.id) ? 'row-expanded' : ''}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong>{resource.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-user" style={{ background: 'rgba(99, 142, 255, 0.1)' }}>
                        {resource.resource_type || 'General'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="small btn-secondary" onClick={() => onToggleResourceExpansion(resource.id)}>
                          {expandedResourceIds.has(resource.id) ? '🔼 Hide' : '🔽 Details'}
                        </button>
                        {isAdmin || resource.owner_email === userEmail ? (
                          <button
                            className="small btn-warning"
                            onClick={() => onStartEditResource(resource)}
                            disabled={loadingUpdateDashboardResource}
                          >
                            ✏️ Edit
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {expandedResourceIds.has(resource.id) ? (
                    <tr key={`${resource.id}-details`} className="details-row">
                      <td colSpan={3}>
                        <div className="resource-details-card">
                          <div className="details-grid-lite">
                            <div className="detail-item">
                              <label>URL</label>
                              <a href={resource.url} target="_blank" rel="noreferrer" className="detail-link">
                                {resource.url}
                              </a>
                            </div>
                            <div className="detail-item">
                              <label>Project</label>
                              <span>{resource.project}</span>
                            </div>
                            <div className="detail-item">
                              <label>Environment</label>
                              <span>{resource.environment}</span>
                            </div>
                          </div>
                          {resource.notes ? (
                            <div className="detail-item" style={{ marginTop: '1rem' }}>
                              <label>Notes</label>
                              <p className="muted">{resource.notes}</p>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {editingResourceId ? (
          <form className="resource-form" onSubmit={onUpdateDashboardResource}>
            <h4>Edit Resource Card</h4>
            <label>Project</label>
            <input value={editProject} onChange={(event) => setEditProject(event.target.value)} required />
            <label>Environment</label>
            <input value={editEnvironment} onChange={(event) => setEditEnvironment(event.target.value)} required />
            <label>Resource Name</label>
            <input value={editName} onChange={(event) => setEditName(event.target.value)} required />
            <label>Resource URL</label>
            <input value={editUrl} onChange={(event) => setEditUrl(event.target.value)} required />
            <label>Resource Type</label>
            <input value={editType} onChange={(event) => setEditType(event.target.value)} />
            <label>Notes</label>
            <input value={editNotes} onChange={(event) => setEditNotes(event.target.value)} />
            <button type="submit" className="btn-success" disabled={loadingUpdateDashboardResource}>
              <ButtonLabel loading={loadingUpdateDashboardResource} idle="💾 Save Changes" busy="Saving changes..." />
            </button>
            <button type="button" className="small btn-secondary" onClick={onCancelEditResource}>❌ Cancel</button>
          </form>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="card">
          <h3>👑 Admin Controls</h3>
          <h4>➕ Create New Dashboard</h4>
          <p className="muted">Create a new dashboard to organize project resources.</p>
          <form onSubmit={onCreateDashboard}>
            <label>Dashboard Name</label>
            <input
              placeholder="e.g., Production Environment"
              value={dashboardName}
              onChange={(event) => setDashboardName(event.target.value)}
              required
            />
            <label>Description (Optional)</label>
            <input
              placeholder="Brief description of this dashboard"
              value={dashboardDescription}
              onChange={(event) => setDashboardDescription(event.target.value)}
            />
            <button type="submit" className="btn-success" disabled={loadingCreateDashboard}>
              <ButtonLabel loading={loadingCreateDashboard} idle="✨ Create Dashboard" busy="Creating dashboard..." />
            </button>
          </form>

          <h4 style={{ marginTop: '2rem' }}>👥 Pending User Approvals</h4>
          <button className="small btn-secondary" onClick={onRefreshPendingUsers} disabled={loadingPendingUsers}>
            <ButtonLabel loading={loadingPendingUsers} idle="🔄 Refresh Pending" busy="Refreshing approvals..." />
          </button>
          {loadingPendingUsers ? (
            <LoadingMessage title="Checking approval queue" detail="Loading the latest pending user registrations." compact />
          ) : null}
          {pendingUsers.length === 0 ? <p className="muted">✅ No pending user approvals.</p> : null}
          <ul className="resource-list">
            {pendingUsers.map((user) => (
              <li key={user.id} className="resource-item">
                <p>
                  <strong>{user.username}</strong> · {user.email}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={pendingUserRoles[user.id] ?? user.role}
                    onChange={(event) => onPendingUserRoleChange(user.id, event.target.value as UserRole)}
                    disabled={approvingUserId === user.id}
                  >
                    <option value="tester">Tester</option>
                    <option value="devops">DevOps</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    className="small btn-success"
                    onClick={() => onApproveUser(user.id, pendingUserRoles[user.id] ?? user.role)}
                    disabled={approvingUserId === user.id}
                  >
                  <ButtonLabel loading={approvingUserId === user.id} idle="✅ Approve" busy="Approving..." />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

export { DashboardPortalView };
