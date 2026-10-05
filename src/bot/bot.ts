import type { Task, TaskStatus } from '../types';
import type { NewTaskInput } from '../store/actions';
import { addDaysISO, formatShortDate, pad2, relativeDayLabel, toDateISO, todayISO } from '../utils/dates';
import { buildTitle, matchTasks, parseInput, restoreCase, tokenize } from './parser';
import { detectIntent, detectMoodSet } from './intents';

export interface Draft {
  title?: string;
  time?: string | null;
  date?: string | null;
  taskId?: string;
  newTitle?: string;
  reminderText?: string;
  offsetMinutes?: number | null;
}

export type BotState =
  | { kind: 'await_date'; purpose: 'add' | 'move'; draft: Draft; startedAt: number }
  | { kind: 'await_time'; draft: Draft; startedAt: number }
  | { kind: 'confirm'; action: 'delete' | 'rename'; taskId: string; title: string; newTitle?: string; startedAt: number }
  | {
      kind: 'pick';
      action: 'delete' | 'complete' | 'move' | 'rename' | 'remind';
      ids: string[];
      titles: string[];
      draft?: Draft;
      startedAt: number;
    };

export type BotEffect =
  | { type: 'add_task'; input: NewTaskInput }
  | { type: 'delete_task'; id: string }
  | { type: 'update_task'; id: string; patch: Partial<Task> }
  | { type: 'set_status'; id: string; status: TaskStatus }
  | { type: 'move_task'; id: string; date: string }
  | { type: 'add_reminder'; taskId: string | null; text: string; fireAt: string; offsetMinutes: number }
  | { type: 'mood'; mood: number | null; stress: number | null };

export interface BotContext {
  tasks: Task[];
  now: Date;
  state: BotState | null;
  todayMood: { mood: number; stress: number } | null;
}

export interface BotResult {
  text: string;
  state: BotState | null;
  effects: BotEffect[];
  quickReplies?: string[];
}

const STATE_TIMEOUT = 5 * 60 * 1000;

export const HELP_TEXT = [
  'Я умею управлять задачами по обычным фразам:',
  '',
  '• Добавить: «добавь задачу купить молоко завтра в 18:00»',
  '• Удалить: «удали задачу купить молоко»',
  '• Изменить: «переименуй задачу отчёт в отчёт за месяц»',
  '• Перенести: «перенеси отчёт на завтра»',
  '• Выполнить: «отметь задачу отчёт выполненной»',
  '• План: «что у меня на сегодня?», «план на завтра»',
  '• Напоминание: «напомни мне в 17:00 позвонить врачу»',
  '• Напомнить о задаче: «поставь напоминание за 15 минут отчёт»',
  '• Статистика: «сколько задач выполнено?»',
  '• Состояние: «я настроение 4», «как настроение?»',
  '• Справка: «помощь»',
  '',
  'Можно не беспокоиться об опечатках — я их понимаю.',
].join('\n');

const UNKNOWN_TEXT = [
  'Я Вас не понял',
  'Попробуйте, например:',
  '• добавь задачу купить молоко завтра',
  '• что у меня на сегодня?',
  '• сколько задач выполнено?',
  '• помощь',
].join('\n');

function activeTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.archived && t.status !== 'cancelled');
}

function lookup(tasks: Task[], id: string): Task | undefined {
  return tasks.find((t) => t.id === id);
}

function taskListLines(list: Task[], dateLabel: string): string {
  if (!list.length) return `На ${dateLabel} задач нет.`;
  const lines = list.map((t, i) => {
    const time = t.dueTime ? `${t.dueTime} — ` : '';
    const status =
      t.status === 'done' ? ' [выполнено]' : t.status === 'in_progress' ? ' [в работе]' : '';
    return `${i + 1}. ${time}${t.title}${status}`;
  });
  return `План (${dateLabel}):\n${lines.join('\n')}`;
}

function pickPrompt(titles: string[]): string {
  const lines = titles.map((t, i) => `${i + 1}) ${t}`);
  return `У меня несколько задач: ${lines.join(' ')}. Какую?`;
}

function splitRename(tokens: string[], consumed: Set<number>): { oldTitle: string; newTitle: string } {
  const rest: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed.has(i)) continue;
    const w = tokens[i];
    if (['задачу', 'задача', 'задачи', 'название', 'названием'].includes(w)) continue;
    rest.push(w);
  }
  const idx = rest.indexOf('в');
  if (idx === -1) return { oldTitle: rest.join(' ').trim(), newTitle: '' };
  return { oldTitle: rest.slice(0, idx).join(' ').trim(), newTitle: rest.slice(idx + 1).join(' ').trim() };
}

