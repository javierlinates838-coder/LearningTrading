import { ArrowSquareOut } from '@phosphor-icons/react';
import { sourceById } from '../content/sources';
import type { Lesson } from '../content/schema';

export function SourcesDisclosure({ lesson }: { lesson: Lesson }) {
  const sources = lesson.sources.map(sourceById).filter((s) => s !== undefined);
  return (
    <details className="disclosure">
      <summary>Sources and further reading</summary>
      <div className="disclosure-body stack-sm">
        {lesson.contentType !== 'factual' ? (
          <p className="small muted">
            {lesson.contentType === 'interpretive'
              ? 'Chart reading is interpretive. Answers here are graded with an instructor-defined rubric and tolerance, not a single market fact.'
              : 'This lesson uses authored practice scenarios. Decisions are graded on reasoning with an instructor-defined rubric, not on what price did next.'}
          </p>
        ) : null}
        {sources.length ? (
          <ul className="list">
            {sources.map((s) => (
              <li key={s.id} className="small">
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title} <ArrowSquareOut size={14} aria-label="(opens in a new tab)" />
                </a>
                <br />
                <span className="muted">
                  {s.publisher} · checked {s.checkedOn}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted" style={{ marginBottom: 0 }}>
            No external source is cited for this lesson because it teaches a method rather than a market rule.
          </p>
        )}
      </div>
    </details>
  );
}
