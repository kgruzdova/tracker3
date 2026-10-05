import type { DB, Task } from '../types';
import { addDaysISO, todayISO } from '../utils/dates';

export function isActive(t: Task): boolean {
  return !t.archived && t.status !== 'done' && t.status !== 'cancelled';
}

export function tasksOnDate(db: DB, date: string, includeArchived = false): Task[] {
  return db.tasks
    .filter((t) => t.dueDate === date && (includeArchived || !t.archived))
    .sort(sortTasks);
}

export function sortTasks(a: Task, b: Task): number {
  if ((a.dueTime ?? '99:99') !== (b.dueTime ?? '99:99')) {
    return (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99');
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  return rank[a.priority] - rank[b.priority];
}

export function isOverdue(t: Task, now = todayISO()): boolean {
  if (t.archived || t.status === 'done' || t.status === 'cancelled') return false;
  if (t.dueDate < now) return true;
  if (t.dueDate === now && t.dueTime) {
    const [h, m] = t.dueTime.split(':').map(Number);
    const d = new Date();
    if (h * 60 + m < d.getHours() * 60 + d.getMinutes()) return true;
  }
  return false;
}

export function overdueTasks(db: DB, now = todayISO()): Task[] {
  return db.tasks.filter((t) => isOverdue(t, now));
}

export function dayProgress(db: DB, date = todayISO()): { done: number; total: number; percent: number } {
  const list = db.tasks.filter((t) => t.dueDate === date && !t.archived && t.status !== 'cancelled');
  const done = list.filter((t) => t.status === 'done').length;
  const total = list.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function countCompletedBetween(db: DB, fromISO: string, toISO: string): number {
  return db.tasks.filter(
    (t) => t.completedAt && t.completedAt.slice(0, 10) >= fromISO && t.completedAt.slice(0, 10) <= toISO,
  ).length;
}

export function completedByDay(db: DB, days: number): Array<{ date: string; count: number }> {
  const map = new Map<string, number>();
  for (const t of db.tasks) {
    if (!t.completedAt) continue;
    const d = t.completedAt.slice(0, 10);
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  const out: Array<{ date: string; count: number }> = [];
  const today = todayISO();
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDaysISO(today, -i);
    out.push({ date, count: map.get(date) ?? 0 });
  }
  return out;
}

export function currentStreak(db: DB): number {
  const days = new Set<string>();
  for (const t of db.tasks) {
    if (t.completedAt) days.add(t.completedAt.slice(0, 10));
  }
  let streak = 0;
  let cursor = todayISO();
  if (!days.has(cursor)) {
    cursor = addDaysISO(cursor, -1);
  }
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return streak;
}

export function categoryStats(db: DB): Array<{ category: { id: string; name: string; color: string }; done: number; total: number; percent: number }> {
  const byCat = new Map<string, { done: number; total: number }>();
  for (const t of db.tasks) {
    if (t.status === 'cancelled') continue;
    const key = t.categoryId ?? 'cat_none';
    const cur = byCat.get(key) ?? { done: 0, total: 0 };
    cur.total += 1;
    if (t.status === 'done') cur.done += 1;
    byCat.set(key, cur);
  }
  return db.categories
    .map((category) => {
      const s = byCat.get(category.id) ?? { done: 0, total: 0 };
      return {
        category,
        done: s.done,
        total: s.total,
        percent: s.total ? Math.round((s.done / s.total) * 100) : 0,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}