function pickNumber(text: string, max: number): number | null {
  const m = /(?:^|\s)([1-9]\d?)(?:\s|$)/.exec(text.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= max ? n : null;
}

function localFireAt(date: string, time: string): string {
  return `${date}T${time}`;
}

export function runBot(raw: string, ctx: BotContext): BotResult {
  const text = raw.trim();
  if (!text) {
    return { text: 'Напишите команду. Например: «добавь задачу купить молоко завтра».', state: ctx.state, effects: [] };
  }

  let state = ctx.state;
  if (state && Date.now() - state.startedAt > STATE_TIMEOUT) state = null;

  const now = ctx.now;
  const today = todayISO();
  const parsed = parseInput(text, now);
  const det = detectIntent(parsed.tokens, normalizeForDetect(text), state !== null);
  const intent = det?.intent ?? null;
  const consumed = new Set<number>([...parsed.consumed, ...(det?.consumed ?? [])]);

  const effects: BotEffect[] = [];
  const done = (result: Omit<BotResult, 'effects'>): BotResult => ({ ...result, effects });

  if (state && (intent === 'cancel' || intent === 'yes' || intent === 'no')) {
    if (intent === 'cancel') {
      return done({ text: 'Хорошо, отменил.', state: null });
    }
    if (intent === 'no') {
      return done({ text: 'Хорошо, оставил как есть.', state: null });
    }
    if (intent === 'yes' && state.kind === 'confirm') {
      if (state.action === 'delete') {
        effects.push({ type: 'delete_task', id: state.taskId });
        return done({ text: `Задача «${state.title}» удалена.`, state: null });
      }
      effects.push({ type: 'update_task', id: state.taskId, patch: { title: state.newTitle ?? state.title } });
      return done({
        text: `Переименовал «${state.title}» в «${state.newTitle}».`,
        state: null,
      });
    }
    if (intent === 'yes') {
      return done({ text: 'Подтверждать нечего — уточните команду.', state: null });
    }
  }

  if (state && state.kind === 'await_date') {
    if (parsed.date) {
      if (state.purpose === 'add') {
        const title = state.draft.title ?? '';
        effects.push({
          type: 'add_task',
          input: { title, dueDate: parsed.date, dueTime: state.draft.time ?? parsed.time ?? null },
        });
        const rel = relativeDayLabel(parsed.date).toLowerCase();
        const time = state.draft.time ? ` в ${state.draft.time}` : '';
        return done({ text: `Задача «${title}» добавлена на ${rel}${time}.`, state: null });
      }
      if (state.draft.taskId) {
        effects.push({ type: 'move_task', id: state.draft.taskId, date: parsed.date });
        const t = lookup(ctx.tasks, state.draft.taskId);
        return done({
          text: `Перенёс «${t?.title ?? 'задачу'}» на ${relativeDayLabel(parsed.date).toLowerCase()}.`,
          state: null,
        });
      }
    }
    if (intent === null) {
      return done({
        text: 'Не понял дату. Напишите «сегодня», «завтра» или дату в формате ДД.ММ.',
        state,
        quickReplies: ['сегодня', 'завтра', '05.10'],
      });
    }
    state = null;
  }

  if (state && state.kind === 'await_time') {
    if (parsed.time) {
      const fireAt = localFireAt(parsed.date ?? state.draft.date ?? today, parsed.time);
      effects.push({
        type: 'add_reminder',
        taskId: null,
        text: state.draft.reminderText ?? 'Напоминание',
        fireAt,
        offsetMinutes: 0,
      });
      return done({
        text: `Напоминание «${state.draft.reminderText}» поставлено на ${parsed.time}.`,
        state: null,
      });
    }
    if (intent === null) {
      return done({
        text: 'Не понял время. Укажите его так: «в 18:00».',
        state,
        quickReplies: ['в 18:00', 'в 20:30'],
      });
    }
    state = null;
  }

  if (state && state.kind === 'pick') {
    const n = pickNumber(text, state.ids.length);
    if (n !== null) {
      const id = state.ids[n - 1];
      const title = state.titles[n - 1];
      if (state.action === 'delete') {
        return done({
          text: `Удалить задачу «${title}»? (да/нет)`,
          state: { kind: 'confirm', action: 'delete', taskId: id, title, startedAt: Date.now() },
          quickReplies: ['да', 'нет'],
        });
      }
      if (state.action === 'complete') {
        effects.push({ type: 'set_status', id, status: 'done' });
        return done({ text: `Готово: «${title}» отмечена выполненной.`, state: null });
      }
      if (state.action === 'move') {
        if (state.draft?.date) {
          effects.push({ type: 'move_task', id, date: state.draft.date });
          return done({
            text: `Перенёс «${title}» на ${relativeDayLabel(state.draft.date).toLowerCase()}.`,
            state: null,
          });
        }
        return done({
          text: 'На когда перенести задачу? (сегодня/завтра/дата)',
          state: { kind: 'await_date', purpose: 'move', draft: { taskId: id, title }, startedAt: Date.now() },
          quickReplies: ['сегодня', 'завтра'],
        });
      }
      if (state.action === 'remind') {
        const task = lookup(ctx.tasks, id);
        const offset = state.draft?.offsetMinutes ?? 0;
        if (task && task.dueTime) {
          const base = new Date(`${task.dueDate}T${task.dueTime}:00`);
          base.setMinutes(base.getMinutes() - offset);
          const fireAt = `${toDateISO(base)}T${pad2(base.getHours())}:${pad2(base.getMinutes())}`;
          effects.push({
            type: 'add_reminder',
            taskId: task.id,
            text: `Через ${offset} мин: ${task.title}`,
            fireAt,
            offsetMinutes: offset,
          });
          return done({
            text: `Напомню за ${offset} минут до «${task.title}» (${task.dueTime}).`,
            state: null,
          });
        }
        return done({
          text: `У задачи «${title}» нет времени. Укажите время: «напомни в 18:00 ${title}».`,
          state: null,
        });
      }
      if (state.action === 'rename') {
        if (state.draft?.newTitle) {
          return done({
            text: `Переименовать «${title}» в «${state.draft.newTitle}»? (да/нет)`,
            state: {
              kind: 'confirm',
              action: 'rename',
              taskId: id,
              title,
              newTitle: state.draft.newTitle,
              startedAt: Date.now(),
            },
            quickReplies: ['да', 'нет'],
          });
        }
        return done({
          text: 'Какое новое название? Напишите: переименуй задачу <название> в <новое название>',
          state: null,
        });
      }
    }
    if (intent === null) {
      return done({
        text: `${pickPrompt(state.titles)} Номер или часть названия.`,
        state,
        quickReplies: state.titles.slice(0, 3),
      });
    }
    state = null;
  }

  if (intent === null) {
    return done({ text: UNKNOWN_TEXT, state: null });
  }

  switch (intent) {
    case 'cancel':
      return done({ text: 'Сейчас нечего отменять.', state: null });

    case 'help':
      return done({ text: HELP_TEXT, state: null, quickReplies: ['что у меня на сегодня?', 'добавь задачу'] });

    case 'yes':
    case 'no':
      return done({ text: 'Уточните, пожалуйста, команду.', state: null });

    case 'moodSet': {
      const mood = detectMoodSet(normalizeForDetect(text));
      if (!mood) return done({ text: 'Напишите так: «я настроение 4» или «стресс 5».', state: null });
      effects.push({ type: 'mood', mood: mood.mood, stress: mood.stress });
      const parts: string[] = [];
      if (mood.mood !== null) parts.push(`настроение ${mood.mood}/5`);
      if (mood.stress !== null) parts.push(`стресс ${mood.stress}/5`);
      return done({ text: `Записал: ${parts.join(', ')}. Спасибо!`, state: null });
    }

    case 'moodGet': {
      const entry = ctx.todayMood;
      if (entry) {
        return done({
          text: `Сегодня настроение ${entry.mood}/5, стресс ${entry.stress}/5.`,
          state: null,
        });
      }
      return done({
        text: 'Сегодня чек-ин ещё не сделан. Откройте раздел «Состояние» или напишите «я настроение 4».',
        state: null,
        quickReplies: ['я настроение 4'],
      });
    }

    case 'stats': {
      const list = ctx.tasks.filter((t) => !t.archived && t.status !== 'cancelled');
      const todayDone = list.filter((t) => t.completedAt?.slice(0, 10) === today);
      const todayAll = list.filter((t) => t.dueDate === today);
      const weekAgo = addDaysISO(today, -6);
      const weekDone = list.filter((t) => t.completedAt && t.completedAt.slice(0, 10) >= weekAgo);
      return done({
        text: `Сегодня выполнено ${todayDone.length} из ${todayAll.length} задач.\nЗа 7 дней выполнено ${weekDone.length}.`,
        state: null,
      });
    }

    case 'plan': {
      const date = parsed.date ?? today;
      const list = activeTasks(ctx.tasks)
        .filter((t) => t.dueDate === date)
        .sort((a, b) => (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'));
      return done({
        text: taskListLines(list, `${relativeDayLabel(date).toLowerCase()} (${formatShortDate(date)})`),
        state: null,
      });
    }

    case 'reminder': {
      const title = titleOf(text, parsed.tokens, consumed, new Set(['задачу', 'задача', 'мне']));
      if (parsed.offsetMinutes !== null) {
        const candidates = matchTasks(title, activeTasks(ctx.tasks));
        if (!candidates.length) {
          return done({
            text: title
              ? `Не нашёл задачу «${title}», чтобы поставить напоминание.`
              : 'Напишите, о чём напомнить: «поставь напоминание за 15 минут отчёт».',
            state: null,
          });
        }
        if (candidates.length > 1) {
          return done({
            text: pickPrompt(candidates.map((t) => t.title)),
            state: {
              kind: 'pick',
              action: 'remind',
              ids: candidates.map((t) => t.id),
              titles: candidates.map((t) => t.title),
              draft: { offsetMinutes: parsed.offsetMinutes },
              startedAt: Date.now(),
            },
          });
        }
        const task = candidates[0];
        if (!task.dueTime) {
          return done({
            text: `У задачи «${task.title}» нет времени. Укажите время: «напомни в 18:00 ${task.title}».`,
            state: null,
          });
        }
        const base = new Date(`${task.dueDate}T${task.dueTime}:00`);
        base.setMinutes(base.getMinutes() - parsed.offsetMinutes);
        effects.push({
          type: 'add_reminder',
          taskId: task.id,
          text: `Через ${parsed.offsetMinutes} мин: ${task.title}`,
          fireAt: `${toDateISO(base)}T${pad2(base.getHours())}:${pad2(base.getMinutes())}`,
          offsetMinutes: parsed.offsetMinutes,
        });
        return done({
          text: `Напомню за ${parsed.offsetMinutes} минут до «${task.title}» (${task.dueTime}).`,
          state: null,
        });
      }

      if (parsed.time) {
        const fireAt = localFireAt(parsed.date ?? today, parsed.time);
        const textForReminder = title || 'Напоминание';
        effects.push({ type: 'add_reminder', taskId: null, text: textForReminder, fireAt, offsetMinutes: 0 });
        return done({
          text: `Напоминание «${textForReminder}» поставлено на ${relativeDayLabel(parsed.date ?? today).toLowerCase()} в ${parsed.time}.`,
          state: null,
        });
      }

      return done({
        text: 'Когда напомнить? Укажите время, например «в 18:00».',
        state: { kind: 'await_time', draft: { reminderText: title || 'Напоминание', date: parsed.date }, startedAt: Date.now() },
        quickReplies: ['в 18:00', 'в 20:00'],
      });
    }

    case 'move': {
      const title = titleOf(text, parsed.tokens, consumed);
      const candidates = matchTasks(title, activeTasks(ctx.tasks));
      if (!candidates.length) {
        return done({ text: title ? `Не нашёл задачу «${title}».` : 'Какую задачу перенести?', state: null });
      }
      if (candidates.length > 1 && !parsed.date) {
        return done({
          text: pickPrompt(candidates.map((t) => t.title)),
          state: {
            kind: 'pick',
            action: 'move',
            ids: candidates.map((t) => t.id),
            titles: candidates.map((t) => t.title),
            startedAt: Date.now(),
          },
        });
      }
      const task = candidates[0];
      if (!parsed.date) {
        return done({
          text: `На когда перенести «${task.title}»? (сегодня/завтра/дата)`,
          state: {
            kind: 'await_date',
            purpose: 'move',
            draft: { taskId: task.id, title: task.title },
            startedAt: Date.now(),
          },
          quickReplies: ['сегодня', 'завтра'],
        });
      }
      if (candidates.length > 1) {
        return done({
          text: pickPrompt(candidates.map((t) => t.title)),
          state: {
            kind: 'pick',
            action: 'move',
            ids: candidates.map((t) => t.id),
            titles: candidates.map((t) => t.title),
            draft: { date: parsed.date },
            startedAt: Date.now(),
          },
        });
      }
      effects.push({ type: 'move_task', id: task.id, date: parsed.date });
      return done({
        text: `Перенёс «${task.title}» на ${relativeDayLabel(parsed.date).toLowerCase()}.`,
        state: null,
      });
    }

    case 'complete': {
      const title = titleOf(text, parsed.tokens, consumed, new Set(['задачу', 'задача']));
      const candidates = matchTasks(title, activeTasks(ctx.tasks));
      if (!candidates.length) return done({ text: `Не нашёл задачу «${title}».`, state: null });
      if (candidates.length > 1) {
        return done({
          text: pickPrompt(candidates.map((t) => t.title)),
          state: {
            kind: 'pick',
            action: 'complete',
            ids: candidates.map((t) => t.id),
            titles: candidates.map((t) => t.title),
            startedAt: Date.now(),
          },
        });
      }
      const task = candidates[0];
      effects.push({ type: 'set_status', id: task.id, status: 'done' });
      return done({ text: `Готово: «${task.title}» отмечена выполненной.`, state: null });
    }

    case 'delete': {
      const title = titleOf(text, parsed.tokens, consumed, new Set(['задачу', 'задача']));
      const candidates = matchTasks(title, ctx.tasks.filter((t) => !t.archived));
      if (!candidates.length) return done({ text: `Не нашёл задачу «${title}».`, state: null });
      if (candidates.length > 1) {
        return done({
          text: pickPrompt(candidates.map((t) => t.title)),
          state: {
            kind: 'pick',
            action: 'delete',
            ids: candidates.map((t) => t.id),
            titles: candidates.map((t) => t.title),
            startedAt: Date.now(),
          },
        });
      }
      const task = candidates[0];
      return done({
        text: `Удалить задачу «${task.title}»? (да/нет)`,
        state: { kind: 'confirm', action: 'delete', taskId: task.id, title: task.title, startedAt: Date.now() },
        quickReplies: ['да', 'нет'],
      });
    }

    case 'rename': {
      const { oldTitle, newTitle } = splitRename(parsed.tokens, consumed);
      if (!newTitle) {
        return done({
          text: 'Какое новое название? Напишите: переименуй задачу <название> в <новое название>.',
          state: null,
        });
      }
      const candidates = oldTitle ? matchTasks(oldTitle, activeTasks(ctx.tasks)) : [];
      if (candidates.length > 1) {
        return done({
          text: pickPrompt(candidates.map((t) => t.title)),
          state: {
            kind: 'pick',
            action: 'rename',
            ids: candidates.map((t) => t.id),
            titles: candidates.map((t) => t.title),
            draft: { newTitle },
            startedAt: Date.now(),
          },
        });
      }
      if (candidates.length === 1) {
        const task = candidates[0];
        return done({
          text: `Переименовать «${task.title}» в «${newTitle}»? (да/нет)`,
          state: {
            kind: 'confirm',
            action: 'rename',
            taskId: task.id,
            title: task.title,
            newTitle,
            startedAt: Date.now(),
          },
          quickReplies: ['да', 'нет'],
        });
      }
      const only = activeTasks(ctx.tasks);
      if (only.length === 1) {
        return done({
          text: `Переименовать «${only[0].title}» в «${newTitle}»? (да/нет)`,
          state: {
            kind: 'confirm',
            action: 'rename',
            taskId: only[0].id,
            title: only[0].title,
            newTitle,
            startedAt: Date.now(),
          },
          quickReplies: ['да', 'нет'],
        });
      }
      return done({
        text: `Не нашёл задачу «${oldTitle}». Укажите так: переименуй задачу <название> в <новое название>.`,
        state: null,
      });
    }

    case 'add': {
      const title = titleOf(text, parsed.tokens, consumed, new Set(['задачу', 'задача']));
      if (!title) {
        return done({
          text: 'Что добавить? Напишите, например: «добавь задачу купить молоко завтра».',
          state: null,
        });
      }
      if (!parsed.date) {
        return done({
          text: `Когда выполнить «${title}»? (сегодня/завтра/дата)`,
          state: {
            kind: 'await_date',
            purpose: 'add',
            draft: { title, time: parsed.time },
            startedAt: Date.now(),
          },
          quickReplies: ['сегодня', 'завтра', 'через 3 дня'],
        });
      }
      effects.push({ type: 'add_task', input: { title, dueDate: parsed.date, dueTime: parsed.time } });
      const rel = relativeDayLabel(parsed.date).toLowerCase();
      const time = parsed.time ? ` в ${parsed.time}` : '';
      return done({ text: `Задача «${title}» добавлена на ${rel}${time}.`, state: null });
    }
  }

  return done({ text: UNKNOWN_TEXT, state: null });
}

function normalizeForDetect(text: string): string {
  return tokenize(text).join(' ');
}

function titleOf(source: string, tokens: string[], consumed: Set<number>, extra?: Set<string>): string {
  return restoreCase(source, buildTitle(tokens, consumed, extra));
}
