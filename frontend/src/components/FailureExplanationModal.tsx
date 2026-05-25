import { Fragment, type ReactNode } from 'react';

import { LoadingMessage } from './Loading';

function renderInlineMarkdown(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
      }

      return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    });
}

function ExplanationCopy({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) {
      return;
    }

    blocks.push(
      <ul key={`list-${blocks.length}`} className="modal-copy-list">
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      flushList();
      blocks.push(
        <h5 key={`heading-${blocks.length}`} className="modal-copy-heading">
          {renderInlineMarkdown(headingMatch[1])}
        </h5>,
      );
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (bulletMatch || numberedMatch) {
      listItems.push((bulletMatch ?? numberedMatch)![1]);
      return;
    }

    flushList();
    blocks.push(
      <p key={`paragraph-${blocks.length}`} className="modal-copy-paragraph">
        {renderInlineMarkdown(trimmed)}
      </p>,
    );
  });

  flushList();
  return (
    <div className="modal-copy">
      {blocks.length ? blocks : <p className="modal-copy-paragraph">No explanation available.</p>}
    </div>
  );
}

type FailureExplanationModalProps = {
  title: string;
  errorText: string;
  explanationText: string;
  isLoading: boolean;
  onClose: () => void;
};

function FailureExplanationModal({
  title,
  errorText,
  explanationText,
  isLoading,
  onClose,
}: FailureExplanationModalProps) {
  const detailRows = errorText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) {
        return null;
      }

      return {
        label: line.slice(0, separatorIndex).trim(),
        value: line.slice(separatorIndex + 1).trim(),
      };
    })
    .filter((item): item is { label: string; value: string } => item !== null);

  const plainErrorLines = errorText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes(':'));

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="failure-modal-title" onClick={onClose}>
      <section className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="modal-eyebrow">Azure Pipeline Insight</p>
            <h3 id="failure-modal-title">{title}</h3>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close failure explanation">
            Close
          </button>
        </div>

        <div className="modal-layout">
          <section className="modal-panel modal-panel-error">
            <div className="modal-panel-head">
              <span className="modal-panel-icon modal-panel-icon-error" aria-hidden="true" />
              <h4>Error Snapshot</h4>
            </div>
            {isLoading ? (
              <LoadingMessage title="Reading failed task" detail="Pulling pipeline error details for this run." compact />
            ) : null}
            {!isLoading && detailRows.length ? (
              <div className="modal-detail-grid">
                {detailRows.map((item) => (
                  <article key={`${item.label}-${item.value}`} className="modal-detail-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            ) : null}
            {!isLoading && plainErrorLines.length ? (
              <div className="modal-note">
                {plainErrorLines.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            ) : null}
          </section>

          <section className="modal-panel modal-panel-explanation">
            <div className="modal-panel-head">
              <span className="modal-panel-icon modal-panel-icon-success" aria-hidden="true" />
              <h4>Explanation</h4>
            </div>
            {isLoading ? (
              <LoadingMessage
                title="Generating explanation"
                detail="Reviewing the failure cause and preparing a readable summary."
                compact
              />
            ) : (
              <ExplanationCopy text={explanationText} />
            )}
          </section>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export { FailureExplanationModal };
