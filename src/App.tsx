import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './store/StoreContext';
import { Layout } from './components/Layout';
import { Toasts } from './components/ui';
import { Icon } from './components/Icon';
import { useReminders } from './voice/useReminders';

const Today = lazy(() => import('./pages/Today').then((m) => ({ default: m.Today })));
const Tasks = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })));
const TaskDetail = lazy(() => import('./pages/TaskDetail').then((m) => ({ default: m.TaskDetail })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const MoodPage = lazy(() => import('./pages/Mood').then((m) => ({ default: m.MoodPage })));
const StatsPage = lazy(() => import('./pages/Stats').then((m) => ({ default: m.StatsPage })));
const ChatPage = lazy(() => import('./pages/Chat').then((m) => ({ default: m.ChatPage })));
const CategoriesPage = lazy(() => import('./pages/Categories').then((m) => ({ default: m.CategoriesPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

function ThemeEffect() {
  const { db } = useStore();
  const theme = db.settings.theme;

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0e1118' : '#4f6ef7');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return null;
}

function PageFallback() {
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      Загрузка…
    </div>
  );
}

function ReminderLayer() {
  const { last, snooze, dismiss, unlocked, unlockAudio, supported } = useReminders();
  const [hideBanner, setHideBanner] = useState(false);

  return (
    <>
      {!unlocked && supported && !hideBanner && (
        <div className="reminder-panel">
          <div className="row" style={{ gap: 10 }}>
            <Icon name="volume" size={17} />
            <span style={{ flex: 1 }}>Нажмите, чтобы включить звук</span>
            <button className="btn sm primary" onClick={unlockAudio}>
              Включить
            </button>
            <button className="btn sm ghost" onClick={() => setHideBanner(true)} aria-label="Скрыть">
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
      )}

      {last && (
        <div className="reminder-panel fired">
          <div className="row" style={{ gap: 10 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                background: 'var(--primary-weak)',
                color: 'var(--primary)',
                display: 'grid',
                placeItems: 'center',
                flex: '0 0 36px',
              }}
            >
              <Icon name="speaker" size={19} />
            </span>
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <div className="muted small">
                Напоминание · {last.displayTime}
              </div>
              <strong style={{ overflowWrap: 'anywhere' }}>{last.text}</strong>
            </div>
          </div>
          <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
            <button className="btn sm" onClick={snooze}>
              <Icon name="clock" size={14} /> Отложить на 10 минут
            </button>
            <button className="btn sm primary" onClick={dismiss}>
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Shell() {
  return (
    <>
      <ThemeEffect />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/app/today" replace />} />
          <Route path="/app" element={<Layout />}>
            <Route index element={<Navigate to="today" replace />} />
            <Route path="today" element={<Today />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="mood" element={<MoodPage />} />
            <Route path="stats" element={<StatsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ReminderLayer />
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
