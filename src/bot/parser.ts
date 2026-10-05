import type { Task } from '../types';
import { addDaysISO, toDateISO } from '../utils/dates';
import { fuzzyMatch } from '../utils/text';

export const STOP_WORDS = new Set([
  'пожалуйста',
  'пожалуйст',
  'пожалуй',
  'ну',
  'так',
  'бы',
  'же',
  'ли',
  'вот',
  'плиз',
  'please',
  'привет',
  'здравствуй',
  'здравствуйте',
]);

export const GENERIC_WORDS = new Set([
  'задачу',
  'задача',
  'задачи',
  'задаче',
  'задачей',
  'задачу',
  'дело',
  'дела',
  'запись',
  'мне',
  'для',
  'выполненной',
  'выполнена',
  'выполнено',
  'выполнив',
  'готово',
  'сделано',
  'отметка',
]);

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^0-9a-zа-я.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(s: string): string[] {
  const norm = normalizeText(s);
  if (!norm) return [];
  return norm.split(' ').filter((t) => t.length > 0);
}

export function contentWords(s: string): string[] {
  return tokenize(s).filter((w) => /[0-9a-zа-я]/.test(w) && !STOP_WORDS.has(w));
}

const WEEKDAYS: Record<string, number> = {
  понедельник: 1,
  понедельника: 1,
  вторник: 2,
  вторника: 2,
  среда: 3,
  среду: 3,
  среды: 3,
  четверг: 4,
  четверга: 4,
  пятница: 5,
  пятницу: 5,
  пятницы: 5,
  суббота: 6,
  субботу: 6,
  субботы: 6,
  воскресенье: 0,
  воскресенья: 0,
};

const PREPOSITIONS = new Set(['в', 'на', 'до', 'по', 'к', 'о']);

const DATE_TOKENS: Record<string, number> = {
  сегодня: 0,
  завтра: 1,
  послезавтра: 2,
  вчера: -1,
};

const MONTHS_GEN = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export interface ParsedInput {
  tokens: string[];
  date: string | null;
  time: string | null;
  offsetMinutes: number | null;
  consumed: Set<number>;
  relativeTime: boolean;
}

function validTime(h: number, m: number): string | null {
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
}

function nextWeekday(fromISO: string, target: number, strictlyAfter: boolean): string {
  const [y, m, d] = fromISO.split('-').map(Number);
  const cur = new Date(y, m - 1, d);
  let delta = (target - cur.getDay() + 7) % 7;
  if (delta === 0) delta = strictlyAfter ? 7 : 0;
  cur.setDate(cur.getDate() + delta);
  return toDateISO(cur);
}

