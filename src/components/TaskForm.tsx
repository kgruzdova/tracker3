import { useState } from 'react';
import type { Category, Priority, Repeat, Task, TaskStatus } from '../types';
import { PRIORITY_LABELS, STATUS_LABELS } from '../types';
import { Modal } from './Modal';
import { Icon } from './Icon';

interface Props {
  categories: Category[];
  task?: Task | null;
  defaultDate?: string;
  onSave: (data: {
    title: string;
    description: string;
    categoryId: string | null;
    priority: Priority;
    dueDate: string;
    dueTime: string | null;
    status: TaskStatus;
    repeat: Repeat;
  }) => void;
  onClose: () => void;
}

export function TaskForm({ categories, task, defaultDate, onSave, onClose }: Props) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [categoryId, setCategoryId] = useState<string>(task?.categoryId ?? 'cat_none');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? defaultDate ?? new Date().toISOString().slice(0, 10));
  const [dueTime, setDueTime] = useState(task?.dueTime ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'new');
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat ?? 'none');
  const [error, setError] = useState('');

  const submit = () => {
    if (!title.trim()) {
      setError('Введите название задачи');
      return;
    }
    onSave({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      priority,
      dueDate,
      dueTime: dueTime || null,
      status,
      repeat,
    });
    onClose();
  };

  return (
    <Modal
      title={task ? 'Редактирование задачи' : 'Новая задача'}
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Отмена
          </button>
          <button className="btn primary" onClick={submit}>
            <Icon name="check" size={16} /> {task ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="tf-title">Название</label>
          <input
            id="tf-title"
            className="input"
            value={title}
            autoFocus
            placeholder="Что нужно сделать?"
            onChange={(e) => {
              setTitle(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          {error && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}
        </div>

        <div className="field full">
          <label htmlFor="tf-desc">Описание</label>
          <textarea
            id="tf-desc"
            className="textarea"
            value={description}
            placeholder="Детали, ссылки, заметки…"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="tf-cat">Категория</label>
          <select id="tf-cat" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="tf-pri">Приоритет</label>
          <select id="tf-pri" className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="high">{PRIORITY_LABELS.high}</option>
            <option value="medium">{PRIORITY_LABELS.medium}</option>
            <option value="low">{PRIORITY_LABELS.low}</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="tf-date">Дата</label>
          <input id="tf-date" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="tf-time">Время</label>
          <input
            id="tf-time"
            type="time"
            className="input"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="tf-status">Статус</label>
          <select id="tf-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="tf-repeat">Повтор</label>
          <select id="tf-repeat" className="select" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
            <option value="none">Разово</option>
            <option value="daily">Ежедневно</option>
            <option value="weekly">Еженедельно</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
