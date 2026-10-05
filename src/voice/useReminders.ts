import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { playSignal, speak, speechSupported, useVoices } from './speech';
import { toast } from '../toast';

const SNOOZE_MINUTES = 10;
const REPEAT_INTERVAL_MS = SNOOZE_MINUTES * 60000;
const GRACE_MS = 15 * 60000;
const RUNTIME_KEY = 'planner_reminder_runtime_v1';

interface RuntimeEntry {
  count: number;
  nextAt: number | null;
  text: string;
}

type RuntimeMap = Record<string, RuntimeEntry>;

interface Source {
  key: string;
  text: string;
  baseAt: number;
  taskId: string | null;
  displayTime: string;
}

function loadRuntime(): RuntimeMap {
  try {
    const raw = localStorage.getItem(RUNTIME_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RuntimeMap;
    const cutoff = Date.now() - 24 * 3600000;
    const cleaned: RuntimeMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.count === 'number' && (v.nextAt === null || v.nextAt > cutoff)) cleaned[k] = v;
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveRuntime(map: RuntimeMap) {
  try {
    localStorage.setItem(RUNTIME_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function parseFireAt(s: string): number {
  const d = new Date(s.length === 16 ? `${s}:00` : s);
  return d.getTime();
}

const inFlight = new Set<string>();

export interface FiredReminder {
  key: string;
  text: string;
  taskId: string | null;
  displayTime: string;
  at: string;
}

export function useReminders() {
  const { db, setDB, reminderActions } = useStore();
  const voices = useVoices();
  const [unlocked, setUnlocked] = useState(false);
  const [last, setLast] = useState<FiredReminder | null>(null);
  const runtimeRef = useRef<RuntimeMap>({});
  const voicesRef = useRef(voices);
  voicesRef.current = voices;
  const settingsRef = useRef(db.settings);
  settingsRef.current = db.settings;

  useEffect(() => {
    runtimeRef.current = loadRuntime();
  }, []);

  useEffect(() => {
    const unlock = () => setUnlocked(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const sources = useMemo<Source[]>(() => {
    const out: Source[] = [];
    for (const r of db.reminders) {
      out.push({
        key: `rem:${r.id}`,
        text: r.text,
        baseAt: parseFireAt(r.fireAt),
        taskId: r.taskId,
        displayTime: r.fireAt.slice(11, 16),
      });
    }
    for (const t of db.tasks) {
      if (t.archived || !t.dueTime || t.status === 'done' || t.status === 'cancelled') continue;
      out.push({
        key: `task:${t.id}`,
        text: `Напоминание. ${t.title}. Время ${t.dueTime}`,
        baseAt: parseFireAt(`${t.dueDate}T${t.dueTime}`),
        taskId: t.id,
        displayTime: t.dueTime,
      });
    }
    return out;
  }, [db.reminders, db.tasks]);

  const fire = useCallback(
    async (source: Source, runtime: RuntimeMap) => {
      const settings = settingsRef.current;
      const entry = runtime[source.key] ?? { count: 0, nextAt: null, text: source.text };
      entry.text = source.text;
      const atISO = new Date().toISOString();

      if (settings.voice.signal) playSignal();

      let result: 'spoken' | 'no-voice' | 'blocked' | 'error' = 'blocked';
      if (settings.voice.enabled && speechSupported()) {
        result = await speak({
          text: source.text,
          voiceURI: settings.voice.voiceURI,
          rate: settings.voice.rate,
          volume: settings.voice.volume / 100,
        });
      }

      entry.count += 1;
      entry.nextAt = entry.count <= settings.voice.repeats ? Date.now() + REPEAT_INTERVAL_MS : null;
      runtime[source.key] = entry;
      saveRuntime(runtime);

      if (result === 'no-voice') {
        toast(`Русский голос не найден. ${source.text}`, 'error');
      } else if (result === 'blocked') {
        toast(speechSupported() ? `${source.text}` : 'Голосовые напоминания недоступны в этом браузере', 'error');
      } else if (result === 'error') {
        toast(`Не удалось озвучить: ${source.text}`, 'error');
      }

      reminderActions.log({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        at: atISO,
        text: source.text,
        result: result === 'spoken' ? 'spoken' : result === 'no-voice' ? 'signal-only' : result === 'blocked' ? 'blocked' : 'error',
        detail: result === 'spoken' ? undefined : result,
      });

      if (source.key.startsWith('rem:')) {
        const id = source.key.slice(4);
        setDB((prev) => ({
          ...prev,
          reminders: prev.reminders.map((r) =>
            r.id === id
              ? { ...r, status: entry.nextAt !== null ? 'snoozed' : 'fired', snoozeCount: entry.count - 1 }
              : r,
          ),
        }));
      }

      setLast({
        key: source.key,
        text: source.text,
        taskId: source.taskId,
        displayTime: source.displayTime,
        at: atISO,
      });
    },
    [reminderActions.log, setDB],
  );

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const runtime = loadRuntime();
      const now = Date.now();
      for (const source of sources) {
        const entry = runtime[source.key];
        const candidate = entry ? entry.nextAt : source.baseAt;
        if (candidate === null || candidate === undefined) continue;
        if (now < candidate) continue;
        if (now - candidate > GRACE_MS) continue;
        if (entry && entry.count > 0 && entry.nextAt === null) continue;
        if (inFlight.has(source.key)) continue;
        inFlight.add(source.key);
        void fire(source, runtime).finally(() => inFlight.delete(source.key));
        break;
      }
    };

    tick();
    const timer = window.setInterval(tick, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sources, fire]);

  const snooze = useCallback(() => {
    if (!last) return;
    const runtime = loadRuntime();
    const entry = runtime[last.key] ?? { count: 0, nextAt: null, text: last.text };
    entry.nextAt = Date.now() + SNOOZE_MINUTES * 60000;
    runtime[last.key] = entry;
    saveRuntime(runtime);
    if (last.key.startsWith('rem:')) {
      const id = last.key.slice(4);
      setDB((prev) => ({
        ...prev,
        reminders: prev.reminders.map((r) => (r.id === id ? { ...r, status: 'snoozed' as const } : r)),
      }));
    }
    toast(`Отложено на ${SNOOZE_MINUTES} минут`);
    setLast(null);
  }, [last, setDB]);

  const dismiss = useCallback(() => setLast(null), []);

  const unlockAudio = useCallback(() => {
    playSignal();
    setUnlocked(true);
  }, []);

  return { last, snooze, dismiss, unlocked, unlockAudio, voices, supported: speechSupported() };
}
