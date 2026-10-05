// @vitest-environment jsdom
import { beforeAll, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { todayISO } from './utils/dates';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }

  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }

  localStorage.clear();
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
});

const text = () => container.textContent ?? '';

const readDB = () => JSON.parse(localStorage.getItem('planner_db_v1') as string);

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

async function waitFor(match: string, timeoutMs = 15000): Promise<void> {
  const started = Date.now();
  for (;;) {
    if (text().includes(match)) return;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Ожидалось «${match}», получено: ${text().slice(0, 300)}`);
    }
    await settle();
  }
}

it('приложение рендерится и показывает экран «Сегодня»', async () => {
  const { default: App } = await import('./App');
  root = createRoot(container);
  await act(async () => {
    root.render(<App />);
  });
  await waitFor('Прогресс дня');
  expect(text()).toContain('Выполнено');
  expect(text()).toContain('Быстрое добавление');
  expect(text()).toContain('Рекомендация по нагрузке');
  expect(text()).toContain('Просрочено');
});

it('данные сохраняются в localStorage', () => {
  const raw = localStorage.getItem('planner_db_v1');
  expect(raw).toBeTruthy();
  const db = JSON.parse(raw as string);
  expect(Array.isArray(db.tasks)).toBe(true);
  expect(db.tasks.length).toBeGreaterThan(0);
  expect(db.categories.length).toBeGreaterThan(0);
  expect(db.moodEntries.length).toBeGreaterThan(0);
  expect(db.settings.dailyTaskLimit).toBe(5);
});

it('переключение маршрута на «Задачи» работает', async () => {
  await act(async () => {
    window.location.hash = '#/app/tasks';
  });
  await waitFor('Найдено');
  expect(text()).toContain('Все категории');
});

it('экран «Календарь» открывается', async () => {
  await act(async () => {
    window.location.hash = '#/app/calendar';
  });
  await waitFor('показывает задачи этого дня');
  expect(text()).toContain('Сегодня');
});

it('маршрут 404 отдаёт страницу с кодом', async () => {
  await act(async () => {
    window.location.hash = '#/nope';
  });
  await waitFor('404');
  expect(text()).toContain('Такой страницы нет');
});

it('экран «Состояние» с графиком открывается', async () => {
  await act(async () => {
    window.location.hash = '#/app/mood';
  });
  await waitFor('Чек-ин за сегодня');
  expect(text()).toContain('настроение');
  expect(text()).toContain('История');
});

it('чек-ин сохраняется и перезаписывается', async () => {
  const buttons = [...container.querySelectorAll<HTMLButtonElement>('.scale-btn')];
  expect(buttons.length).toBe(10);
  await act(async () => {
    buttons[4].click();
  });
  await act(async () => {
    buttons[7].click();
  });
  expect(text()).toContain('Настроение · Отлично');
  expect(text()).toContain('Стресс · Умеренно');

  const save = [...container.querySelectorAll<HTMLButtonElement>('button.btn.primary')].find((b) =>
    /чек-ин/i.test(b.textContent ?? ''),
  );
  expect(save).toBeTruthy();
  await act(async () => {
    save!.click();
  });

  const db = JSON.parse(localStorage.getItem('planner_db_v1') as string);
  const todayEntry = db.moodEntries.find((m: { date: string }) => m.date === todayISO());
  expect(todayEntry).toBeTruthy();
  expect(todayEntry.mood).toBe(5);
  expect(todayEntry.stress).toBe(3);
});

it('чат-бот отвечает на команду добавления', async () => {
  await act(async () => {
    window.location.hash = '#/app/chat';
  });
  await waitFor('управлять вашими задачами');

  const input = container.querySelector<HTMLInputElement>('.chat-input input');
  expect(input).toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input!, 'дабавь задачу smoke тест завтра в 18:00');
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const send = [...container.querySelectorAll<HTMLButtonElement>('.chat-input button')].find((b) => !b.disabled);
  await act(async () => {
    send!.click();
    await new Promise((r) => setTimeout(r, 30));
  });

  const db = JSON.parse(localStorage.getItem('planner_db_v1') as string);
  expect(db.tasks.some((t: { title: string }) => t.title === 'smoke тест')).toBe(true);
  expect(text()).toContain('добавлена');
});

const setNativeValue = (el: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};

const clickButton = async (label: string | RegExp | ((t: string) => boolean)) => {
  const match = (b: HTMLButtonElement) => {
    const t = b.textContent ?? '';
    if (typeof label === 'function') return label(t);
    if (typeof label === 'string') return t.trim() === label;
    return label.test(t);
  };
  const btn = [...container.querySelectorAll<HTMLButtonElement>('button')].find(match);
  if (!btn) throw new Error(`Кнопка не найдена: ${String(label)}`);
  await act(async () => {
    btn.click();
  });
  return btn;
};

it('настройки: тема, голос, экспорт и импорт JSON', async () => {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => 'blob:planner-test';
    URL.revokeObjectURL = () => undefined;
  }
  const originalConfirm = window.confirm;
  const originalAnchorClick = window.HTMLAnchorElement.prototype.click;
  window.confirm = () => true;
  window.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (this.download) return;
    originalAnchorClick.call(this);
  };

  await act(async () => {
    window.location.hash = '#/app/settings';
  });
  await waitFor('Тема оформления');

  await clickButton((t) => t === 'Тёмная');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(readDB().settings.theme).toBe('dark');

  await clickButton((t) => t === 'Светлая');
  expect(document.documentElement.dataset.theme).toBe('light');

  await act(async () => {
    setNativeValue(container.querySelector<HTMLInputElement>('#vrate')!, '1.5');
  });
  expect(readDB().settings.voice.rate).toBe(1.5);

  await act(async () => {
    setNativeValue(container.querySelector<HTMLInputElement>('#limit')!, '7');
  });
  expect(readDB().settings.dailyTaskLimit).toBe(7);

  await clickButton((t) => t.includes('Экспорт JSON'));
  expect(text()).toContain('Файл экспортирован');

  const payload = JSON.stringify({ ...readDB(), tasks: [{ id: 'imported', title: 'Импортированная задача', dueDate: '2026-01-01' }] });
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('Не найден input[type=file]');
  const file = new File([payload], 'export.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
  });
  expect(text()).toContain('Найдено: 1 задач');

  await clickButton((t) => t === 'Заменить данные');
  expect(readDB().tasks[0].id).toBe('imported');

  window.confirm = originalConfirm;
  window.HTMLAnchorElement.prototype.click = originalAnchorClick;
});

it('размонтирование не бросает ошибок', async () => {
  await act(async () => {
    root.unmount();
  });
  expect(text()).toBe('');
});
