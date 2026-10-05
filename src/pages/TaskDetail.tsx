import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/StoreContext';
import { TaskForm } from '../components/TaskForm';
import { Icon } from '../components/Icon';
import { PRIORITY_LABELS, STATUS_LABELS } from '../types';
import type { TaskStatus } from '../types';
import { addDaysISO, formatDateTime, formatShortDate, relativeDayLabel } from '../utils/dates';
import { isOverdue } from '../store/selectors';
import { toast } from '../toast';

export function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { db, taskActions } = useStore();
  const [editing, setEditing] = useState(false);
  const task = db.tasks.find((t) => t.id === id);

  if (!task) {
    return (
      <div className="empty">
        Задача не найдена.{' '}
        <Link to="/app/tasks">Вернуться к списку</Link>
      </div>
    );
  }

  const cat = db.categories.find((c) => c.id === task.categoryId);
  const overdue = isOverdue(task);

  const setStatus = (status: TaskStatus) => {
    taskActions.setStatus(task.id, status);
    toast(`Статус: ${STATUS_LABELS[status]}`);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-sub" style={{ marginBottom: 4 }}>
            <Link to="/app/tasks" className="row" style={{ display: 'inline-flex', gap: 5 }}>
              <Icon name="left" size={15} /> Задачи
            </Link>
          </div>
          <h1 style={{ overflowWrap: 'anywhere' }}>{task.title}</h1>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => setEditing(true)}>
            <Icon name="edit" size={16} /> Редактировать
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (window.confirm(`Удалить задачу «${task.title}»?`)) {
                taskActions.remove(task.id);
                toast('Задача удалена');
                navigate('/app/tasks');
              }
            }}
          >
            <Icon name="trash" size={16} /> Удалить
          </button>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-title">Детали</div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Описание</label>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {task.description || <span className="muted">Описание не заполнено</span>}
            </p>
          </div>
          <div className="grid two">
            <div>
              <label className="muted small">Дедлайн</label>
              <div style={{ fontWeight: 650, color: overdue ? 'var(--danger)' : undefined }}>
                {relativeDayLabel(task.dueDate)} · {formatShortDate(task.dueDate)}
                {task.dueTime ? ` в ${task.dueTime}` : ''}
              </div>
            </div>
            <div>
              <label className="muted small">Категория</label>
              <div className="tag" style={{ marginTop: 4 }}>
                <span className="dot" style={{ background: cat?.color }} />
                {cat?.name}
              </div>
            </div>
            <div>
              <label className="muted small">Приоритет</label>
              <div style={{ marginTop: 4 }}>
                <span className={`badge ${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
              </div>
            </div>
            <div>
              <label className="muted small">Повтор</label>
              <div style={{ fontWeight: 600 }}>
                {task.repeat === 'none' ? 'Разово' : task.repeat === 'daily' ? 'Ежедневно' : 'Еженедельно'}
              </div>
            </div>
            <div>
              <label className="muted small">Создано</label>
              <div>{formatDateTime(task.createdAt)}</div>
            </div>
            <div>
              <label className="muted small">Обновлено</label>
              <div>{formatDateTime(task.updatedAt)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Статус</div>
          <div className="segmented" style={{ flexWrap: 'wrap' }}>
            {(['new', 'in_progress', 'done', 'cancelled'] as TaskStatus[]).map((s) => (
              <button key={s} className={task.status === s ? 'on' : ''} onClick={() => setStatus(s)}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {task.completedAt && (
            <div className="hint" style={{ marginTop: 12 }}>
              Выполнена: {formatDateTime(task.completedAt)}
            </div>
          )}

          <div className="row wrap" style={{ marginTop: 18 }}>
            <button className="btn" onClick={() => taskActions.move([task.id], addDaysISO(task.dueDate, 1))}>
              <Icon name="right" size={16} /> На завтра
            </button>
            <button
              className={`btn${task.archived ? '' : ' primary'}`}
              onClick={() => {
                taskActions.archive([task.id], !task.archived);
                toast(task.archived ? 'Возвращена из архива' : 'Перенесена в архив');
              }}
            >
              <Icon name="download" size={16} /> {task.archived ? 'Вернуть из архива' : 'В архив'}
            </button>
          </div>

          <div className="hint" style={{ marginTop: 16 }}>
            Архивные задачи скрыты из активных списков и не участвуют в прогрессе дня.
          </div>
        </div>
      </div>

      {editing && (
        <TaskForm
          categories={db.categories}
          task={task}
          onClose={() => setEditing(false)}
          onSave={(data) => {
            taskActions.update(task.id, data);
            toast('Задача обновлена');
          }}
        />
      )}
    </>
  );
}

