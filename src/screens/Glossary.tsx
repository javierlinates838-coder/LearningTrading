import { useId, useState } from 'react';
import { GLOSSARY } from '../content/glossary';
import { Page } from '../components/Page';

export function Glossary() {
  const [q, setQ] = useState('');
  const id = useId();
  const needle = q.trim().toLowerCase();
  const terms = [...GLOSSARY]
    .sort((a, b) => a.term.localeCompare(b.term))
    .filter((t) => !needle || t.term.toLowerCase().includes(needle) || t.short.toLowerCase().includes(needle));
  return (
    <Page title="Glossary" intro="Plain-language definitions of every term used in the lessons.">
      <div className="field" style={{ marginBottom: 'var(--space-4)' }}>
        <label htmlFor={id}>Search terms</label>
        <input id={id} className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      <p className="small muted" aria-live="polite">
        {terms.length} term{terms.length === 1 ? '' : 's'}
      </p>
      {terms.length ? (
        <dl className="stack-sm">
          {terms.map((t) => (
            <div key={t.id} id={t.id} className="card">
              <dt style={{ fontWeight: 700 }}>{t.term}</dt>
              <dd style={{ margin: 0 }}>
                {t.short}
                {t.example ? (
                  <p className="small muted" style={{ margin: '6px 0 0' }}>
                    Example: {t.example}
                  </p>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="empty">No terms match “{q}”. Try a shorter word.</p>
      )}
    </Page>
  );
}
