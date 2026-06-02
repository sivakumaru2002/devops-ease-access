import type { Dispatch, FormEventHandler, SetStateAction } from 'react';

import { ButtonLabel, LoadingMessage } from '../components/Loading';

type StringSetter = Dispatch<SetStateAction<string>>;

type DevOpsLoginViewProps = Readonly<{
  isApproved: boolean;
  organization: string;
  setOrganization: StringSetter;
  pat: string;
  setPat: StringSetter;
  patConfigured: boolean;
  credUpdatedAt: string | null;
  loadingDevopsCredentials: boolean;
  loadingConnectDevops: boolean;
  onBack: () => void;
  onSaveCredentials: FormEventHandler<HTMLFormElement>;
  onConnectDevops: () => void;
}>;

function DevOpsLoginView({
  isApproved,
  organization,
  setOrganization,
  pat,
  setPat,
  patConfigured,
  credUpdatedAt,
  loadingDevopsCredentials,
  loadingConnectDevops,
  onBack,
  onSaveCredentials,
  onConnectDevops,
}: DevOpsLoginViewProps) {
  return (
    <main className="single-page">
      <section className="card login-card">
        <div className="row-between">
          <h2>DevOps Page</h2>
          <button className="small" onClick={onBack}>Back</button>
        </div>
        {!isApproved ? <p className="muted">Waiting for admin approval.</p> : null}
        {loadingDevopsCredentials ? (
          <LoadingMessage title="Preparing DevOps access" detail="Loading your saved organization and PAT status." compact />
        ) : null}
        <form onSubmit={onSaveCredentials}>
          <label>Organization Name</label>
          <input value={organization} onChange={(event) => setOrganization(event.target.value)} required />
          <label>PAT {patConfigured ? '(Update if expired)' : ''}</label>
          <input type="password" value={pat} onChange={(event) => setPat(event.target.value)} required />
          <button type="submit" disabled={loadingDevopsCredentials || !isApproved}>
            <ButtonLabel loading={loadingDevopsCredentials} idle="Save / Update PAT" busy="Saving PAT..." />
          </button>
        </form>
        <p className="muted">PAT configured: {patConfigured ? 'Yes' : 'No'} {credUpdatedAt ? `· Updated: ${credUpdatedAt}` : ''}</p>
        <button onClick={onConnectDevops} disabled={loadingConnectDevops || !isApproved || !patConfigured}>
          <ButtonLabel loading={loadingConnectDevops} idle="Connect to DevOps" busy="Connecting to DevOps..." />
        </button>
      </section>
    </main>
  );
}

export { DevOpsLoginView };
