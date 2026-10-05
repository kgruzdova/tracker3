import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { TaskItem } from '../components/TaskItem';
import { TaskForm } from '../components/TaskForm';
import { Icon } from '../components/Icon';
import { isWeekend, monthGrid, parseISODate, todayISO, relativeDayLabel } from '../utils/dates';
import { isOverdue } from '../store/selectors';
import type { Task } from '../types';
import { toast } from '../toast';

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function CalendarPage() {
  const { db, taskActions } = useStore();
  const today = todayISO();
  const initial = parseISODate(today);
  const [year, setYear] = useState(initial.getFullYear());
  const [month, setMonth] = useState(initial.getMonth());
  const [selected, setSelected] = useState(today);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const cells = useMemo(() => monthGrid(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, { all: number; done: number; over: number }>();
    for (const t of db.tasks) {
      if (t.archived || t.status === 'cancelled') continue;
      const cur = map.get(t.dueDate) ?? { all: 0, done: 0, over: 0 };
      cur.all += 1;
      if (t.status === 'done') cur.done += 1;
      else if (isOverdue(t)) cur.over += 1;
      map.set(t.dueDate, cur);
    }
    return map;
  }, [db.tasks]);

  const shift = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const goToday = () => {
    const d = parseISODate(today);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setSelected(today);
  };

  const selectedTasks = db.tasks
    .filter((t) => t.dueDate === selected && !t.archived && t.status !== 'cancelled')
    .sort((a, b) => (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'));

  const inMonth = (iso: string) => iso.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {MONTH_NAMES[month]} {year}
          </h1>
          <div className="page-sub">Клик по дате показывает задачи этого дня</div>
        </div>
        <div className="row">
          <button className="btn icon" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
            <Icon name="left" size={16} />
          </button>
          <button className="btn" onClick={goToday}>
            Сегодня
          </button>
          <button className="btn icon" onClick={() => shift(1)} aria-label="Следующий месяц">
            <Icon name="right" size={16} />
          </button>
        </div>
      </div>

      <div className="split">
        <div className="card">
          <div className="cal-grid" style={{ marginBottom: 4 }}>
            {WEEK.map((w) => (
              <div className="cal-head" key={w}>
                {w}
              </div>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((iso) => {
              const stat = byDate.get(iso);
              const cls = [
                'cal-cell',
                !inMonth(iso) ? 'out' : '',
                isWeekend(iso) ? 'weekend' : '',
                iso === today ? 'today' : '',
                iso === selected ? 'selected' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button key={iso} className={cls} onClick={() => setSelected(iso)}>
                  <span className="cal-num">{Number(iso.slice(8, 10))}</span>
                  {stat && (
                    <>
                      <span className="cal-dots">
                        {Array.from({ length: Math.min(4, stat.all) }).map((_, i) => (
                          <span
                            key={i}
                            className={`cal-dot${stat.done > i ? ' done' : stat.over > 0 ? ' over' : ''}`}
                          />
                        ))}
                      </span>
                      <span className="cal-count">
                        {stat.done}/{stat.all}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="row wrap" style={{ marginTop: 14, gap: 14 }}>
            <span className="row small muted" style={{ gap: 6 }}>
              <span className="cal-dot" /> запланировано
            </span>
            <span className="row small muted" style={{ gap: 6 }}>
              <span className="cal-dot done" /> выполнено
            </span>
            <span className="row small muted" style={{ gap: 6 }}>
              <span className="cal-dot over" /> просрочено
            </span>
          </div>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>
                {relativeDayLabel(selected)}
              </div>
              <strong>{selected}</strong>
            </div>
            <span className="spacer" />
            <button className="btn sm primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size={14} /> Задача
            </button>
          </div>

          {selectedTasks.length === 0 ? (
            <div className="empty">На эту дату задач нет</div>
          ) : (
            selectedTasks.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                categories={db.categories}
                onToggle={(task) => taskActions.setStatus(task.id, task.status === 'done' ? 'new' : 'done')}
                onEdit={setEditing}
                onDelete={(task) => {
                  if (window.confirm(`Удалить задачу «${task.title}»?`)) {
                    taskActions.remove(task.id);
                    toast('Задача удалена');
                  }
                }}
              />
            ))
          )}
        </div>
      </div>

      {(creating || editing) && (
        <TaskForm
          categories={db.categories}
          task={editing}
          defaultDate={selected}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(data) => {
            if (editing) {
              taskActions.update(editing.id, data);
              toast('Задача обновлена');
            } else {
              taskActions.add(data);
              toast('Задача добавлена');
            }
          }}
        />
      )}
    </>
  );
}
