import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { runBot, HELP_TEXT } from '../bot/bot';
import type { BotState } from '../bot/bot';
import { getMood } from '../store/actions';
import { todayISO, formatTime } from '../utils/dates';
import { toast } from '../toast';

const STATE_KEY = 'planner_bot_state_v1';

const HELP_GROUPS: Array<{ title: string; items: string[] }> = [
  {
    title: 'Добавление и удаление',
    items: [
      'добавь задачу купить молоко завтра в 18:00',
      'создай задачу позвонить врачу послезавтра',
      'удали задачу купить молоко',
      'сотри задачу курс',
    ],
  },
  {
    title: 'Изменение и перенос',
    items: [
      'переименуй задачу отчёт в отчёт за месяц',
      'перенеси отчёт на завтра',
      'отметь задачу отчёт выполненной',
    ],
  },
  {
    title: 'План и статистика',
    items: ['что у меня на сегодня?', 'план на завтра', 'сколько задач выполнено?', 'статистика'],
  },
  {
    title: 'Напоминания и состояние',
    items: [
      'напомни мне в 17:00 позвонить врачу',
      'поставь напоминание за 15 минут отчёт',
      'я настроение 4',
      'как настроение?',
    ],
  },
  {
    title: 'Управление диалогом',
    items: ['помощь', 'отмена', 'да / нет'],
  },
];

function loadState(): BotState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BotState & { startedAt: number };
    if (!parsed || Date.now() - parsed.startedAt > 5 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: BotState | null) {
  try {
    if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
}

export function ChatPage() {
  const { db, taskActions, reminderActions, moodActions, chatActions } = useStore();
  const [input, setInput] = useState('');
  const [botState, setBotState] = useState<BotState | null>(() => loadState());
  const [showHelp, setShowHelp] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const greetedRef = useRef(false);
  const today = todayISO();

  useEffect(() => saveState(botState), [botState]);

  useEffect(() => {
    if (greetedRef.current) return;
    greetedRef.current = true;
    if (db.chatMessages.length === 0) {
      chatActions.push({
        role: 'bot',
        text: 'Привет! Я умею управлять вашими задачами обычным языком.\nНапишите «помощь», чтобы увидеть примеры команд.',
        meta: 'greeting',
        quickReplies: ['помощь', 'что у меня на сегодня?'],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [db.chatMessages.length]);

  const todayMood = useMemo(() => {
    const entry = getMood(db, today);
    return entry ? { mood: entry.mood, stress: entry.stress } : null;
  }, [db, today]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setInput('');
    chatActions.push({ role: 'user', text });

    const result = runBot(text, { tasks: db.tasks, now: new Date(), state: botState, todayMood });

    for (const effect of result.effects) {
      switch (effect.type) {
        case 'add_task':
          taskActions.add(effect.input);
          break;
        case 'delete_task':
          taskActions.remove(effect.id);
          break;
        case 'update_task':
          taskActions.update(effect.id, effect.patch);
          break;
        case 'set_status':
          taskActions.setStatus(effect.id, effect.status);
          break;
        case 'move_task':
          taskActions.move([effect.id], effect.date);
          break;
        case 'add_reminder':
          reminderActions.add({
            taskId: effect.taskId,
            text: effect.text,
            fireAt: effect.fireAt,
            offsetMinutes: effect.offsetMinutes,
            status: 'pending',
            snoozeCount: 0,
          });
          break;
        case 'mood': {
          const prev = getMood(db, today);
          moodActions.upsert({
            date: today,
            mood: effect.mood ?? prev?.mood ?? 3,
            stress: effect.stress ?? prev?.stress ?? 3,
            comment: prev?.comment ?? '',
          });
          break;
        }
      }
    }

    setBotState(result.state);
    chatActions.push({ role: 'bot', text: result.text, quickReplies: result.quickReplies });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Чат-бот</h1>
          <div className="page-sub">Управление задачами обычным языком · работает офлайн</div>
        </div>
        <div className="row">
          <button className="btn icon" title="Примеры команд" onClick={() => setShowHelp(true)}>
            <Icon name="help" size={18} />
          </button>
          <button
            className="btn"
            onClick={() => {
              if (window.confirm('Очистить историю диалога?')) {
                chatActions.clear();
                setBotState(null);
                saveState(null);
                toast('История очищена');
              }
            }}
          >
            <Icon name="trash" size={15} /> Очистить историю
          </button>
        </div>
      </div>

      <div className="card chat-wrap">
        <div className="chat-log" ref={logRef}>
          {db.chatMessages.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {m.text}
              <div className="msg-time">{formatTime(m.createdAt)}</div>
            </div>
          ))}
          {botState && (
            <div className="hint" style={{ alignSelf: 'flex-start', paddingLeft: 6 }}>
              Бот ждёт ответа… напишите «отмена», чтобы прервать.
            </div>
          )}
          {db.chatMessages.length > 0 && db.chatMessages[db.chatMessages.length - 1]?.quickReplies && (
            <div className="quick-replies">
              {db.chatMessages[db.chatMessages.length - 1].quickReplies!.map((q) => (
                <button className="chip" key={q} onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="chat-input">
          <input
            className="input"
            value={input}
            placeholder="Например: добавь задачу купить молоко завтра"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send(input);
            }}
          />
          <button className="btn primary" onClick={() => send(input)} disabled={!input.trim()}>
            <Icon name="right" size={16} /> Отправить
          </button>
        </div>
      </div>

      {showHelp && (
        <Modal title="Что я умею" onClose={() => setShowHelp(false)} wide>
          <div style={{ whiteSpace: 'pre-line', fontSize: 14.5, marginBottom: 18 }}>{HELP_TEXT}</div>
          <div className="grid two">
            {HELP_GROUPS.map((g) => (
              <div className="card" key={g.title} style={{ boxShadow: 'none' }}>
                <div className="card-title">{g.title}</div>
                {g.items.map((i) => (
                  <div className="list-item" key={i} style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, overflowWrap: 'anywhere' }}>«{i}»</span>
                    <span className="spacer" />
                    <button className="btn sm ghost" onClick={() => {
                      setShowHelp(false);
                      send(i);
                    }}>
                      <Icon name="play" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
