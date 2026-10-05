import { dismissToast, useToasts } from '../toast';
import { Icon } from './Icon';

export function Toasts() {
  const items = useToasts();
  return (
    <div className="toasts">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.kind === 'error' ? ' error' : ''}`} onClick={() => dismissToast(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <div style={{ marginBottom: action ? 12 : 0 }}>{text}</div>
      {action}
    </div>
  );
}

export function IconCheck() {
  return <Icon name="check" size={16} />;
}
