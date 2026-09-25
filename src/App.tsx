import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { AppShell } from './components/AppShell';
import { BrandMark } from './components/BrandMark';
import { useAppState } from './state/app';
import { Learn } from './screens/Learn';
import { LessonRoute } from './screens/LessonPlayer';
import { Practice, PracticeSession } from './screens/Practice';
import { Simulator } from './screens/Simulator';
import { Journal, JournalDetail } from './screens/Journal';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';
import { Glossary } from './screens/Glossary';
import { Sources } from './screens/Sources';
import { NotFound } from './screens/NotFound';

export function App() {
  const { ready, settings } = useAppState();

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = settings.textScale === 100 ? '' : `${settings.textScale}%`;
    if (settings.motion === 'system') delete root.dataset.motion;
    else root.dataset.motion = settings.motion;
  }, [settings.textScale, settings.motion]);

  if (!ready) {
    return (
      <div className="empty" role="status" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <div className="stack-sm" style={{ justifyItems: 'center' }}>
          <BrandMark size={48} />
          <p className="muted">Loading your progress…</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Learn />} />
        <Route path="learn/:lessonId" element={<LessonRoute />} />
        <Route path="practice" element={<Practice />} />
        <Route path="practice/:mode/:arg?" element={<PracticeSession />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="journal" element={<Journal />} />
        <Route path="journal/:entryId" element={<JournalDetail />} />
        <Route path="progress" element={<Progress />} />
        <Route path="settings" element={<Settings />} />
        <Route path="glossary" element={<Glossary />} />
        <Route path="sources" element={<Sources />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
