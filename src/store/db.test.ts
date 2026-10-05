import { describe, expect, it } from 'vitest';
import { migrate } from './db';
import { buildSeed, DEFAULT_CATEGORIES } from './seed';
import { DB_VERSION } from '../types';

describe('migrate', () => {
  it('возвращает сид для не-объекта', () => {
    expect(migrate(null).tasks.length).toBe(buildSeed().tasks.length);
    expect(migrate('строка').categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(migrate([1, 2]).version).toBe(DB_VERSION);
  });

  it('заполняет пустой объект дефолтами', () => {
    const db = migrate({});
    expect(db.tasks).toEqual([]);
    expect(db.categories.map((c) => c.id)).toContain('cat_none');
    expect(db.settings.dailyTaskLimit).toBe(5);
    expect(db.settings.voice.rate).toBe(1);
    expect(db.reminderLog).toEqual([]);
  });

  it('сохраняет данные импорта и чинит ссылки на категории', () => {
    const seed = buildSeed();
    const imported = {
      ...seed,
      tasks: [
        {
          id: 't1',
          title: 'Импортная',
          categoryId: 'cat_deleted',
          dueDate: '2026-01-01',
          priority: 'low',
          dueTime: '10:00',
        },
      ],
      categories: [
        { id: 'cat_custom', name: 'Своя', color: '#123456', isDefault: false },
        { id: 'cat_none', name: 'Без категории', color: '#8b93a7', isDefault: true },
      ],
      settings: { theme: 'dark', dailyTaskLimit: 7, voice: { rate: 1.5 } },
      chatMessages: [{ id: 'm1', role: 'bot', text: 'привет', createdAt: '2026-01-01T00:00:00.000Z' }],
    };

    const db = migrate(imported);

    expect(db.tasks).toHaveLength(1);
    expect(db.tasks[0].categoryId).toBe('cat_none');
    expect(db.tasks[0].description).toBe('');
    expect(db.tasks[0].status).toBe('new');
    expect(db.tasks[0].repeat).toBe('none');
    expect(db.tasks[0].archived).toBe(false);
    expect(db.categories).toHaveLength(2);
    expect(db.categories.some((c) => c.id === 'cat_custom')).toBe(true);
    expect(db.settings.theme).toBe('dark');
    expect(db.settings.dailyTaskLimit).toBe(7);
    expect(db.settings.voice.rate).toBe(1.5);
    expect(db.settings.voice.volume).toBe(100);
    expect(db.chatMessages).toHaveLength(1);
    expect(db.version).toBe(DB_VERSION);
  });

  it('сохраняет существующую категорию задачи', () => {
    const db = migrate({
      categories: [
        { id: 'cat_none', name: 'Без категории', color: '#8b93a7', isDefault: true },
        { id: 'cat_keep', name: 'Оставляем', color: '#000000', isDefault: false },
      ],
      tasks: [{ id: 't1', title: 'x', dueDate: '2026-01-01', priority: 'high', categoryId: 'cat_keep' }],
    });
    expect(db.tasks[0].categoryId).toBe('cat_keep');
    expect(db.tasks[0].priority).toBe('high');
  });
});

describe('buildSeed', () => {
  it('создаёт 8 категорий, задачи и чек-ины за 7 дней', () => {
    const db = buildSeed();
    expect(db.categories).toHaveLength(8);
    expect(db.tasks.length).toBeGreaterThanOrEqual(5);
    expect(db.tasks.length).toBeLessThanOrEqual(7);
    expect(db.moodEntries).toHaveLength(7);
    expect(db.settings.dailyTaskLimit).toBe(5);
    expect(db.chatMessages).toEqual([]);
  });

  it('категории сида не разделяются с константой', () => {
    const db = buildSeed();
    db.categories.push({ id: 'tmp', name: 'tmp', color: '#fff', isDefault: false });
    expect(buildSeed().categories).toHaveLength(8);
    expect(DEFAULT_CATEGORIES).toHaveLength(8);
  });
});
