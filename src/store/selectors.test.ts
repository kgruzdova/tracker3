import { describe, expect, it } from 'vitest';
import type { DB, Task } from '../types';
import { buildSeed } from './seed';
import { categoryStats, completedByDay, currentStreak, dayProgress, isOverdue, overdueTasks, tasksOnDate } from './selectors';
import { addDaysISO, todayISO } from '../utils/dates';

function task(partial: Partial<Task> & Pick<Task, 'id' | 'title' | 'dueDate'>): Task {
  const now = new Date().toISOString();
  return {
    description: '',
    categoryId: 'cat_work',
    priority: 'medium',
    dueTime: null,
    status: 'new',
    repeat: 'none',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    archived: false,
    ...partial,
  };
}

function dbWith(tasks: Task[]): DB {
  const seed = buildSeed();
  return { ...seed, tasks };
}

describe('dayProgress', () => {
  it('считает выполненные из активных задач дня', () => {
    const t = todayISO();
    const db = dbWith([
      task({ id: '1', title: 'a', dueDate: t, status: 'done' }),
      task({ id: '2', title: 'b', dueDate: t, status: 'in_progress' }),
      task({ id: '3', title: 'c', dueDate: t, status: 'new' }),
    ]);
    expect(dayProgress(db)).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it('исключает отменённые и архивные задачи', () => {
    const t = todayISO();
    const db = dbWith([
      task({ id: '1', title: 'a', dueDate: t, status: 'done' }),
      task({ id: '2', title: 'b', dueDate: t, status: 'cancelled' }),
      task({ id: '3', title: 'c', dueDate: t, archived: true }),
      task({ id: '4', title: 'd', dueDate: addDaysISO(t, 1), status: 'done' }),
    ]);
    expect(dayProgress(db)).toEqual({ done: 1, total: 1, percent: 100 });
  });

  it('возвращает 0% при пустом дне', () => {
    expect(dayProgress(dbWith([]))).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe('currentStreak', () => {
  it('считает дни подряд с выполнением', () => {
    const t = todayISO();
    const db = dbWith([
      task({ id: '1', title: 'a', dueDate: t, status: 'done', completedAt: `${t}T10:00:00.000Z` }),
      task({ id: '2', title: 'b', dueDate: addDaysISO(t, -1), status: 'done', completedAt: `${addDaysISO(t, -1)}T10:00:00.000Z` }),
      task({ id: '3', title: 'c', dueDate: addDaysISO(t, -2), status: 'done', completedAt: `${addDaysISO(t, -2)}T10:00:00.000Z` }),
    ]);
    expect(currentStreak(db)).toBe(3);
  });

  it('прерывается пропуском дня', () => {
    const t = todayISO();
    const db = dbWith([
      task({ id: '1', title: 'a', dueDate: t, status: 'done', completedAt: `${t}T10:00:00.000Z` }),
      task({ id: '2', title: 'b', dueDate: addDaysISO(t, -2), status: 'done', completedAt: `${addDaysISO(t, -2)}T10:00:00.000Z` }),
    ]);
    expect(currentStreak(db)).toBe(1);
  });

  it('считает серию, оканчивающуюся вчера, пока сегодняшний день не закрыт', () => {
    const t = todayISO();
    const db = dbWith([
      task({ id: '1', title: 'a', dueDate: addDaysISO(t, -1), status: 'done', completedAt: `${addDaysISO(t, -1)}T10:00:00.000Z` }),
    ]);
    expect(currentStreak(db)).toBe(1);
  });
});

describe('completedByDay', () => {
  it('возвращает ровно N дней включая сегодня', () => {
    const t = todayISO();
    const db = dbWith([
      task({ id: '1', title: 'a', dueDate: t, status: 'done', completedAt: `${t}T09:00:00.000Z` }),
      task({ id: '2', title: 'b', dueDate: t, status: 'done', completedAt: `${t}T12:00:00.000Z` }),
      task({ id: '3', title: 'c', dueDate: t, status: 'new' }),
    ]);
    const out = completedByDay(db, 7);
    expect(out).toHaveLength(7);
    expect(out[6]).toEqual({ date: t, count: 2 });
    expect(out.slice(0, 6).every((d) => d.count === 0)).toBe(true);
  });
});

describe('categoryStats', () => {
  it('считает процент по категориям и исключает отменённые', () => {
    const t = todayISO();
    const db = dbWith([
      task({ id: '1', title: 'a', dueDate: t, categoryId: 'cat_work', status: 'done' }),
      task({ id: '2', title: 'b', dueDate: t, categoryId: 'cat_work', status: 'new' }),
      task({ id: '3', title: 'c', dueDate: t, categoryId: 'cat_work', status: 'cancelled' }),
      task({ id: '4', title: 'd', dueDate: t, categoryId: 'cat_shop', status: 'new' }),
    ]);
    const stats = categoryStats(db);
    const work = stats.find((s) => s.category.id === 'cat_work')!;
    expect(work.total).toBe(2);
    expect(work.done).toBe(1);
    expect(work.percent).toBe(50);
    expect(stats.map((s) => s.category.id)).toContain('cat_shop');
    expect(stats.find((s) => s.category.id === 'cat_health')).toBeUndefined();
  });
});

describe('фильтры по дате и просрочке', () => {
  it('tasksOnDate возвращает только задачи даты, отсортированные по времени', () => {
    const t = todayISO();
    const db = dbWith([
      task({ id: '1', title: 'b', dueDate: t, dueTime: '18:00' }),
      task({ id: '2', title: 'a', dueDate: t, dueTime: '09:00' }),
      task({ id: '3', title: 'c', dueDate: addDaysISO(t, 1), dueTime: '09:00' }),
    ]);
    expect(tasksOnDate(db, t).map((x) => x.id)).toEqual(['2', '1']);
  });

  it('просроченными считаются прошедшие дедлайны, но не выполненные', () => {
    const past = addDaysISO(todayISO(), -1);
    const db = dbWith([
      task({ id: '1', title: 'a', dueDate: past, status: 'new' }),
      task({ id: '2', title: 'b', dueDate: past, status: 'done', completedAt: `${past}T10:00:00.000Z` }),
    ]);
    expect(overdueTasks(db).map((x) => x.id)).toEqual(['1']);
    expect(isOverdue(task({ id: '3', title: 'c', dueDate: addDaysISO(todayISO(), 1) }))).toBe(false);
  });
});
