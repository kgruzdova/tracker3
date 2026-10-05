import { fuzzyMatch, normalizeWord } from '../utils/text';

export type Intent =
  | 'cancel'
  | 'yes'
  | 'no'
  | 'help'
  | 'moodSet'
  | 'moodGet'
  | 'stats'
  | 'plan'
  | 'reminder'
  | 'move'
  | 'complete'
  | 'delete'
  | 'rename'
  | 'add';

export interface IntentMatch {
  intent: Intent;
  consumed: number[];
}

const SYNONYMS: Record<Intent, string[][]> = {
  cancel: [['отмена'], ['отменить'], ['хватит'], ['стоп'], ['прервать'], ['выйти'], ['отбой']],
  yes: [['да'], ['ага'], ['конечно'], ['ок'], ['окей'], ['подтверждаю'], ['давай']],
  no: [['нет'], ['не', 'надо'], ['не', 'нужно'], ['отставить']],
  help: [['помощь'], ['помоги'], ['что', 'ты', 'умеешь'], ['справка'], ['help'], ['команды'], ['твои', 'команды']],
  moodSet: [],
  moodGet: [['как', 'настроение'], ['настроение', 'какое'], ['как', 'я', 'себя', 'чувствую'], ['мой', 'стресс'], ['как', 'самочувствие']],
  stats: [
    ['сколько', 'задач', 'выполнено'],
    ['сколько', 'выполнено'],
    ['сколько', 'я', 'сделал'],
    ['статистика'],
    ['мой', 'прогресс'],
    ['сколько', 'задач'],
  ],
  plan: [
    ['что', 'у', 'меня'],
    ['покажи', 'план'],
    ['план', 'на'],
    ['что', 'сегодня'],
    ['что', 'завтра'],
    ['мой', 'план'],
    ['что', 'запланировано'],
    ['список', 'задач'],
    ['какой', 'план'],
  ],
  reminder: [
    ['напомни'],
    ['напомнить'],
    ['напоминание'],
    ['поставь', 'напоминание'],
    ['поставить', 'напоминание'],
  ],
  move: [['перенеси'], ['перенести'], ['передвинь'], ['сдвинь'], ['перенос']],
  complete: [
    ['отметь'],
    ['отметить'],
    ['выполни'],
    ['выполнить'],
    ['выполнена'],
    ['выполнено'],
    ['готово'],
    ['сделано'],
    ['заверши'],
    ['закрыл'],
  ],
  delete: [['удали'], ['удалить'], ['сотри'], ['стереть'], ['убери'], ['избавься']],
  rename: [['переименуй'], ['переименовать'], ['измени', 'название'], ['поменяй', 'название'], ['измени'], ['поменяй']],
  add: [
    ['добавь'],
    ['добавить'],
    ['создай'],
    ['создать'],
    ['новая', 'задача'],
    ['новую', 'задачу'],
    ['запиши'],
    ['записать'],
    ['внеси'],
    ['внести'],
  ],
};

const ORDER: Intent[] = [
  'cancel',
  'help',
  'moodSet',
  'moodGet',
  'stats',
  'plan',
  'reminder',
  'move',
  'complete',
  'delete',
  'rename',
  'add',
];

const EXACT_QUALITY = 1000;

interface PhraseHit {
  index: number;
  quality: number;
  length: number;
}

function matchPhrase(tokens: string[], phrase: string[]): PhraseHit | null {
  if (!phrase.length) return null;
  let best: PhraseHit | null = null;
  for (let i = 0; i + phrase.length <= tokens.length; i += 1) {
    let allExact = true;
    let distance = 0;
    let ok = true;
    for (let j = 0; j < phrase.length; j += 1) {
      const a = normalizeWord(tokens[i + j]);
      const b = normalizeWord(phrase[j]);
      if (a === b) continue;
      if (fuzzyMatch(tokens[i + j], phrase[j])) {
        allExact = false;
        distance += a.length && b.length ? Math.abs(a.length - b.length) + 1 : 1;
      } else {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const quality = allExact ? EXACT_QUALITY : 100 - distance;
    if (!best || quality > best.quality) best = { index: i, quality, length: phrase.length };
  }
  return best;
}

export function detectMoodSet(text: string): { mood: number | null; stress: number | null } | null {
  const moodMatch = /настроение[^0-9]{0,4}([1-5])(?![0-9])/.exec(text);
  const stressMatch = /стресс[^0-9]{0,4}([1-5])(?![0-9])/.exec(text);
  if (!moodMatch && !stressMatch) return null;
  const mood = moodMatch ? Number(moodMatch[1]) : null;
  const stress = stressMatch ? Number(stressMatch[1]) : null;
  if (mood === null && stress === null) return null;
  return { mood, stress };
}

function range(start: number, len: number): number[] {
  const out: number[] = [];
  for (let i = start; i < start + len; i += 1) out.push(i);
  return out;
}

export function detectIntent(tokens: string[], text: string, hasState: boolean): IntentMatch | null {
  if (hasState) {
    let bestState: { intent: Intent; hit: PhraseHit } | null = null;
    for (const intent of ['cancel', 'yes', 'no'] as Intent[]) {
      for (const phrase of SYNONYMS[intent]) {
        const hit = matchPhrase(tokens, phrase);
        if (hit && (!bestState || hit.quality > bestState.hit.quality)) {
          bestState = { intent, hit };
        }
      }
    }
    if (bestState && bestState.hit.quality >= 50) {
      return { intent: bestState.intent, consumed: range(bestState.hit.index, bestState.hit.length) };
    }
  }

  if (detectMoodSet(text)) {
    return { intent: 'moodSet', consumed: [] };
  }

  let best: { intent: Intent; hit: PhraseHit; priority: number } | null = null;
  for (let p = 0; p < ORDER.length; p += 1) {
    const intent = ORDER[p];
    if (intent === 'moodSet') continue;
    for (const phrase of SYNONYMS[intent]) {
      const hit = matchPhrase(tokens, phrase);
      if (!hit) continue;
      const isFuzzy = hit.quality < EXACT_QUALITY;
      if (isFuzzy && phrase.length === 1 && hit.index !== 0) continue;
      if (!best || hit.quality > best.hit.quality || (hit.quality === best.hit.quality && p < best.priority)) {
        best = { intent, hit, priority: p };
      }
    }
  }

  if (!best) return null;
  return { intent: best.intent, consumed: range(best.hit.index, best.hit.length) };
}
