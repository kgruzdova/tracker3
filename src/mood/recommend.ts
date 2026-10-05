export interface RecommendationInput {
  baseLimit: number;
  mood: number | null;
  stress: number | null;
  overdueCount: number;
}

export interface RecommendationAdjustment {
  label: string;
  delta: number;
}

export interface Recommendation {
  limit: number;
  postponeHard: boolean;
  messages: string[];
  adjustments: RecommendationAdjustment[];
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function taskWord(n: number): string {
  return pluralRu(n, 'задача', 'задачи', 'задач');
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function computeRecommendation(input: RecommendationInput): Recommendation {
  const base = clamp(Math.round(input.baseLimit || 5), 1, 7);
  const mood = input.mood;
  const stress = input.stress;
  const overdue = Math.max(0, input.overdueCount || 0);

  const adjustments: RecommendationAdjustment[] = [];
  let limit = base;
  let postponeHard = false;
  const messages: string[] = [];

  if (stress !== null && stress >= 4) {
    limit -= 2;
    adjustments.push({ label: 'Высокий стресс', delta: -2 });
    messages.push('Высокий стресс. Оставьте только важное и запланируйте отдых.');
  }
  if (stress === 5) {
    postponeHard = true;
    messages.push('Стресс максимальный: сложные задачи с высоким приоритетом лучше перенести на завтра.');
  }
  if (mood !== null && mood <= 2) {
    limit -= 2;
    adjustments.push({ label: 'Низкое настроение', delta: -2 });
    postponeHard = true;
    messages.push('Настроение на нуле. Перенеси сложное на завтра и добавь в план что-то приятное.');
  }
  if (mood !== null && mood === 5 && stress !== null && stress <= 2) {
    limit += 1;
    adjustments.push({ label: 'Отличное состояние', delta: 1 });
    messages.push('Отличное состояние! Можно взяться за что-то сложное.');
  }
  if (overdue > 2) {
    limit -= 1;
    adjustments.push({ label: `${overdue} просроченных задач`, delta: -1 });
    messages.push('Слишком много просроченных задач — начните с них, остальное отложите.');
  }

  limit = clamp(limit, 1, 7);

  const head =
    limit <= 3
      ? `Сегодня стоит запланировать не больше ${limit} ${taskWord(limit)}.`
      : `Рекомендуемый план на сегодня: до ${limit} ${taskWord(limit)}.`;

  return {
    limit,
    postponeHard,
    messages: [head, ...messages],
    adjustments,
  };
}

export interface LimitWarningInput {
  plannedCount: number;
  limit: number;
}

export function limitWarning({ plannedCount, limit }: LimitWarningInput): string | null {
  if (plannedCount > limit) {
    return `План на сегодня превышен (${plannedCount} из лимита ${limit})`;
  }
  return null;
}
