import { Fragment, useId, useState, type ReactNode } from 'react';
import { termById } from '../content/glossary';
import { TERM_PATTERN } from '../content';

function Term({ id, shown }: { id: string; shown?: string }) {
  const [open, setOpen] = useState(false);
  const defId = useId();
  const term = termById(id);
  if (!term) return <>{shown ?? id}</>;
  return (
    <>
      <button type="button" className="term" aria-expanded={open} aria-controls={defId} onClick={() => setOpen((o) => !o)}>
        {shown ?? term.term}
      </button>
      <span id={defId} className="term-def" hidden={!open} role="note">
        <strong>{term.term}:</strong> {term.short}
        {term.example ? <span className="muted"> Example: {term.example}</span> : null}
      </span>
    </>
  );
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TERM_PATTERN)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(<Fragment key={`${keyPrefix}t${k++}`}>{text.slice(last, idx)}</Fragment>);
    out.push(<Term key={`${keyPrefix}g${k++}`} id={m[1]!} shown={m[2]} />);
    last = idx + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={`${keyPrefix}t${k}`}>{text.slice(last)}</Fragment>);
  return out;
}

/** Paragraphs split on blank lines; single newlines become line breaks. Glossary terms expand inline. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n\s*\n/);
  return (
    <div className={`rich ${className ?? ''}`}>
      {paras.map((p, i) => (
        <p key={i}>
          {p.split('\n').map((line, j, arr) => (
            <Fragment key={j}>
              {renderInline(line, `${i}-${j}-`)}
              {j < arr.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

export function InlineText({ text }: { text: string }) {
  return <>{renderInline(text, 'i-')}</>;
}
