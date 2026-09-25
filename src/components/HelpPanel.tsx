import { useState } from 'react';
import type { Lesson } from '../content/schema';
import { termById } from '../content/glossary';
import { Dialog } from './Dialog';

type Mode = 'simpler' | 'example' | 'terms' | null;

/** Pre-written help for the current lesson. Not a chat and not generated. */
export function HelpPanel({ lesson, open, onClose }: { lesson: Lesson; open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(null);
  const terms = lesson.glossary.map(termById).filter((t) => t !== undefined);
  return (
    <Dialog
      open={open}
      title="Help with this lesson"
      onClose={() => {
        setMode(null);
        onClose();
      }}
    >
      <p className="small muted">Written help for this lesson. It doesn’t change your answers or progress.</p>
      <div className="stack-sm">
        <button type="button" className="btn" aria-expanded={mode === 'simpler'} onClick={() => setMode(mode === 'simpler' ? null : 'simpler')}>
          Explain more simply
        </button>
        {mode === 'simpler' ? <p className="card">{lesson.help.simpler}</p> : null}
        <button type="button" className="btn" aria-expanded={mode === 'example'} onClick={() => setMode(mode === 'example' ? null : 'example')}>
          Show another example
        </button>
        {mode === 'example' ? <p className="card">{lesson.help.example}</p> : null}
        <button type="button" className="btn" aria-expanded={mode === 'terms'} onClick={() => setMode(mode === 'terms' ? null : 'terms')}>
          What does this term mean?
        </button>
        {mode === 'terms' ? (
          <dl className="card stack-sm" style={{ margin: 0 }}>
            {terms.map((t) => (
              <div key={t.id}>
                <dt style={{ fontWeight: 700 }}>{t.term}</dt>
                <dd style={{ margin: 0 }} className="small">
                  {t.short}
                  {t.example ? <span className="muted"> Example: {t.example}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </Dialog>
  );
}
