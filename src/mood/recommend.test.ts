import { describe, expect, it } from 'vitest';
import { computeRecommendation, limitWarning, pluralRu, taskWord } from './recommend';

const base = { baseLimit: 5, overdueCount: 0 };

describe('computeRecommendation', () => {
  it('норма без поправок = базовая дневная норма', () => {
    const r = computeRecommendation({ ...base, mood: 3, stress: 3 });
    expect(r.limit).toBe(5);
    expect(r.postponeHard).toBe(false);
  });

  it('стресс >= 4 уменьшает лимит на 2', () => {
    const r = computeRecommendation({ ...base, mood: 4, stress: 4 });
    expect(r.limit).toBe(3);
    expect(r.adjustments.some((a) => a.delta === -2)).toBe(true);
  });

  it('стресс = 5 дополнительно переносит сложные задачи', () => {
    const r = computeRecommendation({ ...base, mood: 3, stress: 5 });
    expect(r.limit).toBe(3);
    expect(r.postponeHard).toBe(true);
  });

  it('настроение <= 2 уменьшает лимит на 2 и переносит сложное', () => {
    const r = computeRecommendation({ ...base, mood: 2, stress: 2 });
    expect(r.limit).toBe(3);
    expect(r.postponeHard).toBe(true);
    expect(r.messages.join(' ').toLowerCase()).toContain('перенеси сложное');
  });

  it('настроение = 5 и стресс <= 2 увеличивает лимит на 1', () => {
    const r = computeRecommendation({ ...base, mood: 5, stress: 2 });
    expect(r.limit).toBe(6);
    expect(r.messages.join(' ')).toContain('Отличное состояние');
  });

  it('настроение = 5 при стрессе 3 не даёт бонус', () => {
    const r = computeRecommendation({ ...base, mood: 5, stress: 3 });
    expect(r.limit).toBe(5);
  });

  it('более 2 просроченных задач уменьшает лимит на 1', () => {
    expect(computeRecommendation({ ...base, mood: 3, stress: 3, overdueCount: 3 }).limit).toBe(4);
    expect(computeRecommendation({ ...base, mood: 3, stress: 3, overdueCount: 2 }).limit).toBe(5);
  });

  it('поправки суммируются, результат в диапазоне 1..7', () => {
    const r = computeRecommendation({ baseLimit: 5, mood: 1, stress: 5, overdueCount: 5 });
    expect(r.limit).toBe(1);
    const up = computeRecommendation({ baseLimit: 5, mood: 5, stress: 1, overdueCount: 0 });
    expect(up.limit).toBe(6);
    const maxed = computeRecommendation({ baseLimit: 7, mood: 5, stress: 1, overdueCount: 0 });
    expect(maxed.limit).toBe(7);
  });

  it('нет чек-ина — лимит равен базовой норме', () => {
    const r = computeRecommendation({ ...base, mood: null, stress: null });
    expect(r.limit).toBe(5);
    expect(r.adjustments).toHaveLength(0);
  });
});

describe('limitWarning', () => {
  it('предупреждает при превышении', () => {
    expect(limitWarning({ plannedCount: 6, limit: 5 })).toBe('План на сегодня превышен (6 из лимита 5)');
  });
  it('не предупреждает в пределах лимита', () => {
    expect(limitWarning({ plannedCount: 5, limit: 5 })).toBeNull();
    expect(limitWarning({ plannedCount: 0, limit: 5 })).toBeNull();
  });
});

describe('склонение', () => {
  it('pluralRu', () => {
    expect(pluralRu(1, 'задача', 'задачи', 'задач')).toBe('задача');
    expect(pluralRu(3, 'задача', 'задачи', 'задач')).toBe('задачи');
    expect(pluralRu(5, 'задача', 'задачи', 'задач')).toBe('задач');
    expect(pluralRu(11, 'задача', 'задачи', 'задач')).toBe('задач');
    expect(pluralRu(21, 'задача', 'задачи', 'задач')).toBe('задача');
  });
  it('taskWord', () => {
    expect(taskWord(1)).toBe('задача');
    expect(taskWord(2)).toBe('задачи');
    expect(taskWord(7)).toBe('задач');
  });
});
