import { useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { categoryStats, completedByDay, countCompletedBetween, currentStreak } from '../store/selectors';
import { addDaysISO, formatShortDate, todayISO } from '../utils/dates';
import { taskWord } from '../mood/recommend';

export function StatsPage() {
  const { db } = useStore();
  const today = todayISO();

  const todayDone = countCompletedBetween(db, today, today);
  const weekStart = addDaysISO(today, -6);
  const monthStart = addDaysISO(today, -29);
  const weekDone = countCompletedBetween(db, weekStart, today);
  const monthDone = countCompletedBetween(db, monthStart, today);
  const streak = currentStreak(db);
  const days = useMemo(() => completedByDay(db, 30), [db]);
  const maxDay = Math.max(1, ...days.map((d) => d.count));
  const cats = useMemo(() => categoryStats(db), [db]);

  const plannedToday = db.tasks.filter((t) => t.dueDate === today && t.status !== 'cancelled' && !t.archived).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Статистика</h1>
          <div className="page-sub">Как вы выполняете план</div>
        </div>
      </div>

      <div className="grid four">
        <div className="stat">
          <div className="val">{todayDone}</div>
          <div className="lbl">Выполнено сегодня</div>
        </div>
        <div className="stat">
          <div className="val">{weekDone}</div>
          <div className="lbl">За последние 7 дней</div>
        </div>
        <div className="stat">
          <div className="val">{monthDone}</div>
          <div className="lbl">За последние 30 дней</div>
        </div>
        <div className="stat">
          <div className="val">{streak}</div>
          <div className="lbl">
            Дней подряд с выполнением · {taskWord(streak)}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Выполнение по дням · последние 30 дней</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 3,
            height: 150,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 2,
          }}
        >
          {days.map((d) => {
            const h = d.count === 0 ? 3 : Math.max(8, (d.count / maxDay) * 100);
            return (
              <div
                key={d.date}
                title={`${formatShortDate(d.date)}: ${d.count} ${taskWord(d.count)}`}
                style={{
                  flex: '1 1 0',
                  minWidth: 3,
                  height: `${h}%`,
                  background: d.count ? 'var(--primary)' : 'var(--border)',
                  borderRadius: '4px 4px 0 0',
                }}
              />
            );
          })}
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <span className="muted small">{formatShortDate(days[0].date)}</span>
          <span className="muted small">Максимум за день: {maxDay}</span>
          <span className="muted small">{formatShortDate(days[days.length - 1].date)}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Процент выполнения по категориям</div>
        {cats.length === 0 ? (
          <div className="empty">Пока нет данных — добавьте и выполните задачи</div>
        ) : (
          cats.map((r) => (
            <div className="bar-row" key={r.category.id}>
              <span
                className="row"
                style={{ gap: 7, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                <span className="color-swatch" style={{ background: r.category.color }} />
                {r.category.name}
              </span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${r.percent}%`, background: r.category.color }} />
              </span>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 650 }}>
                {r.percent}%
              </span>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Сегодня</div>
        <div className="row wrap" style={{ gap: 18 }}>
          <span>
            Запланировано: <strong>{plannedToday}</strong>
          </span>
          <span>
            Выполнено: <strong>{todayDone}</strong>
          </span>
          <span>
            Доля: <strong>{plannedToday ? Math.round((todayDone / plannedToday) * 100) : 0}%</strong>
          </span>
        </div>
      </div>
    </>
  );
}
