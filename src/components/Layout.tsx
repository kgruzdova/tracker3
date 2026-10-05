import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { useStore } from '../store/StoreContext';
import { getMood } from '../store/actions';
import { todayISO } from '../utils/dates';

const LINKS: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/app/today', label: 'Сегодня', icon: 'today' },
  { to: '/app/tasks', label: 'Задачи', icon: 'tasks' },
  { to: '/app/calendar', label: 'Календарь', icon: 'calendar' },
  { to: '/app/mood', label: 'Состояние', icon: 'mood' },
  { to: '/app/stats', label: 'Статистика', icon: 'stats' },
  { to: '/app/chat', label: 'Чат-бот', icon: 'chat' },
  { to: '/app/categories', label: 'Категории', icon: 'tag' },
  { to: '/app/settings', label: 'Настройки', icon: 'settings' },
];

const TITLES: Array<[RegExp, string]> = [
  [/\/app\/tasks\/.+/, 'Задача'],
  [/\/app\/tasks/, 'Задачи'],
  [/\/app\/today/, 'Сегодня'],
  [/\/app\/calendar/, 'Календарь'],
  [/\/app\/mood/, 'Состояние'],
  [/\/app\/stats/, 'Статистика'],
  [/\/app\/chat/, 'Чат-бот'],
  [/\/app\/categories/, 'Категории'],
  [/\/app\/settings/, 'Настройки'],
];

export function Layout() {
  const { db } = useStore();
  const location = useLocation();
  const title = TITLES.find(([re]) => re.test(location.pathname))?.[1] ?? 'Планировщик';
  const checkedIn = Boolean(getMood(db, todayISO()));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">П</span>
          <span>Планировщик</span>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon name={l.icon} />
              <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        {!checkedIn && (
          <NavLink to="/app/mood" className="nav-link" style={{ background: 'var(--warn-weak)', color: 'var(--warn)' }}>
            <Icon name="mood" />
            <span>Отметить состояние</span>
          </NavLink>
        )}
      </aside>

      <div className="main">
        <header className="topbar">
          <strong style={{ fontSize: 16 }}>{title}</strong>
          <div className="row">
            <NavLink to="/app/chat" className="btn sm ghost" title="Чат-бот">
              <Icon name="chat" size={16} /> Бот
            </NavLink>
            <NavLink to="/app/mood" className="btn sm" title="Чек-ин состояния">
              <Icon name="mood" size={16} /> {checkedIn ? 'Состояние' : 'Чек-ин'}
            </NavLink>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav">
        {LINKS.slice(0, 5).map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={l.icon} size={20} />
            <span>{l.label}</span>
          </NavLink>
        ))}
        <NavLink to="/app/chat" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="chat" size={20} />
          <span>Бот</span>
        </NavLink>
        <NavLink to="/app/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="settings" size={20} />
          <span>Ещё</span>
        </NavLink>
      </nav>
    </div>
  );
}
