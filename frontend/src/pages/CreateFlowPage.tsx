import type { FormEvent } from "react";
import type { CreateFlowPayload, FlowTemplate } from "../types";

interface CreateFlowPageProps {
  createForm: CreateFlowPayload;
  createKeys: string[];
  createEnvNames: string[];
  createImportEnv: string;
  createImportText: string;
  templateProject: string;
  templateRepo: string;
  templateProjects: string[];
  reposForSelectedProject: FlowTemplate[];
  selectedTemplate: FlowTemplate | null;
  appliedTemplateName: string;
  isEnvironmentLocked: boolean;
  newCreateEnvName: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCreateFormChange: (updater: (prev: CreateFlowPayload) => CreateFlowPayload) => void;
  onTemplateProjectChange: (value: string) => void;
  onTemplateRepoChange: (value: string) => void;
  onApplySelectedTemplate: () => void;
  onNewCreateEnvNameChange: (value: string) => void;
  onAddCreateEnvironment: () => void;
  onRemoveCreateEnvironment: (envName: string) => void;
  onAddCreateKeyRow: () => void;
  onCreateImportEnvChange: (value: string) => void;
  onCreateImportTextChange: (value: string) => void;
  onHandleCreateFileImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyCreateTextImport: () => void;
  onSetCreateValue: (envName: string, key: string, value: string) => void;
  onRemoveCreateKeyRow: (key: string) => void;
}

