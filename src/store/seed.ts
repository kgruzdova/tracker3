import type { Category, DB, MoodEntry, Task } from '../types';
import { DB_VERSION } from '../types';
import { addDaysISO, todayISO } from '../utils/dates';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_work', name: 'Работа', color: '#4f6ef7', isDefault: true },
  { id: 'cat_study', name: 'Учёба', color: '#9c6ade', isDefault: true },
  { id: 'cat_personal', name: 'Личное', color: '#f28b50', isDefault: true },
  { id: 'cat_health', name: 'Здоровье', color: '#2fb37a', isDefault: true },
  { id: 'cat_money', name: 'Финансы', color: '#e0b400', isDefault: true },
  { id: 'cat_shop', name: 'Покупки', color: '#ec5f8f', isDefault: true },
  { id: 'cat_home', name: 'Дом', color: '#4bb3d6', isDefault: true },
  { id: 'cat_none', name: 'Без категории', color: '#8b93a7', isDefault: true },
];

function task(partial: Partial<Task> & Pick<Task, 'id' | 'title' | 'dueDate'>): Task {
  const now = new Date().toISOString();
  return {
    description: '',
    categoryId: 'cat_none',
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

export function buildSeed(): DB {
  const t = todayISO();
  const now = new Date().toISOString();

  const tasks: Task[] = [
    task({
      id: 'task_seed_1',
      title: 'Подготовить отчёт за неделю',
      description: 'Свести цифры, оформить слайды и отправить руководителю.',
      categoryId: 'cat_work',
      priority: 'high',
      dueDate: t,
      dueTime: '11:00',
      status: 'in_progress',
    }),
    task({
      id: 'task_seed_2',
      title: 'Купить молоко и хлеб',
      categoryId: 'cat_shop',
      priority: 'low',
      dueDate: t,
      dueTime: '18:30',
      status: 'new',
    }),
    task({
      id: 'task_seed_3',
      title: 'Тренировка 30 минут',
      description: 'Лёгкий кардио-блок, без перегрузки.',
      categoryId: 'cat_health',
      priority: 'medium',
      dueDate: t,
      dueTime: '19:30',
      repeat: 'daily',
      status: 'new',
    }),
    task({
      id: 'task_seed_4',
      title: 'Разобрать почту',
      categoryId: 'cat_work',
      priority: 'medium',
      dueDate: t,
      status: 'done',
      completedAt: now,
    }),
    task({
      id: 'task_seed_5',
      title: 'Оплатить интернет',
      categoryId: 'cat_money',
      priority: 'high',
      dueDate: addDaysISO(t, -1),
      dueTime: '12:00',
      status: 'new',
    }),
    task({
      id: 'task_seed_6',
      title: 'Пройти модуль по TypeScript',
      description: 'Главы 4–6, конспект по дженерикам.',
      categoryId: 'cat_study',
      priority: 'medium',
      dueDate: addDaysISO(t, 1),
      dueTime: '20:00',
      status: 'new',
    }),
    task({
      id: 'task_seed_7',
      title: 'Позвонить стоматологу',
      categoryId: 'cat_health',
      priority: 'low',
      dueDate: addDaysISO(t, 2),
      dueTime: '10:00',
      status: 'new',
    }),
  ];

  const moodSeeds: Array<[number, number, string]> = [
    [4, 2, 'Всё по плану'],
    [3, 3, ''],
    [2, 4, 'Много срочных задач'],
    [4, 3, ''],
    [5, 1, 'Отдыхал, чувствую себя отлично'],
    [3, 4, 'Напряжённый день'],
    [4, 2, ''],
  ];

  const moodEntries: MoodEntry[] = moodSeeds.map(([mood, stress, comment], idx) => ({
    date: addDaysISO(t, idx - (moodSeeds.length - 1)),
    mood,
    stress,
    comment,
    createdAt: now,
  }));

  return {
    version: DB_VERSION,
    tasks,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    moodEntries,
    reminders: [],
    chatMessages: [],
    settings: {
      theme: 'system',
      dailyTaskLimit: 5,
      voice: {
        enabled: true,
        voiceURI: '',
        rate: 1,
        volume: 100,
        signal: true,
        repeats: 1,
        offsetMinutes: 0,
      },
    },
    reminderLog: [],
  };
}
