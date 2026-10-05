import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { TaskItem } from '../components/TaskItem';
import { TaskForm } from '../components/TaskForm';
import { Icon } from '../components/Icon';
import type { Priority, Task, TaskStatus } from '../types';
import { PRIORITY_LABELS, STATUS_LABELS } from '../types';
import { addDaysISO, todayISO } from '../utils/dates';
import { toast } from '../toast';

export function Tasks() {
  const { db, taskActions } = useStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [date, setDate] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/ё/g, 'е');
    return db.tasks
      .filter((t) => (showArchived ? true : !t.archived))
      .filter((t) => (category ? t.categoryId === category : true))
      .filter((t) => (status ? t.status === status : true))
      .filter((t) => (priority ? t.priority === priority : true))
      .filter((t) => (date ? t.dueDate === date : true))
      .filter((t) =>
        q
          ? `${t.title} ${t.description}`.toLowerCase().replace(/ё/g, 'е').includes(q)
          : true,
      )
      .sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99');
      });
  }, [db.tasks, search, category, status, priority, date, showArchived]);

  const selectedIds = [...selected];

  const toggleSelect = (task: Task, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(task.id);
      else next.delete(task.id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const bulkDone = () => {
    selectedIds.forEach((id) => taskActions.setStatus(id, 'done'));
    toast(`Отмечено выполненной: ${selectedIds.length}`);
    clearSelection();
  };

  const bulkMove = () => {
    taskActions.move(selectedIds, addDaysISO(todayISO(), 1));
    toast(`Перенесено на завтра: ${selectedIds.length}`);
    clearSelection();
  };

  const bulkDelete = () => {
    if (!window.confirm(`Удалить выбранные задачи (${selectedIds.length})?`)) return;
    selectedIds.forEach((id) => taskActions.remove(id));
    toast('Задачи удалены');
    clearSelection();
  };

  const resetFilters = () => {
    setSearch('');
    setCategory('');
    setStatus('');
    setPriority('');
    setDate('');
  };

  const filtersActive = Boolean(search || category || status || priority || date);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Задачи</h1>
          <div className="page-sub">
            Найдено {filtered.length} из {db.tasks.length}
          </div>
        </div>
        <button className="btn primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} /> Новая задача
        </button>
      </div>

      <div className="card">
        <div className="filters">
          <input
            className="input"
            placeholder="Поиск по названию и описанию"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220, flex: '1 1 220px' }}
          />
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Все категории</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
            <option value="">Любой приоритет</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className={`chip${showArchived ? ' active' : ''}`} onClick={() => setShowArchived((v) => !v)}>
            Архив
          </button>
          {filtersActive && (
            <button className="btn sm ghost" onClick={resetFilters}>
              <Icon name="close" size={14} /> Сбросить
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="bulkbar">
            <span>Выбрано: {selected.size}</span>
            <span className="spacer" />
            <button className="btn sm" onClick={bulkDone}>
              <Icon name="check" size={14} /> Выполнено
            </button>
            <button className="btn sm" onClick={bulkMove}>
              <Icon name="right" size={14} /> На завтра
            </button>
            <button className="btn sm danger" onClick={bulkDelete}>
              <Icon name="trash" size={14} /> Удалить
            </button>
            <button className="btn sm ghost" onClick={clearSelection}>
              Снять
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty">Ничего не найдено. Измените фильтры или добавьте задачу.</div>
        ) : (
          <div>
            {filtered.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                categories={db.categories}
                showDate
                selectable
                selected={selected.has(t.id)}
                onSelect={toggleSelect}
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
          </div>
        )}

        <div className="hint" style={{ marginTop: 12 }}>
          Отметьте задачи чекбоксами, чтобы выполнить, перенести или удалить их пачкой.
        </div>
      </div>

      {(creating || editing) && (
        <TaskForm
          categories={db.categories}
          task={editing}
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
