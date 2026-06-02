import type { FormEvent } from "react";
import type { ApplyResult, Flow, Snapshot } from "../types";

interface FlowDashboardPageProps {
  flows: Flow[];
  selectedFlowId: string;
  selectedFlow: Flow | null;
  snapshots: Snapshot[];
  applyResult: ApplyResult | null;
  selectedFlowEnvNames: string[];
  selectedFlowKeys: string[];
  updateKey: string;
  editValues: Record<string, string>;
  updateBy: string;
  approvalBy: string;
  canEditValues: boolean;
  canRollback: boolean;
  editImportEnv: string;
  editImportText: string;
  onSelectedFlowIdChange: (value: string) => void;
  onRefreshFlows: () => void;
  onSubmitUpdateValues: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateKeyChange: (value: string) => void;
  onEditValueChange: (envName: string, value: string) => void;
  onUpdateByChange: (value: string) => void;
  onEditImportEnvChange: (value: string) => void;
  onHandleEditFileImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEditImportTextChange: (value: string) => void;
  onApplyEditorTextImport: () => void;
  onApprovalByChange: (value: string) => void;
  onRunApply: (environmentName?: string) => void;
  onRunRollback: (snapshotId: string) => void;
}

export function FlowDashboardPage({
  flows,
  selectedFlowId,
  selectedFlow,
  snapshots,
  applyResult,
  selectedFlowEnvNames,
  selectedFlowKeys,
  updateKey,
  editValues,
  updateBy,
  approvalBy,
  canEditValues,
  canRollback,
  editImportEnv,
  editImportText,
  onSelectedFlowIdChange,
  onRefreshFlows,
  onSubmitUpdateValues,
  onUpdateKeyChange,
  onEditValueChange,
  onUpdateByChange,
  onEditImportEnvChange,
  onHandleEditFileImport,
  onEditImportTextChange,
  onApplyEditorTextImport,
  onApprovalByChange,
  onRunApply,
  onRunRollback
}: Readonly<FlowDashboardPageProps>) {
  return (
    <section className="card">
      <h2>Flow Dashboard</h2>
      <div className="row">
        <select value={selectedFlowId} onChange={(e) => onSelectedFlowIdChange(e.target.value)}>
          <option value="">Select flow</option>
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.flow_name} - {flow.tags.release_name} ({flow.tags.release_id})
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={onRefreshFlows}>
          Refresh
        </button>
      </div>

      {selectedFlow ? (
        <div className="stack page-stack">
          <div className="subcard">
            <h3>{selectedFlow.flow_name}</h3>
            <p>
              <strong>Resource:</strong> {selectedFlow.resource_type} / {selectedFlow.resource_name ?? "per-environment"}
            </p>
            <p>
              <strong>Release:</strong> {selectedFlow.tags.release_name} ({selectedFlow.tags.release_id})
            </p>
            <p>
              <strong>Environments:</strong> {selectedFlowEnvNames.join(", ")}
            </p>
          </div>

          {canEditValues ? (
            <form onSubmit={onSubmitUpdateValues} className="subcard stack">
              <h3>Add Or Update App Settings</h3>
              <input
                list="known-flow-keys"
                placeholder="Key name (existing or new)"
                value={updateKey}
                onChange={(e) => onUpdateKeyChange(e.target.value)}
                required
              />
              <datalist id="known-flow-keys">
                {selectedFlowKeys.map((key) => (
                  <option key={key} value={key} />
                ))}
              </datalist>
              {selectedFlow.environments.map((env) => (
                <input
                  key={`edit-${env.name}`}
                  placeholder={`${env.name} value`}
                  value={editValues[env.name] ?? ""}
                  onChange={(e) => onEditValueChange(env.name, e.target.value)}
                />
              ))}
              <input
                placeholder="Updated By (email)"
                value={updateBy}
                onChange={(e) => onUpdateByChange(e.target.value)}
                required
              />
              <button type="submit" className="btn">
                Save Key Values
              </button>
              <div className="import-panel stack">
                <div className="row">
                  <select value={editImportEnv} onChange={(e) => onEditImportEnvChange(e.target.value)}>
                    {selectedFlow.environments.map((env) => (
                      <option key={`edit-import-${env.name}`} value={env.name}>
                        Import into {env.name}
                      </option>
                    ))}
                  </select>
                  <input type="file" accept=".env,.json,application/json,text/plain" onChange={onHandleEditFileImport} />
                </div>
                <textarea
                  className="editor-box"
                  placeholder={"Paste .env or JSON here to bulk update one environment."}
                  value={editImportText}
                  onChange={(e) => onEditImportTextChange(e.target.value)}
                />
                <button type="button" className="btn" onClick={onApplyEditorTextImport}>
                  Import Into Selected Environment
                </button>
              </div>
            </form>
          ) : (
            <div className="subcard">
              <h3>Add Or Update App Settings</h3>
              <p>Tester role can only approve/apply existing flow values.</p>
            </div>
          )}

          <div className="subcard stack">
            <h3>Apply / Rollback</h3>
            <input
              placeholder="Approved By (email)"
              value={approvalBy}
              onChange={(e) => onApprovalByChange(e.target.value)}
            />
            <button type="button" className="btn primary" onClick={() => onRunApply()}>
              Apply To Azure
            </button>
            <div className="stack">
              {selectedFlow.environments.map((env) => (
                <button
                  key={`apply-${env.name}`}
                  type="button"
                  className="btn"
                  onClick={() => onRunApply(env.name)}
                >
                  Approve And Apply {env.name}
                </button>
              ))}
            </div>
            {applyResult ? (
              <div className="inline-note status-note">
                Status: {applyResult.status} | Applied: {applyResult.applied_envs.join(", ")} | Failed: {applyResult.failed_envs.join(", ")}
              </div>
            ) : null}
          </div>

          <div className="subcard">
            <h3>Snapshots</h3>
            {snapshots.length === 0 ? (
              <p>No snapshots available.</p>
            ) : (
              <ul className="snapshot-list">
                {snapshots.map((snapshot) => (
                  <li key={snapshot.id}>
                    <div>
                      <strong>{snapshot.snapshot_type}</strong> at {new Date(snapshot.created_at).toLocaleString()}
                    </div>
                    <div>{snapshot.change_reason ?? "No reason"}</div>
                    {canRollback ? (
                      <button type="button" className="btn" onClick={() => onRunRollback(snapshot.id)}>
                        Rollback To This (All Environments)
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p>Select a flow to view details.</p>
      )}
    </section>
  );
}