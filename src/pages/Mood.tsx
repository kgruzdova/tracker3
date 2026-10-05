import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../store/StoreContext';
import { Icon } from '../components/Icon';
import { MOOD_LABELS, STRESS_LABELS } from '../types';
import { getMood } from '../store/actions';
import { addDaysISO, formatLongDate, formatShortDate, lastNDays, parseISODate, todayISO } from '../utils/dates';
import { completedByDay } from '../store/selectors';
import { toast } from '../toast';

const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
const STRESS_EMOJI: Record<number, string> = { 1: '😌', 2: '🙂', 3: '😐', 4: '😰', 5: '🥵' };

export function MoodPage() {
  const { db, moodActions } = useStore();
  const today = todayISO();
  const existing = getMood(db, today);

  const [mood, setMood] = useState(existing?.mood ?? 0);
  const [stress, setStress] = useState(existing?.stress ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [period, setPeriod] = useState<7 | 14 | 30>(7);

  const submit = () => {
    if (!mood || !stress) {
      toast('Отметьте настроение и уровень стресса', 'error');
      return;
    }
    moodActions.upsert({ date: today, mood, stress, comment: comment.slice(0, 200) });
    toast(existing ? 'Чек-ин обновлён' : 'Чек-ин сохранён');
  };

  const chartData = useMemo(() => {
    const doneMap = new Map(completedByDay(db, period).map((d) => [d.date, d.count]));
    return lastNDays(period).map((date) => {
      const entry = db.moodEntries.find((m) => m.date === date);
      const d = parseISODate(date);
      return {
        date,
        label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
        mood: entry ? entry.mood : null,
        stress: entry ? entry.stress : null,
        done: doneMap.get(date) ?? 0,
      };
    });
  }, [db, period]);

  const history = useMemo(() => {
    const start = addDaysISO(today, -29);
    return [...db.moodEntries]
      .filter((m) => m.date >= start)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.moodEntries, today]);

  const maxDone = Math.max(4, ...chartData.map((d) => d.done));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Состояние</h1>
          <div className="page-sub">{formatLongDate(today)}</div>
        </div>
        <div className="segmented">
          {([7, 14, 30] as const).map((p) => (
            <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>
              {p} дней
            </button>
          ))}
        </div>
      </div>

      <div className="split">
        <div className="card" style={{ gridColumn: 'auto' }}>
          <div className="card-title">График «настроение / выполненные задачи»</div>
          <div style={{ width: '100%', height: 300, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis
                  yAxisId="mood"
                  domain={[1, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  width={40}
                />
                <YAxis
                  yAxisId="done"
                  orientation="right"
                  domain={[0, maxDone]}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  width={34}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                  labelFormatter={(label: string) => {
                    const row = chartData.find((c) => c.label === label);
                    return row ? formatShortDate(row.date) : String(label);
                  }}
                  formatter={(value, name) => {
                    const v = value as unknown as number | string | null | undefined;
                    const missing = v === null || v === undefined || v === '';
                    if (name === 'Настроение') return [missing ? 'нет чек-ина' : `${v}/5`, name];
                    if (name === 'Стресс') return [missing ? '—' : `${v}/5`, name];
                    return [String(v), name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="done" dataKey="done" name="Выполнено задач" fill="var(--primary)" radius={[4, 4, 0, 0]} opacity={0.75} />
                <Line
                  yAxisId="mood"
                  type="monotone"
                  dataKey="mood"
                  name="Настроение"
                  stroke="var(--success)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--success)' }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="mood"
                  type="monotone"
                  dataKey="stress"
                  name="Стресс"
                  stroke="var(--warn)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={{ r: 2.5, fill: 'var(--warn)' }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="hint">Если чек-ин за день не сделан — линия настроения прерывается, столбец задач рисуется.</div>
        </div>

        <div className="card">
          <div className="card-title">Чек-ин за сегодня</div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Настроение · {mood ? MOOD_LABELS[mood] : 'не выбрано'}</label>
            <div className="scale">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} className={`scale-btn${mood === v ? ' on' : ''}`} onClick={() => setMood(v)}>
                  <span className="em">{MOOD_EMOJI[v]}</span>
                  <span>
                    {v} — {MOOD_LABELS[v].toLowerCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 16 }}>
            <label>Стресс · {stress ? STRESS_LABELS[stress] : 'не выбрано'}</label>
            <div className="scale">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} className={`scale-btn${stress === v ? ' on' : ''}`} onClick={() => setStress(v)}>
                  <span className="em">{STRESS_EMOJI[v]}</span>
                  <span>
                    {v} — {STRESS_LABELS[v].toLowerCase()}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="mood-comment">Комментарий (необязательно)</label>
            <textarea
              id="mood-comment"
              className="textarea"
              maxLength={200}
              value={comment}
              placeholder="Что повлияло на состояние?"
              onChange={(e) => setComment(e.target.value)}
            />
            <span className="hint">{comment.length}/200</span>
          </div>

          <button className="btn primary" style={{ marginTop: 14, width: '100%' }} onClick={submit}>
            <Icon name="check" size={16} /> {existing ? 'Обновить чек-ин' : 'Сохранить чек-ин'}
          </button>
          <div className="hint">Один чек-ин в день: повторный ввод перезаписывает запись.</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">История · последние 30 дней</div>
        {history.length === 0 ? (
          <div className="empty">Чек-инов пока нет</div>
        ) : (
          history.map((m) => (
            <div className="history-item" key={m.date}>
              <span style={{ width: 92, fontVariantNumeric: 'tabular-nums' }}>{formatShortDate(m.date)}</span>
              <span title={MOOD_LABELS[m.mood]}>
                {MOOD_EMOJI[m.mood]} {m.mood}/5
              </span>
              <span title={STRESS_LABELS[m.stress]}>
                стресс {m.stress}/5
              </span>
              <span className="spacer" />
              <span className="muted" style={{ overflowWrap: 'anywhere', textAlign: 'right' }}>
                {m.comment}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
