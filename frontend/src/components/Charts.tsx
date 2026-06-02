function VerticalBars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <div className="bars" role="img" aria-label={title}>
        {entries.map(([label, value]) => (
          <div key={label} className="bar-item" title={`${label}: ${value}`}>
            <div className="bar" style={{ height: `${Math.max((value / max) * 100, 6)}%` }} />
            <p className="bar-value">{value}</p>
            <p className="bar-label">{label}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function HorizontalBars({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((left, right) => right[1] - left[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  return (
    <article className="chart-card">
      <h3>{title}</h3>
      <ul className="hbar-list" aria-label={title}>
        {entries.map(([label, value]) => (
          <li key={label}>
            <div className="hbar-head">
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function SuccessFailureGraph({ success = 0, failure = 0 }: { success?: number; failure?: number }) {
  const total = Math.max(success + failure, 1);
  const successPct = Math.round((success / total) * 100);
  const failPct = 100 - successPct;

  return (
    <article className="chart-card">
      <h3>Success vs Failure Rate</h3>
      <div className="stacked" role="img" aria-label="Success and failure ratio">
        <div className="stack-ok" style={{ width: `${successPct}%` }} />
        <div className="stack-fail" style={{ width: `${failPct}%` }} />
      </div>
      <p className="muted">
        Success: {success} ({successPct}%) · Failure: {failure} ({failPct}%)
      </p>
    </article>
  );
}

export { HorizontalBars, SuccessFailureGraph, VerticalBars };
