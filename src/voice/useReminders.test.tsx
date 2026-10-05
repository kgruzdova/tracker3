// @vitest-environment jsdom
import { beforeAll, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { DB, Reminder, Task } from '../types';
import { STORAGE_KEY } from '../types';
import { StoreProvider } from '../store/StoreContext';
import { buildSeed } from '../store/seed';
import { pad2 } from '../utils/dates';
import { useReminders, type FiredReminder } from './useReminders';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root | null = null;
let hook: ReturnType<typeof useReminders> | null = null;

function Probe() {
  hook = useReminders();
  return null;
}

function nowLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function seedDB(patch: Partial<DB>): DB {
  const base = buildSeed();
  return { ...base, ...patch };
}

function writeDB(db: DB) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

async function mount(db: DB) {
  writeDB(db);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
    await new Promise((r) => setTimeout(r, 40));
  });
}

async function unmount() {
  if (root) {
    await act(async () => {
      root!.unmount();
    });
    root = null;
  }
  container.remove();
  hook = null;
}

function reminder(id: string, fireAt: string): Reminder {
  return {
    id,
    taskId: null,
    text: 'Напоминание. Позвонить врачу. Время 12:00',
    fireAt,
    offsetMinutes: 0,
    status: 'pending',
    snoozeCount: 0,
    createdAt: new Date().toISOString(),
  };
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
});

it('срабатывает напоминание, попавшее в окно, и пишет журнал', async () => {
  const db = seedDB({ reminders: [reminder('r1', nowLocal())], tasks: [], reminderLog: [] });
  await mount(db);

  const last = hook?.last as FiredReminder | null;
  expect(last).toBeTruthy();
  expect(last!.key).toBe('rem:r1');
  expect(last!.text).toContain('Позвонить врачу');
  expect(hook!.supported).toBe(false);

  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as DB;
  expect(stored.reminderLog).toHaveLength(1);
  expect(stored.reminderLog[0].result).toBe('blocked');
  expect(stored.reminderLog[0].text).toContain('Позвонить врачу');

  await unmount();
});

it('будит задачу с наступившим временем дедлайна', async () => {
  const task: Task = {
    id: 'tw1',
    title: 'Созвон с командой',
    description: '',
    categoryId: 'cat_work',
    priority: 'medium',
    dueDate: nowLocal().slice(0, 10),
    dueTime: nowLocal().slice(11),
    status: 'new',
    repeat: 'none',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    archived: false,
  };
  await mount(seedDB({ tasks: [task], reminders: [], reminderLog: [] }));

  const last = hook?.last as FiredReminder | null;
  expect(last).toBeTruthy();
  expect(last!.key).toBe('task:tw1');
  expect(last!.text).toContain('Созвон с командой');
  expect(last!.text).toContain('Время');

  await unmount();
});

it('не срабатывает дважды и откладывает напоминание на 10 минут', async () => {
  const db = seedDB({ reminders: [reminder('r2', nowLocal())], tasks: [], reminderLog: [] });
  await mount(db);
  expect(hook!.last).toBeTruthy();

  await act(async () => {
    hook!.snooze();
  });
  expect(hook!.last).toBeNull();

  const runtime = JSON.parse(localStorage.getItem('planner_reminder_runtime_v1') as string);
  expect(runtime['rem:r2'].nextAt).toBeGreaterThan(Date.now());

  await unmount();
});

it('не трогает напоминание, срок которого ещё не наступил', async () => {
  const future = new Date(Date.now() + 3600000);
  const fireAt = `${future.getFullYear()}-${pad2(future.getMonth() + 1)}-${pad2(future.getDate())}T${pad2(future.getHours())}:${pad2(future.getMinutes())}`;
  await mount(seedDB({ reminders: [reminder('r3', fireAt)], tasks: [], reminderLog: [] }));

  expect(hook!.last).toBeNull();

  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as DB;
  expect(stored.reminderLog).toHaveLength(0);

  await unmount();
});
