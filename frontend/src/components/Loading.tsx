import type { ReactNode } from 'react';

type SpinnerProps = Readonly<{
  className?: string;
}>;

type ButtonLabelProps = Readonly<{
  loading: boolean;
  idle: ReactNode;
  busy: string;
}>;

type LoadingMessageProps = Readonly<{
  title: string;
  detail: string;
  compact?: boolean;
}>;

function Spinner({ className = '' }: SpinnerProps) {
  return <span className={`spinner ${className}`.trim()} aria-hidden="true" />;
}

function ButtonLabel({ loading, idle, busy }: ButtonLabelProps) {
  return (
    <span className="button-label">
      {loading ? (
        <>
          <Spinner className="spinner-inline" />
          <span>{busy}</span>
        </>
      ) : idle}
    </span>
  );
}

function LoadingMessage({
  title,
  detail,
  compact = false,
}: LoadingMessageProps) {
  return (
    <div className={`loader-card${compact ? ' loader-card-compact' : ''}`} role="status" aria-live="polite">
      <div className="loader-orb">
        <Spinner />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

export { ButtonLabel, LoadingMessage, Spinner };