export function CreateFlowPage({
  createForm,
  createKeys,
  createEnvNames,
  createImportEnv,
  createImportText,
  templateProject,
  templateRepo,
  templateProjects,
  reposForSelectedProject,
  selectedTemplate,
  appliedTemplateName,
  isEnvironmentLocked,
  newCreateEnvName,
  onSubmit,
  onCreateFormChange,
  onTemplateProjectChange,
  onTemplateRepoChange,
  onApplySelectedTemplate,
  onNewCreateEnvNameChange,
  onAddCreateEnvironment,
  onRemoveCreateEnvironment,
  onAddCreateKeyRow,
  onCreateImportEnvChange,
  onCreateImportTextChange,
  onHandleCreateFileImport,
  onApplyCreateTextImport,
  onSetCreateValue,
  onRemoveCreateKeyRow
}: Readonly<CreateFlowPageProps>) {
  return (
    <section className="card">
      <h2>Create Flow</h2>
      <div className="subcard stack">
        <h3>Create Flow Process</h3>
        <ol className="process-list">
          <li>Choose a saved template by Project and Repo (optional).</li>
          <li>Set required flow details.</li>
          <li>Provide required Release Name and Release ID.</li>
          <li>Add or adjust environments and variables.</li>
          <li>Create flow.</li>
        </ol>
      </div>
      <form onSubmit={onSubmit} className="stack">
        <input
          placeholder="Flow Name"
          value={createForm.flow_name}
          onChange={(e) => onCreateFormChange((p) => ({ ...p, flow_name: e.target.value }))}
          required
        />
        <input
          placeholder="Repo URL"
          value={createForm.repo_url}
          onChange={(e) => onCreateFormChange((p) => ({ ...p, repo_url: e.target.value }))}
          required
        />
        <select
          value={createForm.resource_type}
          onChange={(e) => onCreateFormChange((p) => ({ ...p, resource_type: e.target.value as CreateFlowPayload["resource_type"] }))}
        >
          <option value="webapp">WebApp</option>
          <option value="function_app">Function App</option>
        </select>
        <div className="row">
          <input
            placeholder="Release Name"
            value={createForm.tags.release_name}
            onChange={(e) => onCreateFormChange((p) => ({ ...p, tags: { ...p.tags, release_name: e.target.value } }))}
            required
          />
          <input
            placeholder="Release ID"
            value={createForm.tags.release_id}
            onChange={(e) => onCreateFormChange((p) => ({ ...p, tags: { ...p.tags, release_id: e.target.value } }))}
            required
          />
        </div>
        <input
          placeholder="Created By (email)"
          value={createForm.created_by}
          onChange={(e) => onCreateFormChange((p) => ({ ...p, created_by: e.target.value }))}
          required
        />

        <div className="subcard stack">
          <h3>Use Saved Template</h3>
          <div className="row">
            <select value={templateProject} onChange={(e) => onTemplateProjectChange(e.target.value)}>
              <option value="">Select project</option>
              {templateProjects.map((project) => (
                <option key={`tpl-project-${project}`} value={project}>
                  {project}
                </option>
              ))}
            </select>
            <select value={templateRepo} onChange={(e) => onTemplateRepoChange(e.target.value)}>
              <option value="">Select repo</option>
              {reposForSelectedProject.map((template) => (
                <option key={`tpl-repo-${template.id}`} value={template.repo}>
                  {template.repo}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={onApplySelectedTemplate}>
              Apply Template
            </button>
          </div>
          {selectedTemplate ? (
            <div className="inline-note template-note">
              Template environments: {selectedTemplate.environments.map((env) => env.name).join(", ")}
            </div>
          ) : null}
          {isEnvironmentLocked ? (
            <div className="form-note">
              Environments are locked from template {appliedTemplateName}. Edit them only in the Templates page.
            </div>
          ) : null}
        </div>

        <div className="subcard stack">
          <div className="row">
            <h3>Environments</h3>
            <input
              placeholder="New environment (example: qa)"
              value={newCreateEnvName}
              disabled={isEnvironmentLocked}
              onChange={(e) => onNewCreateEnvNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddCreateEnvironment();
                }
              }}
            />
            <button type="button" className="btn" onClick={onAddCreateEnvironment} disabled={isEnvironmentLocked}>
              Add Environment
            </button>
          </div>
          <div className="table-wrap">
            <table className="env-table compact-table">
              <thead>
                <tr>
                  <th>Environment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {createForm.environments.map((env) => (
                  <tr key={`target-row-${env.name}`}>
                    <td><strong>{env.name}</strong></td>
                    <td>
                      <button type="button" className="btn" onClick={() => onRemoveCreateEnvironment(env.name)} disabled={isEnvironmentLocked}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="subcard stack">
          <div className="row">
            <h3>Environment Variables</h3>
            <button type="button" className="btn" onClick={onAddCreateKeyRow}>
              Add Key Row
            </button>
          </div>
          <div className="import-panel stack">
            <div className="row">
              <select value={createImportEnv} onChange={(e) => onCreateImportEnvChange(e.target.value)}>
                {createEnvNames.map((envName) => (
                  <option key={`create-import-${envName}`} value={envName}>
                    Import into {envName}
                  </option>
                ))}
              </select>
              <input type="file" accept=".env,.json,application/json,text/plain" onChange={onHandleCreateFileImport} />
            </div>
            <textarea
              className="editor-box"
              placeholder={'Paste .env or JSON here, for example:\nDB_CONNECTION=server\nLOG_LEVEL=debug\n\n{"API_URL":"https://example"}'}
              value={createImportText}
              onChange={(e) => onCreateImportTextChange(e.target.value)}
            />
            <button type="button" className="btn" onClick={onApplyCreateTextImport}>
              Import Pasted Variables
            </button>
          </div>
          <div className="table-wrap">
            <table className="env-table">
              <thead>
                <tr>
                  <th>Key</th>
                  {createEnvNames.map((envName) => (
                    <th key={`hdr-${envName}`}>{envName}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {createKeys.map((key) => (
                  <tr key={`value-row-${key}`}>
                    <td><strong>{key}</strong></td>
                    {createEnvNames.map((envName) => {
                      const env = createForm.environments.find((candidate) => candidate.name === envName);
                      const current = env?.values.find((value) => value.key === key)?.value ?? "";
                      return (
                        <td key={`${envName}-${key}`}>
                          <input
                            placeholder={`${envName} value`}
                            value={current}
                            onChange={(e) => onSetCreateValue(envName, key, e.target.value)}
                          />
                        </td>
                      );
                    })}
                    <td>
                      <button type="button" className="btn" onClick={() => onRemoveCreateKeyRow(key)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <button type="submit" className="btn primary">
          Create Flow
        </button>
      </form>
    </section>
  );
}