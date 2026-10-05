import type { DB } from '../types';
import { DB_VERSION, STORAGE_KEY } from '../types';
import { buildSeed, DEFAULT_CATEGORIES } from './seed';

function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function migrate(raw: unknown): DB {
  if (!isObject(raw)) return buildSeed();

  const seed = buildSeed();
  const rawSettings = isObject(raw.settings) ? raw.settings : {};
  const rawVoice = isObject(rawSettings.voice) ? rawSettings.voice : {};
  const db: DB = {
    version: DB_VERSION,
    tasks: Array.isArray(raw.tasks) ? (raw.tasks as DB['tasks']) : [],
    categories: Array.isArray(raw.categories) && raw.categories.length
      ? (raw.categories as DB['categories'])
      : DEFAULT_CATEGORIES,
    moodEntries: Array.isArray(raw.moodEntries) ? (raw.moodEntries as DB['moodEntries']) : [],
    reminders: Array.isArray(raw.reminders) ? (raw.reminders as DB['reminders']) : [],
    chatMessages: Array.isArray(raw.chatMessages) ? (raw.chatMessages as DB['chatMessages']) : [],
    reminderLog: Array.isArray(raw.reminderLog) ? (raw.reminderLog as DB['reminderLog']) : [],
    settings: {
      ...seed.settings,
      ...rawSettings,
      voice: { ...seed.settings.voice, ...rawVoice },
    } as DB['settings'],
  };

  const catIds = new Set(db.categories.map((c) => c.id));
  if (!catIds.has('cat_none')) {
    db.categories.push({ id: 'cat_none', name: 'Без категории', color: '#8b93a7', isDefault: true });
  }
  db.tasks = db.tasks.map((t) => ({
    ...t,
    categoryId: t.categoryId && catIds.has(t.categoryId) ? t.categoryId : 'cat_none',
    description: t.description ?? '',
    archived: Boolean(t.archived),
    status: t.status ?? 'new',
    repeat: t.repeat ?? 'none',
  }));

  db.version = DB_VERSION;
  return db;
}

export function loadDB(): DB {
  const raw = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!raw) {
    const seed = buildSeed();
    saveDB(seed);
    return seed;
  }
  const db = migrate(raw);
  saveDB(db);
  return db;
}

export function saveDB(db: DB): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    // Quota exceeded — surface a console warning, app keeps working in memory.
    console.warn('Не удалось сохранить данные в localStorage', e);
  }
}

export function clearDB(): void {
  localStorage.removeItem(STORAGE_KEY);
}
