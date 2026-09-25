import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "./components/AppShell";
import { BrandMark } from "./components/BrandMark";
import { useAppState } from "./state/app";
import { Learn } from "./screens/Learn";
import { LessonRoute } from "./screens/LessonPlayer";
import { NotFound } from "./screens/NotFound";

const Practice = lazy(() =>
  import("./screens/Practice").then((m) => ({ default: m.Practice })),
);
const PracticeSession = lazy(() =>
  import("./screens/Practice").then((m) => ({ default: m.PracticeSession })),
);
const Simulator = lazy(() =>
  import("./screens/Simulator").then((m) => ({ default: m.Simulator })),
);
const Journal = lazy(() =>
  import("./screens/Journal").then((m) => ({ default: m.Journal })),
);
const JournalDetail = lazy(() =>
  import("./screens/Journal").then((m) => ({ default: m.JournalDetail })),
);
const Progress = lazy(() =>
  import("./screens/Progress").then((m) => ({ default: m.Progress })),
);
const Settings = lazy(() =>
  import("./screens/Settings").then((m) => ({ default: m.Settings })),
);
const Glossary = lazy(() =>
  import("./screens/Glossary").then((m) => ({ default: m.Glossary })),
);
const Sources = lazy(() =>
  import("./screens/Sources").then((m) => ({ default: m.Sources })),
);

export function App() {
  const { ready, settings } = useAppState();

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize =
      settings.textScale === 100 ? "" : `${settings.textScale}%`;
    if (settings.motion === "system") delete root.dataset.motion;
    else root.dataset.motion = settings.motion;
  }, [settings.textScale, settings.motion]);

  if (!ready) {
    return (
      <div
        className="empty"
        role="status"
        style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}
      >
        <div className="stack-sm" style={{ justifyItems: "center" }}>
          <BrandMark size={48} />
          <p className="muted">Loading your progress…</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <p
          className="muted"
          role="status"
          style={{ padding: "var(--space-5)" }}
        >
          Loading…
        </p>
      }
    >
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
    </Suspense>
  );
}
