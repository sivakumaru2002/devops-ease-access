import type { FlowTemplate, ResourceType } from "../types";

interface TemplateEnvironmentForm {
  name: string;
  resource_name: string;
  resource_group: string;
  subscription_id: string;
}

interface TemplateFormState {
  project: string;
  repo: string;
  repo_url: string;
  resource_type: ResourceType;
  saved_by: string;
  environments: TemplateEnvironmentForm[];
}

interface TemplateRegistryPageProps {
  templates: FlowTemplate[];
  templateEditorId: string;
  isEditingTemplate: boolean;
  templateForm: TemplateFormState;
  newTemplateEnvName: string;
  onTemplateEditorIdChange: (value: string) => void;
  onLoadTemplateForEdit: (templateId: string) => void;
  onResetTemplateForm: () => void;
  onTemplateFormChange: (updater: (prev: TemplateFormState) => TemplateFormState) => void;
  onNewTemplateEnvNameChange: (value: string) => void;
  onAddTemplateEnvironment: () => void;
  onSaveTemplate: () => void;
  onSetTemplateEnvTarget: (
    envName: string,
    field: "resource_name" | "resource_group" | "subscription_id",
    value: string
  ) => void;
  onRemoveTemplateEnvironment: (envName: string) => void;
}

export function TemplateRegistryPage({
  templates,
  templateEditorId,
  isEditingTemplate,
  templateForm,
  newTemplateEnvName,
  onTemplateEditorIdChange,
  onLoadTemplateForEdit,
  onResetTemplateForm,
  onTemplateFormChange,
  onNewTemplateEnvNameChange,
  onAddTemplateEnvironment,
  onSaveTemplate,
  onSetTemplateEnvTarget,
  onRemoveTemplateEnvironment
}: Readonly<TemplateRegistryPageProps>) {
  return (
    <section className="card template-registry">
      <h2>Project / Repo Template Registry</h2>
      <p>Define project, repo, resource type, and per-environment resources once. Then use it in Create Flow.</p>
      <div className="stack">
        <div className="subcard stack">
          <h3>Edit Existing Template</h3>
          <div className="row">
            <select value={templateEditorId} onChange={(e) => onTemplateEditorIdChange(e.target.value)}>
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.project} / {template.repo}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => onLoadTemplateForEdit(templateEditorId)}>
              Load Template
            </button>
            <button type="button" className="btn" onClick={onResetTemplateForm}>
              New Template
            </button>
          </div>
        </div>
        <div className="row">
          <input
            placeholder="Project (example: billing-platform)"
            value={templateForm.project}
            onChange={(e) => onTemplateFormChange((p) => ({ ...p, project: e.target.value }))}
          />
          <input
            placeholder="Repo (example: api-service)"
            value={templateForm.repo}
            onChange={(e) => onTemplateFormChange((p) => ({ ...p, repo: e.target.value }))}
          />
          <select
            value={templateForm.resource_type}
            onChange={(e) => onTemplateFormChange((p) => ({ ...p, resource_type: e.target.value as ResourceType }))}
          >
            <option value="webapp">WebApp</option>
            <option value="function_app">Function App</option>
          </select>
        </div>
        <div className="row">
          <input
            placeholder="Repo URL (optional)"
            value={templateForm.repo_url}
            onChange={(e) => onTemplateFormChange((p) => ({ ...p, repo_url: e.target.value }))}
          />
          <input
            placeholder="Saved By (email)"
            value={templateForm.saved_by}
            onChange={(e) => onTemplateFormChange((p) => ({ ...p, saved_by: e.target.value }))}
          />
          <input
            placeholder="New template environment (example: qa)"
            value={newTemplateEnvName}
            onChange={(e) => onNewTemplateEnvNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddTemplateEnvironment();
              }
            }}
          />
          <button type="button" className="btn" onClick={onAddTemplateEnvironment}>
            Add Template Environment
          </button>
          <button type="button" className="btn primary" onClick={onSaveTemplate}>
            {isEditingTemplate ? "Update Template" : "Save Template"}
          </button>
        </div>
        <div className="table-wrap">
          <table className="env-table">
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
              {templateForm.environments.map((env) => (
                <tr key={`template-target-${env.name}`}>
                  <td><strong>{env.name}</strong></td>
                  <td>
                    <input
                      placeholder="Resource name"
                      value={env.resource_name}
                      onChange={(e) => onSetTemplateEnvTarget(env.name, "resource_name", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      placeholder="Resource group"
                      value={env.resource_group}
                      onChange={(e) => onSetTemplateEnvTarget(env.name, "resource_group", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      placeholder="Subscription ID"
                      value={env.subscription_id}
                      onChange={(e) => onSetTemplateEnvTarget(env.name, "subscription_id", e.target.value)}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn" onClick={() => onRemoveTemplateEnvironment(env.name)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}