export function parseInput(text: string, now: Date = new Date()): ParsedInput {
  const tokens = tokenize(text);
  const consumed = new Set<number>();
  const today = toDateISO(now);
  let date: string | null = null;
  let time: string | null = null;
  let offsetMinutes: number | null = null;
  let relativeTime = false;

  const isPrep = (i: number) => i >= 0 && PREPOSITIONS.has(tokens[i]);

  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed.has(i)) continue;
    const t = tokens[i];

    if (t in DATE_TOKENS) {
      date = addDaysISO(today, DATE_TOKENS[t]);
      consumed.add(i);
      if (isPrep(i - 1)) consumed.add(i - 1);
      continue;
    }

    if (t in WEEKDAYS && (isPrep(i - 1) || tokens[i - 1] === 'следующий')) {
      const strict = tokens[i - 1] === 'следующий';
      date = nextWeekday(today, WEEKDAYS[t], strict);
      consumed.add(i);
      if (isPrep(i - 1)) consumed.add(i - 1);
      continue;
    }

    if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(t)) {
      const [d, m, y] = t.split('.').map(Number);
      const year = y < 100 ? 2000 + y : y;
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const iso = `${year}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
        date = iso;
        consumed.add(i);
        if (isPrep(i - 1)) consumed.add(i - 1);
        continue;
      }
    }

    if (/^\d{1,2}\.\d{1,2}$/.test(t)) {
      const [d, m] = t.split('.').map(Number);
      const y = now.getFullYear();
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        let iso = `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
        if (iso < today) {
          iso = `${y + 1}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
        }
        date = iso;
        consumed.add(i);
        if (isPrep(i - 1)) consumed.add(i - 1);
        continue;
      }
    }

    const monthIdx = MONTHS_GEN.indexOf(t);
    if (monthIdx >= 0 && /^\d{1,2}$/.test(tokens[i - 1] ?? '')) {
      const d = Number(tokens[i - 1]);
      if (d >= 1 && d <= 31) {
        const y = now.getFullYear();
        let iso = `${y}-${monthIdx + 1 < 10 ? '0' + (monthIdx + 1) : monthIdx + 1}-${d < 10 ? '0' + d : d}`;
        if (iso < today) iso = `${y + 1}-${iso.slice(5)}`;
        date = iso;
        consumed.add(i);
        consumed.add(i - 1);
        if (isPrep(i - 2)) consumed.add(i - 2);
        continue;
      }
    }

    if (t === 'через') {
      const unit = tokens[i + 2];
      const numTok = tokens[i + 1];
      if (numTok && /^\d+$/.test(numTok)) {
        const n = Number(numTok);
        if (['день', 'дня', 'дней'].includes(unit ?? '')) {
          date = addDaysISO(today, n);
          consumed.add(i);
          consumed.add(i + 1);
          consumed.add(i + 2);
          i += 2;
          continue;
        }
        if (['неделю', 'недели', 'недель'].includes(unit ?? '')) {
          date = addDaysISO(today, n * 7);
          consumed.add(i);
          consumed.add(i + 1);
          consumed.add(i + 2);
          i += 2;
          continue;
        }
        if (['день'].includes(unit ?? '')) {
          date = addDaysISO(today, n);
          consumed.add(i);
          consumed.add(i + 1);
          consumed.add(i + 2);
          i += 2;
          continue;
        }
      }
      if (numTok && /^\d+$/.test(numTok) && ['час', 'часа', 'часов'].includes(tokens[i + 2] ?? '')) {
        const d = new Date(now.getTime() + Number(numTok) * 3600000);
        time = validTime(d.getHours(), d.getMinutes());
        date = toDateISO(d);
        relativeTime = true;
        consumed.add(i);
        consumed.add(i + 1);
        consumed.add(i + 2);
        i += 2;
        continue;
      }
      if (tokens[i + 1] && ['минуту', 'минуты', 'минут'].includes(tokens[i + 1])) {
        const d = new Date(now.getTime() + 5 * 60000);
        time = validTime(d.getHours(), d.getMinutes());
        date = toDateISO(d);
        relativeTime = true;
        consumed.add(i);
        consumed.add(i + 1);
        i += 1;
        continue;
      }
    }

    if (t === 'полдень') {
      time = '12:00';
      consumed.add(i);
      if (isPrep(i - 1)) consumed.add(i - 1);
      continue;
    }
    if (t === 'полночь') {
      time = '00:00';
      consumed.add(i);
      if (isPrep(i - 1)) consumed.add(i - 1);
      continue;
    }

    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [h, m] = t.split(':').map(Number);
      const v = validTime(h, m);
      if (v) {
        time = v;
        consumed.add(i);
        if (isPrep(i - 1)) consumed.add(i - 1);
        continue;
      }
    }

    if (/^\d{1,2}\.\d{2}$/.test(t) && isPrep(i - 1)) {
      const [h, m] = t.split('.').map(Number);
      const v = validTime(h, m);
      if (v) {
        time = v;
        consumed.add(i);
        consumed.add(i - 1);
        continue;
      }
    }

    if (/^\d{1,2}$/.test(t)) {
      const next = tokens[i + 1];
      const h = Number(t);
      let hh: number | null = null;
      if (next && ['вечера', 'вечер', 'вечером'].includes(next)) {
        hh = h === 12 ? 12 : h < 12 ? h + 12 : h;
        consumed.add(i + 1);
      } else if (next && ['утра', 'утро', 'утром'].includes(next)) {
        hh = h === 12 ? 0 : h;
        consumed.add(i + 1);
      } else if (next && ['дня', 'день', 'днём'].includes(next)) {
        hh = h === 12 ? 12 : h < 12 ? h + 12 : h;
        consumed.add(i + 1);
      } else if (next && ['ночи', 'ночь', 'ночью'].includes(next)) {
        hh = h === 24 ? 0 : h;
        consumed.add(i + 1);
      } else if (isPrep(i - 1) && h <= 23 && !tokens[i + 1]) {
        hh = h;
      } else if (isPrep(i - 1) && h <= 23 && next && /^\d/.test(next)) {
        hh = h;
      }
      if (hh !== null) {
        const v = validTime(hh, 0);
        if (v) {
          time = v;
          consumed.add(i);
          if (isPrep(i - 1)) consumed.add(i - 1);
          continue;
        }
      }
    }

    if (t === 'за' && tokens[i + 1] && /^\d+$/.test(tokens[i + 1])) {
      const n = Number(tokens[i + 1]);
      const unit = tokens[i + 2];
      if (['минуту', 'минуты', 'минут', 'мин'].includes(unit ?? '')) {
        offsetMinutes = n;
        consumed.add(i);
        consumed.add(i + 1);
        consumed.add(i + 2);
        i += 2;
        continue;
      }
      if (['час', 'часа', 'часов'].includes(unit ?? '')) {
        offsetMinutes = n * 60;
        consumed.add(i);
        consumed.add(i + 1);
        consumed.add(i + 2);
        i += 2;
        continue;
      }
    }
    if (t === 'за' && tokens[i + 1] === 'полчаса') {
      offsetMinutes = 30;
      consumed.add(i);
      consumed.add(i + 1);
      i += 1;
      continue;
    }
  }

  return { tokens, date, time, offsetMinutes, consumed, relativeTime };
}

export function buildTitle(tokens: string[], consumed: Set<number>, extraStrip: Set<string> = new Set()): string {
  const rest: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed.has(i)) continue;
    const w = tokens[i];
    if (STOP_WORDS.has(w)) continue;
    rest.push(w);
  }
  const strip = (pred: (w: string) => boolean) => {
    while (rest.length && pred(rest[0])) rest.shift();
    while (rest.length && pred(rest[rest.length - 1])) rest.pop();
  };
  strip((w) => GENERIC_WORDS.has(w) || extraStrip.has(w));
  strip((w) => GENERIC_WORDS.has(w) || extraStrip.has(w));
  return rest.join(' ').trim();
}

export function titleToWords(title: string): string[] {
  return contentWords(title);
}

export function matchTasks(query: string, tasks: Task[]): Task[] {
  const qWords = titleToWords(query);
  if (!qWords.length) return [];
  const normQuery = query.toLowerCase().replace(/ё/g, 'е').trim();

  const scored: Array<{ task: Task; score: number }> = [];
  for (const task of tasks) {
    if (task.archived || task.status === 'cancelled') continue;
    const tWords = titleToWords(task.title);
    if (!tWords.length) continue;
    const normTitle = task.title.toLowerCase().replace(/ё/g, 'е');
    let score: number;
    if (normQuery && normTitle.includes(normQuery)) {
      score = 1;
    } else {
      let matched = 0;
      for (const qw of qWords) {
        if (tWords.some((tw) => fuzzyMatch(qw, tw))) matched += 1;
      }
      const precision = matched / qWords.length;
      const recall = matched / tWords.length;
      const accept = precision >= 0.6 || (precision >= 0.5 && recall >= 0.6);
      if (!accept) continue;
      score = precision;
    }
    if (score >= 0.5) {
      if (task.status !== 'done') score += 0.05;
      scored.push({ task, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((s) => s.task);
}

export interface QuickAddResult {
  title: string;
  date: string | null;
  time: string | null;
}

export function restoreCase(original: string, normalized: string): string {
  if (!normalized) return normalized;
  const needle = normalized.toLowerCase();
  const haystack = original.toLowerCase().replace(/ё/g, 'е');
  const idx = haystack.indexOf(needle);
  if (idx < 0) return normalized;
  const slice = original.slice(idx, idx + normalized.length);
  return slice.replace(/\s+/g, ' ').trim();
}

const QUICK_STRIP = new Set(['задачу', 'задача', 'на', 'в', 'до', 'сегодня', 'завтра']);

export function parseQuickAdd(text: string, now: Date = new Date()): QuickAddResult {
  const parsed = parseInput(text, now);
  const raw = buildTitle(parsed.tokens, parsed.consumed, QUICK_STRIP);
  const title = restoreCase(text, raw);
  return { title: title || text.trim(), date: parsed.date, time: parsed.time };
}
