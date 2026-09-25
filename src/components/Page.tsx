import { useEffect, type ReactNode } from 'react';
import { APP_NAME } from '../config/app';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}

export function Page({ title, heading, intro, children, aside, wide }: { title: string; heading?: ReactNode; intro?: ReactNode; children: ReactNode; aside?: ReactNode; wide?: boolean }) {
  usePageTitle(title);
  const head = (
    <header style={{ marginBottom: 'var(--space-5)' }}>
      <h1>{heading ?? title}</h1>
      {intro ? <div className="muted">{intro}</div> : null}
    </header>
  );
  if (aside) {
    return (
      <div className="with-aside">
        <div>
          {head}
          {children}
        </div>
        <aside aria-label="Related">{aside}</aside>
      </div>
    );
  }
  return (
    <div className={wide ? 'page-wide' : 'page'}>
      {head}
      {children}
    </div>
  );
}

export function SimBadge({ label = 'Synthetic training scenario' }: { label?: string }) {
  return <span className="sim-badge">{label}</span>;
}
