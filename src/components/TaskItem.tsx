import { useNavigate } from 'react-router-dom';
import type { Category, Task } from '../types';
import { PRIORITY_LABELS, STATUS_LABELS } from '../types';
import { Icon } from './Icon';
import { isOverdue } from '../store/selectors';
import { formatShortDate } from '../utils/dates';

interface Props {
  task: Task;
  categories: Category[];
  onToggle?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  selected?: boolean;
  onSelect?: (task: Task, checked: boolean) => void;
  showDate?: boolean;
  selectable?: boolean;
}

export function TaskItem({
  task,
  categories,
  onToggle,
  onEdit,
  onDelete,
  selected,
  onSelect,
  showDate,
  selectable,
}: Props) {
  const navigate = useNavigate();
  const cat = categories.find((c) => c.id === task.categoryId) ?? categories[categories.length - 1];
  const done = task.status === 'done';
  const overdue = isOverdue(task);

  return (
    <div className={`task${done ? ' is-done' : ''}${selected ? ' is-selected' : ''}`}>
      {selectable ? (
        <input
          type="checkbox"
          className="check"
          checked={Boolean(selected)}
          onChange={(e) => onSelect?.(task, e.target.checked)}
          aria-label="Выбрать задачу"
        />
      ) : (
        <button
          className={`check${done ? ' on' : ''}`}
          onClick={() => onToggle?.(task)}
          aria-label={done ? 'Вернуть в работу' : 'Отметить выполненной'}
        >
          <Icon name="check" size={13} />
        </button>
      )}

      <div
        className="task-body"
        onClick={() => navigate(`/app/tasks/${task.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') navigate(`/app/tasks/${task.id}`);
        }}
        style={{ cursor: 'pointer' }}
      >
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.dueTime ? <span className={`task-time${overdue ? ' overdue' : ''}`}>{task.dueTime}</span> : null}
          {showDate ? <span className={overdue ? 'task-time overdue' : ''}>{formatShortDate(task.dueDate)}</span> : null}
          <span className="tag">
            <span className="dot" style={{ background: cat?.color }} />
            {cat?.name}
          </span>
          <span className={`badge ${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span>
          {task.status !== 'new' && !done ? (
            <span className="badge low" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
              {STATUS_LABELS[task.status]}
            </span>
          ) : null}
          {task.repeat !== 'none' ? <span>↻ {task.repeat === 'daily' ? 'ежедневно' : 'еженедельно'}</span> : null}
          {overdue ? <span style={{ color: 'var(--danger)', fontWeight: 650 }}>просрочено</span> : null}
        </div>
      </div>

      <div className="task-actions">
        {onEdit ? (
          <button className="btn icon ghost" title="Редактировать" onClick={() => onEdit(task)}>
            <Icon name="edit" size={16} />
          </button>
        ) : null}
        {onDelete ? (
          <button className="btn icon ghost" title="Удалить" onClick={() => onDelete(task)}>
            <Icon name="trash" size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
