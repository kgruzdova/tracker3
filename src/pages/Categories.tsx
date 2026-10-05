import { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import type { Category } from '../types';
import { toast } from '../toast';

const PALETTE = [
  '#4f6ef7',
  '#9c6ade',
  '#f28b50',
  '#2fb37a',
  '#e0b400',
  '#ec5f8f',
  '#4bb3d6',
  '#e5484d',
  '#7b8794',
  '#3d5afe',
];

export function CategoriesPage() {
  const { db, categoryActions } = useStore();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);

  const counts = db.tasks.reduce<Record<string, number>>((acc, t) => {
    const key = t.categoryId ?? 'cat_none';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const openCreate = () => {
    setName('');
    setColor(PALETTE[db.categories.length % PALETTE.length]);
    setCreating(true);
  };

  const openEdit = (c: Category) => {
    setName(c.name);
    setColor(c.color);
    setEditing(c);
  };

  const save = () => {
    if (!name.trim()) {
      toast('Введите название категории', 'error');
      return;
    }
    if (editing) {
      categoryActions.update(editing.id, { name: name.trim(), color });
      toast('Категория обновлена');
    } else {
      categoryActions.add(name.trim(), color);
      toast('Категория добавлена');
    }
    setCreating(false);
    setEditing(null);
  };

  const remove = (c: Category) => {
    if (!window.confirm(`Удалить категорию «${c.name}»? Задачи будут перемещены в «Без категории».`)) return;
    categoryActions.remove(c.id);
    toast('Категория удалена');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Категории</h1>
          <div className="page-sub">{db.categories.length} категорий</div>
        </div>
        <button className="btn primary" onClick={openCreate}>
          <Icon name="plus" size={16} /> Новая категория
        </button>
      </div>

      <div className="card">
        {db.categories.map((c) => (
          <div className="list-item" key={c.id}>
            <span className="color-swatch" style={{ background: c.color }} />
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <div style={{ fontWeight: 650, overflowWrap: 'anywhere' }}>{c.name}</div>
              <div className="muted small">
                {counts[c.id] ?? 0} задач
                {c.isDefault ? ' · системная' : ''}
              </div>
            </div>
            <button className="btn icon ghost" title="Редактировать" onClick={() => openEdit(c)}>
              <Icon name="edit" size={16} />
            </button>
            {c.id !== 'cat_none' && (
              <button className="btn icon ghost" title="Удалить" onClick={() => remove(c)}>
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <Modal
          title={editing ? 'Редактировать категорию' : 'Новая категория'}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          footer={
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                Отмена
              </button>
              <button className="btn primary" onClick={save}>
                <Icon name="check" size={16} /> Сохранить
              </button>
            </div>
          }
        >
          <div className="field" style={{ marginBottom: 16 }}>
            <label htmlFor="cat-name">Название</label>
            <input
              id="cat-name"
              className="input"
              value={name}
              autoFocus
              placeholder="Например, Проекты"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
            />
          </div>
          <div className="field">
            <label>Цвет</label>
            <div className="row wrap">
              {PALETTE.map((p) => (
                <button
                  key={p}
                  onClick={() => setColor(p)}
                  aria-label={`Цвет ${p}`}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: p,
                    border: color === p ? '3px solid var(--text)' : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
