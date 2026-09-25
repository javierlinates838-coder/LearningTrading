import { useEffect, useRef } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router';
import { BookOpenText, ChartLineUp, Gear, GraduationCap, Notebook, Target, TrendUp, Warning, WifiSlash, ArrowClockwise, X, CheckCircle } from '@phosphor-icons/react';
import { APP_NAME } from '../config/app';
import { useAppState } from '../state/app';
import { appStore } from '../storage/store';
import { applyUpdate, dismissOfflineReady, dismissRefresh, usePwa } from '../pwa';
import { BrandMark } from './BrandMark';

const NAV = [
  { to: '/', label: 'Learn', icon: GraduationCap, end: true },
  { to: '/practice', label: 'Practice', icon: Target },
  { to: '/simulator', label: 'Simulator', icon: ChartLineUp },
  { to: '/journal', label: 'Journal', icon: Notebook },
  { to: '/progress', label: 'Progress', icon: TrendUp },
];

function NavItems() {
  return (
    <>
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="nav-link">
          {({ isActive }) => (
            <>
              <span className="nav-icon">
                <Icon size={22} weight={isActive ? 'fill' : 'regular'} aria-hidden />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </>
  );
}

function StatusBanners() {
  const { issues, settings } = useAppState();
  const pwa = usePwa();
  return (
    <div className="banner-stack" aria-live="polite">
      {!pwa.online ? (
        <div className="notice notice-info" role="status">
          <WifiSlash size={22} aria-hidden style={{ flex: 'none' }} />
          <div className="notice-body">
            <p>
              <strong>You’re offline.</strong>{' '}
              {pwa.controlled
                ? 'Lessons, practice and the simulator keep working, and progress still saves in this browser.'
                : 'This page keeps working, but offline use isn’t set up on this device yet, so reloading may fail until you’re back online.'}
            </p>
          </div>
        </div>
      ) : null}
      {pwa.needRefresh ? (
        <div className="notice notice-info" role="status">
          <ArrowClockwise size={22} aria-hidden style={{ flex: 'none' }} />
          <div className="notice-body">
            <p>A new version of {APP_NAME} is ready. Your progress is kept when you reload.</p>
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={applyUpdate}>
                Reload to update
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={dismissRefresh}>
                Later
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {pwa.offlineReady && settings.onboarded ? (
        <div className="notice" role="status">
          <CheckCircle size={22} aria-hidden style={{ flex: 'none' }} className="up" />
          <div className="notice-body">
            <p>{APP_NAME} is saved on this device and can open without a connection.</p>
          </div>
          <button type="button" className="icon-btn" onClick={dismissOfflineReady} aria-label="Dismiss">
            <X size={18} aria-hidden />
          </button>
        </div>
      ) : null}
      {issues.map((i) => (
        <div key={i.id} className="notice notice-warn" role="alert">
          <Warning size={22} aria-hidden style={{ flex: 'none' }} className="mastery" />
          <div className="notice-body">
            <p>{i.message}</p>
            <div className="btn-row">
              {i.kind === 'conflict' || i.kind === 'other-tab' || i.kind === 'newer-version' ? (
                <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>
                  Reload
                </button>
              ) : null}
              {i.kind === 'quota' || i.kind === 'unavailable' ? (
                <Link to="/settings#data" className="btn btn-sm">
                  Export a backup
                </Link>
              ) : null}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={() => appStore.dismissIssue(i.id)} aria-label="Dismiss this message">
            <X size={18} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

export function AppShell() {
  const loc = useLocation();
  const { settings } = useAppState();
  const focusMode = loc.pathname.startsWith('/learn/') || loc.pathname.startsWith('/practice/') || (loc.pathname === '/' && !settings.onboarded);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    const heading = document.querySelector<HTMLElement>('#main h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    } else document.getElementById('main')?.focus({ preventScroll: true });
  }, [loc.pathname]);
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <nav className="rail" aria-label="Main">
        <Link to="/" className="brand" aria-label={`${APP_NAME} home`}>
          <BrandMark />
        </Link>
        <NavItems />
        <span className="spacer" />
        <NavLink to="/glossary" className="nav-link">
          <span className="nav-icon">
            <BookOpenText size={22} aria-hidden />
          </span>
          Glossary
        </NavLink>
        <NavLink to="/settings" className="nav-link">
          <span className="nav-icon">
            <Gear size={22} aria-hidden />
          </span>
          Settings
        </NavLink>
      </nav>
      <header className="topbar">
        <Link to="/" className="brand">
          <BrandMark />
          <span>{APP_NAME}</span>
        </Link>
        <span className="sim-badge" title="Everything here uses virtual money">
          Virtual money
        </span>
        <Link to="/glossary" className="icon-btn" aria-label="Glossary">
          <BookOpenText size={22} aria-hidden />
        </Link>
        <Link to="/settings" className="icon-btn" aria-label="Settings">
          <Gear size={22} aria-hidden />
        </Link>
      </header>
      <main id="main" className={`main ${focusMode ? 'focus-mode' : ''}`} tabIndex={-1}>
        <StatusBanners />
        <Outlet />
      </main>
      {!focusMode ? (
        <nav className="bottom-nav" aria-label="Main">
          <NavItems />
        </nav>
      ) : null}
    </div>
  );
}
