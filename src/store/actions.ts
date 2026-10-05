import type { Category, ChatMessage, DB, MoodEntry, Reminder, Settings, Task } from '../types';
import type { Priority, Repeat, TaskStatus } from '../types';
import { todayISO, addDaysISO } from '../utils/dates';
import { uid } from './seed';

export interface NewTaskInput {
  title: string;
  description?: string;
  categoryId?: string | null;
  priority?: Priority;
  dueDate?: string;
  dueTime?: string | null;
  status?: TaskStatus;
  repeat?: Repeat;
}

export function createTask(db: DB, input: NewTaskInput): Task {
  const now = new Date().toISOString();
  return {
    id: uid('task'),
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    categoryId: input.categoryId ?? 'cat_none',
    priority: input.priority ?? 'medium',
    dueDate: input.dueDate ?? todayISO(),
    dueTime: input.dueTime ?? null,
    status: input.status ?? 'new',
    repeat: input.repeat ?? 'none',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archived: false,
  };
}

export function nextRepeatDate(task: Task): string {
  return task.repeat === 'daily'
    ? addDaysISO(task.dueDate, 1)
    : addDaysISO(task.dueDate, 7);
}

export function withTask(db: DB, id: string, patch: Partial<Task>): DB {
  return {
    ...db,
    tasks: db.tasks.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)),
  };
}

export function addTask(db: DB, input: NewTaskInput): { db: DB; task: Task } {
  const task = createTask(db, input);
  return { db: { ...db, tasks: [...db.tasks, task] }, task };
}

export function removeTask(db: DB, id: string): DB {
  return { ...db, tasks: db.tasks.filter((t) => t.id !== id), reminders: db.reminders.filter((r) => r.taskId !== id) };
}

export function setTaskStatus(db: DB, id: string, status: TaskStatus): DB {
  const task = db.tasks.find((t) => t.id === id);
  if (!task) return db;
  const now = new Date().toISOString();
  const patch: Partial<Task> = { status, updatedAt: now };
  if (status === 'done') {
    patch.completedAt = now;
    patch.archived = task.repeat !== 'none' ? false : task.archived;
  } else if (status === 'new' || status === 'in_progress') {
    patch.completedAt = null;
    patch.archived = false;
  }
  let next = withTask(db, id, patch);

  if (status === 'done' && task.repeat !== 'none' && task.dueDate === todayISO()) {
    const clone = createTask(next, {
      title: task.title,
      description: task.description,
      categoryId: task.categoryId,
      priority: task.priority,
      dueDate: nextRepeatDate(task),
      dueTime: task.dueTime,
      repeat: task.repeat,
      status: 'new',
    });
    next = { ...next, tasks: [...next.tasks, clone] };
  }
  return next;
}

export function moveTaskToDate(db: DB, ids: string[], date: string): DB {
  const set = new Set(ids);
  return {
    ...db,
    tasks: db.tasks.map((t) => (set.has(t.id) ? { ...t, dueDate: date, updatedAt: new Date().toISOString() } : t)),
  };
}

export function archiveTasks(db: DB, ids: string[], archived: boolean): DB {
  const set = new Set(ids);
  return { ...db, tasks: db.tasks.map((t) => (set.has(t.id) ? { ...t, archived } : t)) };
}

export function addCategory(db: DB, name: string, color: string): DB {
  const cat: Category = { id: uid('cat'), name: name.trim(), color, isDefault: false };
  return { ...db, categories: [...db.categories, cat] };
}

export function updateCategory(db: DB, id: string, patch: Partial<Category>): DB {
  return { ...db, categories: db.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) };
}

export function deleteCategory(db: DB, id: string): DB {
  if (id === 'cat_none') return db;
  return {
    ...db,
    categories: db.categories.filter((c) => c.id !== id),
    tasks: db.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: 'cat_none' } : t)),
  };
}

export function upsertMood(db: DB, entry: Omit<MoodEntry, 'createdAt'>): DB {
  const exists = db.moodEntries.some((m) => m.date === entry.date);
  const merged: MoodEntry = { ...entry, createdAt: new Date().toISOString() };
  const moodEntries = exists
    ? db.moodEntries.map((m) => (m.date === entry.date ? merged : m))
    : [...db.moodEntries, merged];
  return { ...db, moodEntries };
}

export function getMood(db: DB, date: string): MoodEntry | null {
  return db.moodEntries.find((m) => m.date === date) ?? null;
}

export function addReminder(db: DB, reminder: Omit<Reminder, 'id' | 'createdAt'>): DB {
  const r: Reminder = { ...reminder, id: uid('rem'), createdAt: new Date().toISOString() };
  return { ...db, reminders: [...db.reminders, r] };
}

export function patchReminder(db: DB, id: string, patch: Partial<Reminder>): DB {
  return { ...db, reminders: db.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

export function pushMessage(db: DB, msg: Omit<ChatMessage, 'id' | 'createdAt'>): DB {
  const message: ChatMessage = { ...msg, id: uid('msg'), createdAt: new Date().toISOString() };
  const chatMessages = [...db.chatMessages, message].slice(-100);
  return { ...db, chatMessages };
}

export function clearChat(db: DB): DB {
  return { ...db, chatMessages: [] };
}

export function updateSettings(db: DB, patch: Partial<Settings>): DB {
  return { ...db, settings: { ...db.settings, ...patch, voice: { ...db.settings.voice, ...(patch.voice ?? {}) } } };
}
