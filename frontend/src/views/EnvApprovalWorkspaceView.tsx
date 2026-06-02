import type { ChangeEvent, Dispatch, FormEventHandler, SetStateAction } from 'react';

import { ButtonLabel, LoadingMessage } from '../components/Loading';
import type { UserRole } from '../types';
import type {
  EnvApprovalApplyResult,
  EnvApprovalCreateForm,
  EnvApprovalFlow,
  EnvApprovalSnapshot,
  EnvApprovalTemplate,
  EnvApprovalTemplateForm,
} from '../envApproval';

type StringSetter = Dispatch<SetStateAction<string>>;
type TemplateFormSetter = Dispatch<SetStateAction<EnvApprovalTemplateForm>>;
type CreateFormSetter = Dispatch<SetStateAction<EnvApprovalCreateForm>>;

type EnvApprovalWorkspaceViewProps = Readonly<{
  userName: string;
  userRole: UserRole | null;
  isAdmin: boolean;
  canManageTemplates: boolean;
  canManageFlows: boolean;
  canApplyFlows: boolean;
  templates: EnvApprovalTemplate[];
  flows: EnvApprovalFlow[];
  selectedFlowId: string;
  selectedFlow: EnvApprovalFlow | null;
  snapshots: EnvApprovalSnapshot[];
  applyResult: EnvApprovalApplyResult | null;
  templateForm: EnvApprovalTemplateForm;
  setTemplateForm: TemplateFormSetter;
  newTemplateEnvName: string;
  setNewTemplateEnvName: StringSetter;
  createForm: EnvApprovalCreateForm;
  setCreateForm: CreateFormSetter;
  createKeys: string[];
  templateProject: string;
  setTemplateProject: StringSetter;
  templateRepo: string;
  setTemplateRepo: StringSetter;
  newCreateEnvName: string;
  setNewCreateEnvName: StringSetter;
  newCreateKeyName: string;
  setNewCreateKeyName: StringSetter;
  createImportEnv: string;
  setCreateImportEnv: StringSetter;
  createImportText: string;
  setCreateImportText: StringSetter;
  updateKey: string;
  setUpdateKey: StringSetter;
  editValues: Record<string, string>;
  updateBy: string;
  setUpdateBy: StringSetter;
  approvalBy: string;
  setApprovalBy: StringSetter;
  editImportEnv: string;
  setEditImportEnv: StringSetter;
  editImportText: string;
  setEditImportText: StringSetter;
  loadingTemplates: boolean;
  loadingFlows: boolean;
  loadingSaveTemplate: boolean;
  loadingCreateFlow: boolean;
  loadingUpdateValues: boolean;
  loadingApplyFlow: boolean;
  loadingRollbackFlow: boolean;
  onBack: () => void;
  onRefreshTemplates: () => void;
  onSaveTemplate: () => void;
  onEditTemplate: (template: EnvApprovalTemplate) => void;
  onResetTemplateForm: () => void;
  onAddTemplateEnvironment: () => void;
  onRemoveTemplateEnvironment: (envName: string) => void;
  onApplySelectedTemplate: () => void;
  onAddCreateEnvironment: () => void;
  onRemoveCreateEnvironment: (envName: string) => void;
  onAddCreateKeyRow: () => void;
  onRemoveCreateKeyRow: (key: string) => void;
  onSetCreateValue: (envName: string, key: string, value: string) => void;
  onHandleCreateFileImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onApplyCreateTextImport: () => void;
  onCreateFlow: FormEventHandler<HTMLFormElement>;
  onRefreshFlows: () => void;
  onSelectedFlowIdChange: (value: string) => void;
  onEditValueChange: (envName: string, value: string) => void;
  onHandleEditFileImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onApplyEditTextImport: () => void;
  onSubmitUpdateValues: FormEventHandler<HTMLFormElement>;
  onApplyFlow: (environmentName?: string) => void;
  onRollbackFlow: (snapshotId: string) => void;
}>;

