import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { runBot } from './bot';
import { parseQuickAdd } from './parser';

const NOW = new Date(2026, 9, 5, 12, 0, 0);

function task(partial: Partial<Task> & Pick<Task, 'id' | 'title' | 'dueDate'>): Task {
  return {
    description: '',
    categoryId: 'cat_none',
    priority: 'medium',
    dueTime: null,
    status: 'new',
    repeat: 'none',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    completedAt: null,
    archived: false,
    ...partial,
  };
}

const tasks: Task[] = [
  task({ id: 't1', title: 'купить молоко', dueDate: '2026-10-05' }),
  task({ id: 't2', title: 'купить хлеб', dueDate: '2026-10-05' }),
  task({ id: 't3', title: 'подготовить отчёт', dueDate: '2026-10-05', dueTime: '11:00', status: 'in_progress' }),
  task({ id: 't4', title: 'пройти курс по TypeScript', dueDate: '2026-10-06' }),
];

function ask(text: string, state = null as ReturnType<typeof runBot>['state']) {
  return runBot(text, { tasks, now: NOW, state, todayMood: null });
}

describe('бот: разбор и действия', () => {
  it('добавляет задачу с датой и временем из текста', () => {
    const res = ask('добавь задачу купить молоко завтра в 18:00');
    expect(res.effects).toHaveLength(1);
    expect(res.effects[0]).toMatchObject({
      type: 'add_task',
      input: { title: 'купить молоко', dueDate: '2026-10-06', dueTime: '18:00' },
    });
    expect(res.text).toContain('добавлена');
  });

  it('без даты просит уточнить', () => {
    const res = ask('добавь задачу позвонить врачу');
    expect(res.effects).toHaveLength(0);
    expect(res.state?.kind).toBe('await_date');
    expect(res.text).toContain('Когда выполнить');
  });

  it('подтверждает дату в состоянии await_date', () => {
    const first = ask('добавь задачу позвонить врачу');
    const second = ask('завтра', first.state);
    expect(second.effects[0]).toMatchObject({
      type: 'add_task',
      input: { title: 'позвонить врачу', dueDate: '2026-10-06' },
    });
  });

  it('распознаёт опечатку в команде', () => {
    const res = ask('дабавь задачу созвон с командой завтра');
    expect(res.effects[0]).toMatchObject({ type: 'add_task', input: { title: 'созвон с командой' } });
  });

  it('удаление требует подтверждения', () => {
    const res = ask('удали задачу купить молоко');
    expect(res.effects).toHaveLength(0);
    expect(res.state?.kind).toBe('confirm');
    expect(res.text).toContain('Удалить задачу');
    expect(res.quickReplies).toEqual(['да', 'нет']);
  });

  it('подтверждение выполняет удаление', () => {
    const first = ask('удали задачу купить молоко');
    const second = ask('да', first.state);
    expect(second.effects).toEqual([{ type: 'delete_task', id: 't1' }]);
    expect(second.state).toBeNull();
  });

  it('отмена диалога сбрасывает состояние', () => {
    const first = ask('удали задачу купить молоко');
    const second = ask('отмена', first.state);
    expect(second.effects).toHaveLength(0);
    expect(second.state).toBeNull();
  });

  it('уточняет при нескольких совпадениях', () => {
    const res = ask('удали задачу купить');
    expect(res.state?.kind).toBe('pick');
    expect(res.text).toContain('1)');
    expect(res.text).toContain('2)');
  });

  it('выбирает задачу по номеру', () => {
    const first = ask('удали задачу купить');
    const second = ask('2', first.state);
    expect(second.state).toMatchObject({ kind: 'confirm', taskId: 't2' });
  });

  it('отмечает задачу выполненной', () => {
    const res = ask('отметь задачу отчёт выполненной');
    expect(res.effects).toEqual([{ type: 'set_status', id: 't3', status: 'done' }]);
  });

  it('переносит задачу на завтра', () => {
    const res = ask('перенеси отчёт на завтра');
    expect(res.effects).toEqual([{ type: 'move_task', id: 't3', date: '2026-10-06' }]);
  });

  it('показывает план на сегодня', () => {
    const res = ask('что у меня на сегодня?');
    expect(res.effects).toHaveLength(0);
    expect(res.text).toContain('План');
    expect(res.text).toContain('подготовить отчёт');
  });

  it('показывает план на завтра', () => {
    const res = ask('план на завтра');
    expect(res.text).toContain('курс по TypeScript');
  });

  it('показывает статистику', () => {
    const res = ask('сколько задач выполнено?');
    expect(res.text).toContain('Сегодня выполнено');
  });

  it('быстрый чек-ин настроения из чата', () => {
    const res = ask('я настроение 4');
    expect(res.effects).toEqual([{ type: 'mood', mood: 4, stress: null }]);
  });

  it('ставит напоминание по времени', () => {
    const res = ask('напомни мне в 17:00 позвонить врачу');
    expect(res.effects[0]).toMatchObject({
      type: 'add_reminder',
      fireAt: '2026-10-05T17:00',
      text: 'позвонить врачу',
    });
  });

  it('переименование требует подтверждения', () => {
    const res = ask('переименуй задачу купить молоко в купить кефир');
    expect(res.effects).toHaveLength(0);
    expect(res.state).toMatchObject({ kind: 'confirm', action: 'rename', taskId: 't1', newTitle: 'купить кефир' });
    expect(res.text).toContain('купить кефир');
    expect(res.quickReplies).toEqual(['да', 'нет']);
  });

  it('подтверждение переименования меняет название', () => {
    const first = ask('переименуй задачу купить молоко в купить кефир');
    const second = ask('да', first.state);
    expect(second.effects).toEqual([
      { type: 'update_task', id: 't1', patch: { title: 'купить кефир' } },
    ]);
    expect(second.state).toBeNull();
  });

  it('переименование уточняет при нескольких совпадениях', () => {
    const res = ask('переименуй задачу купить в то же самое');
    expect(res.state?.kind).toBe('pick');
    expect(res.state).toMatchObject({ action: 'rename' });
    expect(res.text).toContain('1)');
  });

  it('переименование без нового названия просит уточнить формат', () => {
    const res = ask('переименуй задачу');
    expect(res.effects).toHaveLength(0);
    expect(res.text).toContain('переименуй задачу <название> в <новое название>');
  });

  it('справка по командам', () => {
    const res = ask('помощь');
    expect(res.text).toContain('Я умею управлять задачами');
  });

  it('мусорный ввод -> «Я Вас не понял» с примерами', () => {
    const res = ask('фыва пролджэ евфыв');
    expect(res.text.startsWith('Я Вас не понял')).toBe(true);
    expect(res.text).toContain('добавь задачу');
    expect(res.state).toBeNull();
  });

  it('пустой ввод не роняет бота', () => {
    expect(ask('   ').text).toBeTruthy();
  });
});

describe('quick-add', () => {
  it('вытаскивает дату, время и название', () => {
    const r = parseQuickAdd('Купить молоко завтра в 18:00', NOW);
    expect(r).toEqual({ title: 'Купить молоко', date: '2026-10-06', time: '18:00' });
  });

  it('работает без даты и времени', () => {
    const r = parseQuickAdd('Позвонить маме', NOW);
    expect(r.title).toBe('Позвонить маме');
    expect(r.date).toBeNull();
    expect(r.time).toBeNull();
  });
});
