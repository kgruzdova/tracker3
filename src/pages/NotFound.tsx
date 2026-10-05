import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';

export function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: 420 }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            background: 'var(--primary-weak)',
            color: 'var(--primary)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 14px',
          }}
        >
          <Icon name="help" size={26} />
        </div>
        <h1>404</h1>
        <p className="muted" style={{ margin: '8px 0 18px' }}>
          Такой страницы нет. Возможно, ссылка устарела.
        </p>
        <Link className="btn primary" to="/app/today">
          Вернуться к планировщику
        </Link>
      </div>
    </div>
  );
}