function EnvApprovalWorkspaceView({
  userName,
  userRole,
  isAdmin,
  canManageTemplates,
  canManageFlows,
  canApplyFlows,
  templates,
  flows,
  selectedFlowId,
  selectedFlow,
  snapshots,
  applyResult,
  templateForm,
  setTemplateForm,
  newTemplateEnvName,
  setNewTemplateEnvName,
  createForm,
  setCreateForm,
  createKeys,
  templateProject,
  setTemplateProject,
  templateRepo,
  setTemplateRepo,
  newCreateEnvName,
  setNewCreateEnvName,
  newCreateKeyName,
  setNewCreateKeyName,
  createImportEnv,
  setCreateImportEnv,
  createImportText,
  setCreateImportText,
  updateKey,
  setUpdateKey,
  editValues,
  updateBy,
  setUpdateBy,
  approvalBy,
  setApprovalBy,
  editImportEnv,
  setEditImportEnv,
  editImportText,
  setEditImportText,
  loadingTemplates,
  loadingFlows,
  loadingSaveTemplate,
  loadingCreateFlow,
  loadingUpdateValues,
  loadingApplyFlow,
  loadingRollbackFlow,
  onBack,
  onRefreshTemplates,
  onSaveTemplate,
  onEditTemplate,
  onResetTemplateForm,
  onAddTemplateEnvironment,
  onRemoveTemplateEnvironment,
  onApplySelectedTemplate,
  onAddCreateEnvironment,
  onRemoveCreateEnvironment,
  onAddCreateKeyRow,
  onRemoveCreateKeyRow,
  onSetCreateValue,
  onHandleCreateFileImport,
  onApplyCreateTextImport,
  onCreateFlow,
  onRefreshFlows,
  onSelectedFlowIdChange,
  onEditValueChange,
  onHandleEditFileImport,
  onApplyEditTextImport,
  onSubmitUpdateValues,
  onApplyFlow,
  onRollbackFlow,
}: EnvApprovalWorkspaceViewProps) {
  const templateProjects = [...new Set(templates.map((template) => template.project))].sort((left, right) => left.localeCompare(right));
  const reposForSelectedProject = templateProject
    ? templates.filter((template) => template.project === templateProject).sort((left, right) => left.repo.localeCompare(right.repo))
    : [];
  const selectedTemplate = templates.find((template) => template.project === templateProject && template.repo === templateRepo) ?? null;
  const createEnvNames = createForm.environments.map((environment) => environment.name);
  const selectedFlowKeys = selectedFlow
    ? [...new Set(selectedFlow.environments.flatMap((environment) => environment.values.map((value) => value.key)))].sort((left, right) => left.localeCompare(right))
    : [];
  const showTemplateRegistry = userRole !== 'tester';
  const showCreateFlow = userRole !== 'tester';
  const editableTemplate = templates.find((template) => template.project === templateForm.project && template.repo === templateForm.repo) ?? null;

  return (
    <main className="single-page env-approval-page">
      <section className="card env-approval-hero">
        <div className="row-between">
          <div>
            <h2>Env Approval Flow</h2>
            <p className="muted">Use the DevOps Ease Access shell to create reusable templates, build release flows, and approve environment-by-environment promotion.</p>
          </div>
          <button className="small btn-secondary" onClick={onBack}>← Back</button>
        </div>
        <div className="env-approval-summary-grid">
          {showTemplateRegistry ? (
            <article className="env-summary-card">
              <h3>Template Registry</h3>
              <p>{canManageTemplates ? 'Admin and DevOps users can manage shared environment targets and repo mappings.' : 'View the templates admins and DevOps users publish for flow creation.'}</p>
              <strong>{templates.length} templates</strong>
            </article>
          ) : null}
          <article className="env-summary-card">
            <h3>Release Flows</h3>
            <p>Track the environment variable sets tied to Azure release execution.</p>
            <strong>{flows.length} active flows</strong>
          </article>
          <article className="env-summary-card">
            <h3>Approval Operator</h3>
            <p>Current operator: {userName}{userRole ? ` (${userRole})` : ''}</p>
            <strong>{selectedFlow?.flow_name ?? 'No flow selected'}</strong>
          </article>
        </div>
      </section>

      {showTemplateRegistry ? (
        <section className="card">
          <div className="row-between">
            <div>
              <h3>Template Registry</h3>
              <p className="muted">{canManageTemplates ? 'Define a project/repo once, including per-environment target resources.' : 'Admins and DevOps users publish shared templates here for the rest of the workspace.'}</p>
            </div>
            <button className="small btn-secondary" onClick={onRefreshTemplates} disabled={loadingTemplates}>
              <ButtonLabel loading={loadingTemplates} idle="Refresh Templates" busy="Refreshing templates..." />
            </button>
          </div>
          {!canManageTemplates ? <p className="muted">Only admin and DevOps users can create or edit templates. You still have read access to the template catalog.</p> : null}
          {loadingTemplates ? <LoadingMessage title="Loading templates" detail="Fetching the latest saved project and repo mappings." compact /> : null}
          <fieldset disabled={!canManageTemplates}>
            {editableTemplate ? <p className="muted">Editing {editableTemplate.project} / {editableTemplate.repo}. Saving will update this template.</p> : null}
            <div className="row env-input-row">
              <input placeholder="Project" value={templateForm.project} onChange={(event) => setTemplateForm((previous) => ({ ...previous, project: event.target.value }))} />
              <input placeholder="Repository" value={templateForm.repo} onChange={(event) => setTemplateForm((previous) => ({ ...previous, repo: event.target.value }))} />
              <input placeholder="Repository URL" value={templateForm.repo_url} onChange={(event) => setTemplateForm((previous) => ({ ...previous, repo_url: event.target.value }))} />
              <select value={templateForm.resource_type} onChange={(event) => setTemplateForm((previous) => ({ ...previous, resource_type: event.target.value as EnvApprovalCreateForm['resource_type'] }))}>
                <option value="webapp">WebApp</option>
                <option value="function_app">Function App</option>
              </select>
            </div>
            <div className="row env-input-row">
              <input
                placeholder="New template environment"
                value={newTemplateEnvName}
                onChange={(event) => setNewTemplateEnvName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddTemplateEnvironment();
                  }
                }}
              />
              <button type="button" className="small btn-secondary" onClick={onAddTemplateEnvironment}>Add Environment</button>
              <button type="button" className="small btn-secondary" onClick={onResetTemplateForm} disabled={loadingSaveTemplate}>
                New Template
              </button>
              <button type="button" className="small btn-success" onClick={onSaveTemplate} disabled={loadingSaveTemplate || !canManageTemplates}>
                <ButtonLabel loading={loadingSaveTemplate} idle={editableTemplate ? 'Update Template' : 'Save Template'} busy={editableTemplate ? 'Updating template...' : 'Saving template...'} />
              </button>
            </div>
            <div className="table-wrap">
              <table className="resource-table">
                <thead>
                  <tr>
                    <th>Environment</th>
                    <th>Resource Name</th>
                    <th>Resource Group</th>
                    <th>Subscription ID</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {templateForm.environments.map((environment) => (
                    <tr key={`template-${environment.name}`}>
                      <td><strong>{environment.name}</strong></td>
                      <td><input value={environment.resource_name} onChange={(event) => setTemplateForm((previous) => ({ ...previous, environments: previous.environments.map((item) => item.name === environment.name ? { ...item, resource_name: event.target.value } : item) }))} /></td>
                      <td><input value={environment.resource_group} onChange={(event) => setTemplateForm((previous) => ({ ...previous, environments: previous.environments.map((item) => item.name === environment.name ? { ...item, resource_group: event.target.value } : item) }))} /></td>
                      <td><input value={environment.subscription_id} onChange={(event) => setTemplateForm((previous) => ({ ...previous, environments: previous.environments.map((item) => item.name === environment.name ? { ...item, subscription_id: event.target.value } : item) }))} /></td>
                      <td><button type="button" className="small btn-secondary" onClick={() => onRemoveTemplateEnvironment(environment.name)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>
          <div className="subcard-lite">
            <div className="row-between">
              <div>
                <h4>Saved Templates</h4>
                <p className="muted">Load an existing template into the editor to update its environments or repo details.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="resource-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Repository</th>
                    <th>Updated By</th>
                    <th>Updated At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.length ? templates.map((template) => (
                    <tr key={template.id}>
                      <td><strong>{template.project}</strong></td>
                      <td>{template.repo}</td>
                      <td>{template.updated_by}</td>
                      <td>{new Date(template.updated_at).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="small btn-secondary"
                          onClick={() => onEditTemplate(template)}
                          disabled={!canManageTemplates}
                        >
                          Edit Template
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="muted">No templates saved yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

      {showCreateFlow ? (
        <section className="card">
          <div className="row-between">
            <div>
              <h3>Create Flow</h3>
              <p className="muted">Create a release-scoped flow from scratch or start from an admin template.</p>
            </div>
            <button className="small btn-secondary" onClick={onRefreshFlows} disabled={loadingFlows}>
              <ButtonLabel loading={loadingFlows} idle="Refresh Flows" busy="Refreshing flows..." />
            </button>
          </div>
          <form onSubmit={onCreateFlow} className="stack-form">
            {!canManageFlows ? <p className="muted">Only admin and devops users can create flows or update configuration values.</p> : null}
            <fieldset disabled={!canManageFlows}>
          <div className="row env-input-row">
            <input placeholder="Flow Name" value={createForm.flow_name} onChange={(event) => setCreateForm((previous) => ({ ...previous, flow_name: event.target.value }))} required />
            <input placeholder="Repository URL" value={createForm.repo_url} onChange={(event) => setCreateForm((previous) => ({ ...previous, repo_url: event.target.value }))} required />
            <select value={createForm.resource_type} onChange={(event) => setCreateForm((previous) => ({ ...previous, resource_type: event.target.value as EnvApprovalCreateForm['resource_type'] }))}>
              <option value="webapp">WebApp</option>
              <option value="function_app">Function App</option>
            </select>
          </div>
          <div className="row env-input-row">
            <input placeholder="Release Name" value={createForm.tags.release_name} onChange={(event) => setCreateForm((previous) => ({ ...previous, tags: { ...previous.tags, release_name: event.target.value } }))} required />
            <input placeholder="Release ID" value={createForm.tags.release_id} onChange={(event) => setCreateForm((previous) => ({ ...previous, tags: { ...previous.tags, release_id: event.target.value } }))} required />
            <input placeholder="Default Resource Name" value={createForm.resource_name} onChange={(event) => setCreateForm((previous) => ({ ...previous, resource_name: event.target.value }))} />
            <input placeholder="Default Resource Group" value={createForm.resource_group} onChange={(event) => setCreateForm((previous) => ({ ...previous, resource_group: event.target.value }))} />
          </div>
          <div className="subcard-lite">
            <div className="row env-input-row">
              <select value={templateProject} onChange={(event) => setTemplateProject(event.target.value)}>
                <option value="">Select project template</option>
                {templateProjects.map((project) => <option key={project} value={project}>{project}</option>)}
              </select>
              <select value={templateRepo} onChange={(event) => setTemplateRepo(event.target.value)}>
                <option value="">Select repo template</option>
                {reposForSelectedProject.map((template) => <option key={template.id} value={template.repo}>{template.repo}</option>)}
              </select>
              <button type="button" className="small btn-secondary" onClick={onApplySelectedTemplate}>Apply Template</button>
            </div>
            {selectedTemplate ? <p className="muted">Selected template environments: {selectedTemplate.environments.map((environment) => environment.name).join(', ')}</p> : null}
          </div>
          <div className="subcard-lite">
            <div className="row env-input-row">
              <input
                placeholder="New environment"
                value={newCreateEnvName}
                onChange={(event) => setNewCreateEnvName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddCreateEnvironment();
                  }
                }}
              />
              <button type="button" className="small btn-secondary" onClick={onAddCreateEnvironment}>Add Environment</button>
              <input
                placeholder="New key name"
                value={newCreateKeyName}
                onChange={(event) => setNewCreateKeyName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddCreateKeyRow();
                  }
                }}
              />
              <button type="button" className="small btn-secondary" onClick={onAddCreateKeyRow}>Add Key Row</button>
            </div>
            <div className="row env-input-row">
              <select value={createImportEnv} onChange={(event) => setCreateImportEnv(event.target.value)}>
                {createEnvNames.map((environmentName) => <option key={`import-${environmentName}`} value={environmentName}>Import into {environmentName}</option>)}
              </select>
              <input type="file" accept=".env,.json,application/json,text/plain" onChange={onHandleCreateFileImport} />
              <button type="button" className="small btn-secondary" onClick={onApplyCreateTextImport}>Import Variables</button>
            </div>
            <textarea className="env-editor" value={createImportText} onChange={(event) => setCreateImportText(event.target.value)} placeholder="Paste .env or JSON content here to bulk import environment values." />
            <div className="table-wrap">
              <table className="resource-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    {createEnvNames.map((environmentName) => <th key={`create-head-${environmentName}`}>{environmentName}</th>)}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {createKeys.map((key) => (
                    <tr key={key}>
                      <td><strong>{key}</strong></td>
                      {createEnvNames.map((environmentName) => {
                        const environment = createForm.environments.find((candidate) => candidate.name === environmentName);
                        const value = environment?.values.find((entry) => entry.key === key)?.value ?? '';
                        return (
                          <td key={`${environmentName}-${key}`}>
                            <input value={value} onChange={(event) => onSetCreateValue(environmentName, key, event.target.value)} />
                          </td>
                        );
                      })}
                      <td><button type="button" className="small btn-secondary" onClick={() => onRemoveCreateKeyRow(key)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button type="submit" className="btn-success" disabled={loadingCreateFlow || !canManageFlows}>
            <ButtonLabel loading={loadingCreateFlow} idle="Create Flow" busy="Creating flow..." />
          </button>
          </fieldset>
        </form>
        </section>
      ) : null}

      <section className="card">
        <div className="row-between">
          <div>
            <h3>Flow Approval Dashboard</h3>
            <p className="muted">Select a flow, update environment values, approve a rollout, or rollback to a previous snapshot.</p>
          </div>
          <button className="small btn-secondary" onClick={onRefreshFlows} disabled={loadingFlows}>
            <ButtonLabel loading={loadingFlows} idle="Refresh Flow Data" busy="Refreshing flow data..." />
          </button>
        </div>
        <div className="row env-input-row">
          <select value={selectedFlowId} onChange={(event) => onSelectedFlowIdChange(event.target.value)}>
            <option value="">Select flow</option>
            {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.flow_name} • {flow.tags.release_name}</option>)}
          </select>
        </div>
        {selectedFlow ? (
          <>
            <div className="subcard-lite">
              <p><strong>Flow:</strong> {selectedFlow.flow_name}</p>
              <p><strong>Release:</strong> {selectedFlow.tags.release_name} ({selectedFlow.tags.release_id})</p>
              <p><strong>Resource Type:</strong> {selectedFlow.resource_type}</p>
            </div>
            <form onSubmit={onSubmitUpdateValues} className="subcard-lite stack-form">
              {!canManageFlows ? <p className="muted">Tester role is read/apply only. Updating values and rollback require admin or devops.</p> : null}
              <fieldset disabled={!canManageFlows}>
              <div className="row env-input-row">
                <input list="env-flow-keys" placeholder="Key name" value={updateKey} onChange={(event) => setUpdateKey(event.target.value)} required />
                <datalist id="env-flow-keys">
                  {selectedFlowKeys.map((key) => <option key={key} value={key} />)}
                </datalist>
                <input placeholder="Updated By" value={updateBy} onChange={(event) => setUpdateBy(event.target.value)} required />
              </div>
              <div className="row env-input-row env-grid-row">
                {selectedFlow.environments.map((environment) => (
                  <div key={`edit-${environment.name}`} className="env-edit-card">
                    <label>{environment.name}</label>
                    <input value={editValues[environment.name] ?? ''} onChange={(event) => onEditValueChange(environment.name, event.target.value)} />
                  </div>
                ))}
              </div>
              <div className="row env-input-row">
                <select value={editImportEnv} onChange={(event) => setEditImportEnv(event.target.value)}>
                  {selectedFlow.environments.map((environment) => <option key={`edit-import-${environment.name}`} value={environment.name}>{environment.name}</option>)}
                </select>
                <input type="file" accept=".env,.json,application/json,text/plain" onChange={onHandleEditFileImport} />
                <button type="button" className="small btn-secondary" onClick={onApplyEditTextImport}>Import To Environment</button>
              </div>
              <textarea className="env-editor" value={editImportText} onChange={(event) => setEditImportText(event.target.value)} placeholder="Paste .env or JSON content here to update one selected environment." />
              <button type="submit" className="btn-warning" disabled={loadingUpdateValues || !canManageFlows}>
                <ButtonLabel loading={loadingUpdateValues} idle="Save Key Values" busy="Saving values..." />
              </button>
              </fieldset>
            </form>
            <div className="subcard-lite stack-form">
              {!canApplyFlows ? <p className="muted">A valid env-approval role is required to apply flows.</p> : null}
              <fieldset disabled={!canApplyFlows}>
              <div className="row env-input-row">
                <input placeholder="Approved By" value={approvalBy} onChange={(event) => setApprovalBy(event.target.value)} />
                <button type="button" className="small btn-success" onClick={() => onApplyFlow()} disabled={loadingApplyFlow || !canApplyFlows}>
                  <ButtonLabel loading={loadingApplyFlow} idle="Apply All" busy="Applying..." />
                </button>
              </div>
              <div className="env-apply-actions">
                {selectedFlow.environments.map((environment) => (
                  <button key={`apply-${environment.name}`} type="button" className="small btn-secondary" onClick={() => onApplyFlow(environment.name)} disabled={loadingApplyFlow || !canApplyFlows}>
                    Apply {environment.name}
                  </button>
                ))}
              </div>
              </fieldset>
              {applyResult ? <p className="muted">{applyResult.message} Applied: {applyResult.applied_envs.join(', ') || 'none'}.</p> : null}
            </div>
            <div className="subcard-lite">
              <h4>Snapshots</h4>
              {loadingRollbackFlow ? <LoadingMessage title="Restoring snapshot" detail="Reverting the selected flow to the chosen point in history." compact /> : null}
              {snapshots.length === 0 ? (
                <p className="muted">No snapshots available yet.</p>
              ) : (
                <ul className="snapshot-list">
                  {snapshots.map((snapshot) => (
                    <li key={snapshot.id} className="snapshot-item">
                      <div>
                        <strong>{snapshot.snapshot_type}</strong>
                        <p className="muted">{new Date(snapshot.created_at).toLocaleString()} • {snapshot.change_reason ?? 'No reason recorded'}</p>
                      </div>
                      <button type="button" className="small btn-secondary" onClick={() => onRollbackFlow(snapshot.id)} disabled={loadingRollbackFlow || !canManageFlows}>
                        Rollback
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p className="muted">Select a flow to inspect and approve environment updates.</p>
        )}
      </section>
    </main>
  );
}

export { EnvApprovalWorkspaceView };