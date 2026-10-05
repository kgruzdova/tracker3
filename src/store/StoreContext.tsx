import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Category, ChatMessage, DB, Reminder, ReminderLogEntry, Settings, Task, TaskStatus } from '../types';
import type { NewTaskInput } from './actions';
import { loadDB, saveDB, clearDB } from './db';
import { buildSeed } from './seed';
import * as actions from './actions';

interface StoreValue {
  db: DB;
  setDB: (updater: DB | ((prev: DB) => DB)) => void;
  replaceDB: (next: DB) => void;
  resetDB: () => void;
  taskActions: {
    add: (input: NewTaskInput) => { task: Task };
    update: (id: string, patch: Partial<Task>) => void;
    remove: (id: string) => void;
    setStatus: (id: string, status: TaskStatus) => void;
    move: (ids: string[], date: string) => void;
    archive: (ids: string[], archived: boolean) => void;
  };
  categoryActions: {
    add: (name: string, color: string) => void;
    update: (id: string, patch: Partial<Category>) => void;
    remove: (id: string) => void;
  };
  moodActions: { upsert: (entry: { date: string; mood: number; stress: number; comment: string }) => void };
  reminderActions: {
    add: (r: Omit<Reminder, 'id' | 'createdAt'>) => void;
    patch: (id: string, patch: Partial<Reminder>) => void;
    log: (entry: ReminderLogEntry) => void;
    clearLog: () => void;
  };
  chatActions: {
    push: (msg: Omit<ChatMessage, 'id' | 'createdAt'>) => void;
    clear: () => void;
  };
  settingsActions: { update: (patch: Partial<Settings>) => void };
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDBState] = useState<DB>(() => loadDB());
  const dbRef = useRef(db);
  dbRef.current = db;

  useEffect(() => {
    saveDB(db);
  }, [db]);

  const setDB = useCallback((updater: DB | ((prev: DB) => DB)) => {
    setDBState((prev) => (typeof updater === 'function' ? (updater as (p: DB) => DB)(prev) : updater));
  }, []);

  const replaceDB = useCallback((next: DB) => setDBState(next), []);

  const resetDB = useCallback(() => {
    clearDB();
    setDBState(buildSeed());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      db,
      setDB,
      replaceDB,
      resetDB,
      taskActions: {
        add: (input) => {
          const res = actions.addTask(dbRef.current, input);
          setDBState(res.db);
          return res;
        },
        update: (id, patch) => setDBState((prev) => actions.withTask(prev, id, patch)),
        remove: (id) => setDBState((prev) => actions.removeTask(prev, id)),
        setStatus: (id, status) => setDBState((prev) => actions.setTaskStatus(prev, id, status)),
        move: (ids, date) => setDBState((prev) => actions.moveTaskToDate(prev, ids, date)),
        archive: (ids, archived) => setDBState((prev) => actions.archiveTasks(prev, ids, archived)),
      },
      categoryActions: {
        add: (name, color) => setDBState((prev) => actions.addCategory(prev, name, color)),
        update: (id, patch) => setDBState((prev) => actions.updateCategory(prev, id, patch)),
        remove: (id) => setDBState((prev) => actions.deleteCategory(prev, id)),
      },
      moodActions: {
        upsert: (entry) => setDBState((prev) => actions.upsertMood(prev, entry)),
      },
      reminderActions: {
        add: (r) => setDBState((prev) => actions.addReminder(prev, r)),
        patch: (id, patch) => setDBState((prev) => actions.patchReminder(prev, id, patch)),
        log: (entry) =>
          setDBState((prev) => ({
            ...prev,
            reminderLog: [...prev.reminderLog, entry].slice(-50),
          })),
        clearLog: () => setDBState((prev) => ({ ...prev, reminderLog: [] })),
      },
      chatActions: {
        push: (msg) => setDBState((prev) => actions.pushMessage(prev, msg)),
        clear: () => setDBState((prev) => actions.clearChat(prev)),
      },
      settingsActions: {
        update: (patch) => setDBState((prev) => actions.updateSettings(prev, patch)),
      },
    }),
    [db, setDB, replaceDB, resetDB],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
