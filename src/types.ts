export type Priority = 'high' | 'medium' | 'low';
export type TaskStatus = 'new' | 'in_progress' | 'done' | 'cancelled';
export type Repeat = 'none' | 'daily' | 'weekly';

export interface Task {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  priority: Priority;
  dueDate: string;
  dueTime: string | null;
  status: TaskStatus;
  repeat: Repeat;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archived: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

export interface MoodEntry {
  date: string;
  mood: number;
  stress: number;
  comment: string;
  createdAt: string;
}

export type ReminderStatus = 'pending' | 'fired' | 'snoozed';

export interface Reminder {
  id: string;
  taskId: string | null;
  text: string;
  fireAt: string;
  offsetMinutes: number;
  status: ReminderStatus;
  snoozeCount: number;
  createdAt: string;
}

export interface VoiceSettings {
  enabled: boolean;
  voiceURI: string;
  rate: number;
  volume: number;
  signal: boolean;
  repeats: number;
  offsetMinutes: number;
}

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  dailyTaskLimit: number;
  voice: VoiceSettings;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  createdAt: string;
  meta?: string;
  quickReplies?: string[];
}

export interface ReminderLogEntry {
  id: string;
  at: string;
  text: string;
  result: 'spoken' | 'signal-only' | 'blocked' | 'error';
  detail?: string;
}

export interface DB {
  version: number;
  tasks: Task[];
  categories: Category[];
  moodEntries: MoodEntry[];
  reminders: Reminder[];
  chatMessages: ChatMessage[];
  settings: Settings;
  reminderLog: ReminderLogEntry[];
}

export const DB_VERSION = 1;
export const STORAGE_KEY = 'planner_db_v1';

export const MOOD_LABELS: Record<number, string> = {
  1: 'Очень плохо',
  2: 'Плохо',
  3: 'Нормально',
  4: 'Хорошо',
  5: 'Отлично',
};

export const STRESS_LABELS: Record<number, string> = {
  1: 'Спокойно',
  2: 'Немного напряжено',
  3: 'Умеренно',
  4: 'Высокий стресс',
  5: 'Крайне напряжённо',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
};
