import { Link } from 'react-router';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { SOURCES } from '../content/sources';
import { LESSONS } from '../content';
import { Page } from '../components/Page';
import { SOURCES_CHECKED_ON } from '../config/app';

export function Sources() {
  return (
    <Page title="Sources" intro={`Factual lessons cite public regulator education pages. Each link was opened and checked on ${SOURCES_CHECKED_ON}.`}>
      <ul className="list" style={{ marginBottom: 'var(--space-6)' }}>
        {SOURCES.map((s) => {
          const used = LESSONS.filter((l) => l.sources.includes(s.id));
          return (
            <li key={s.id} className="card">
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                {s.title} <ArrowSquareOut size={14} aria-label="(opens in a new tab)" />
              </a>
              <p className="small muted" style={{ margin: '4px 0' }}>
                {s.publisher} · checked {s.checkedOn}
              </p>
              {used.length ? (
                <p className="small" style={{ margin: 0 }}>
                  Used in:{' '}
                  {used.map((l, i) => (
                    <span key={l.id}>
                      {i ? ', ' : ''}
                      <Link to={`/learn/${l.id}`}>{l.title}</Link>
                    </span>
                  ))}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <section className="card">
        <h2>How answers are graded</h2>
        <ul className="small">
          <li>Market mechanics (orders, spreads, fees) are graded as facts and cite a source.</li>
          <li>Chart reading (trends, swing points, zones) uses an instructor-defined rubric with a tolerance, because reasonable people draw charts slightly differently.</li>
          <li>Decision scenarios are graded on the reasoning you choose, never on what price did next.</li>
          <li>Rules that change often, such as margin, pattern-day-trading and tax rules, are deliberately not taught here. Check a current official source.</li>
        </ul>
      </section>
    </Page>
  );
}
