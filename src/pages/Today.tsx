import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { TaskItem } from '../components/TaskItem';
import { TaskForm } from '../components/TaskForm';
import { Icon } from '../components/Icon';
import { parseQuickAdd } from '../bot/parser';
import { computeRecommendation, limitWarning } from '../mood/recommend';
import { dayProgress, isOverdue, overdueTasks } from '../store/selectors';
import { formatLongDate, todayISO } from '../utils/dates';
import { getMood } from '../store/actions';
import type { Task } from '../types';
import { toast } from '../toast';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function Today() {
  const { db, taskActions } = useStore();
  const [quick, setQuick] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const today = todayISO();
  const progress = useMemo(() => dayProgress(db, today), [db, today]);
  const mood = getMood(db, today);

  const reco = useMemo(
    () =>
      computeRecommendation({
        baseLimit: db.settings.dailyTaskLimit,
        mood: mood?.mood ?? null,
        stress: mood?.stress ?? null,
        overdueCount: overdueTasks(db).length,
      }),
    [db, mood],
  );

  const todayTasks = db.tasks.filter((t) => t.dueDate === today && !t.archived && t.status !== 'cancelled');
  const overdue = db.tasks.filter((t) => isOverdue(t) && t.dueDate !== today);
  const inProgress = todayTasks.filter((t) => t.status === 'in_progress');
  const fresh = todayTasks.filter((t) => t.status === 'new' && !isOverdue(t));
  const done = todayTasks.filter((t) => t.status === 'done');
  const plannedCount = todayTasks.filter((t) => t.status !== 'done').length;
  const warning = limitWarning({ plannedCount, limit: reco.limit });

  const submitQuick = () => {
    const parsed = parseQuickAdd(quick);
    if (!parsed.title) {
      toast('Введите название задачи', 'error');
      return;
    }
    taskActions.add({
      title: parsed.title,
      dueDate: parsed.date ?? today,
      dueTime: parsed.time,
    });
    setQuick('');
    toast(`Добавлено: «${parsed.title}»`);
  };

  const section = (label: string, list: Task[], showDate = false) =>
    list.length ? (
      <>
        <div className="section-label">
          {label}
          <span style={{ opacity: 0.7 }}>{list.length}</span>
        </div>
        {list.map((t) => (
          <TaskItem
            key={t.id}
            task={t}
            categories={db.categories}
            showDate={showDate}
            onToggle={(task) => taskActions.setStatus(task.id, task.status === 'done' ? 'new' : 'done')}
            onEdit={setEditing}
            onDelete={(task) => {
              if (window.confirm(`Удалить задачу «${task.title}»?`)) {
                taskActions.remove(task.id);
                toast('Задача удалена');
              }
            }}
          />
        ))}
      </>
    ) : null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            {greeting()}!
          </h1>
          <div className="page-sub">{formatLongDate(today)}</div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> Новая задача
        </button>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <strong>Прогресс дня</strong>
          <span className="spacer" />
          <span className="muted small">
            Выполнено {progress.done} из {progress.total}
          </span>
        </div>
        <div className="progress">
          <span style={{ width: `${progress.percent}%` }} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Быстрое добавление</div>
        <div className="quick-add">
          <input
            className="input"
            value={quick}
            placeholder="Например: купить молоко завтра в 18:00"
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitQuick();
            }}
          />
          <button className="btn primary" onClick={submitQuick}>
            <Icon name="plus" size={16} /> Добавить
          </button>
        </div>
        <div className="hint">Дату и время распознаю сам: «завтра», «в 18:00», «05.10».</div>
      </div>

      {warning && (
        <div className="banner warn" style={{ marginTop: 14 }}>
          <Icon name="today" size={17} /> {warning}
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Рекомендация по нагрузке</div>
        <div className="reco">
          <div className="reco-main">{reco.messages[0]}</div>
          {reco.messages.slice(1).map((m) => (
            <div className="reco-item" key={m}>
              {m}
            </div>
          ))}
          <div className="row wrap" style={{ marginTop: 6 }}>
            <span className="tag">Лимит: {reco.limit}</span>
            {reco.adjustments.map((a) => (
              <span className="tag" key={a.label}>
                {a.label}: {a.delta > 0 ? `+${a.delta}` : a.delta}
              </span>
            ))}
          </div>
        </div>
        {!mood && (
          <div className="row wrap" style={{ marginTop: 14 }}>
            <Link className="btn primary" to="/app/mood">
              <Icon name="mood" size={16} /> Отметить состояние
            </Link>
            <span className="muted small">Чек-ин за сегодня ещё не сделан</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: 6 }}>
        {section('Просрочено', overdue, true)}
        {section('В работе', inProgress)}
        {section('На сегодня', fresh)}
        {section('Готово', done)}
        {!overdue.length && !inProgress.length && !fresh.length && !done.length && (
          <div className="empty" style={{ marginTop: 14 }}>
            На сегодня задач нет. Добавьте первую — например, «запланировать день».
          </div>
        )}
      </div>

      {(creating || editing) && (
        <TaskForm
          categories={db.categories}
          task={editing}
          defaultDate={today}
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
