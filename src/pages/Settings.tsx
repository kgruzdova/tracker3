import { useRef, useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Icon } from '../components/Icon';
import { hasRussianVoice, speechSupported, useVoices, pickVoice } from '../voice/speech';
import { migrate } from '../store/db';
import type { DB } from '../types';
import { formatTime } from '../utils/dates';
import { HELP_TEXT } from '../bot/bot';
import { toast } from '../toast';

const APP_VERSION = '1.0.0';

export function SettingsPage() {
  const { db, settingsActions, replaceDB, resetDB, reminderActions } = useStore();
  const voices = useVoices();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<DB | null>(null);
  const [importError, setImportError] = useState('');
  const voice = db.settings.voice;
  const supported = speechSupported();

  const ruVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('ru'));
  const otherVoices = voices.filter((v) => !v.lang.toLowerCase().startsWith('ru'));

  const patchVoice = (patch: Partial<typeof voice>) =>
    settingsActions.update({ voice: { ...voice, ...patch } });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planner-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Файл экспортирован');
  };

  const onPickFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as DB).tasks)) {
          throw new Error('bad');
        }
        setImportPreview(migrate(parsed));
        setImportError('');
      } catch {
        setImportPreview(null);
        setImportError('Файл не похож на экспорт планировщика');
      }
    };
    reader.onerror = () => setImportError('Не удалось прочитать файл');
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!importPreview) return;
    if (!window.confirm('Импорт заменит все текущие данные. Продолжить?')) return;
    replaceDB(importPreview);
    setImportPreview(null);
    toast('Данные импортированы');
  };

  const clearAll = () => {
    if (!window.confirm('Первое подтверждение: очистить все данные планировщика?')) return;
    if (!window.confirm('Второе подтверждение: удалить задачи, чек-ины и настройки без возможности восстановления?'))
      return;
    resetDB();
    toast('Данные очищены');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <div className="page-sub">Тема, голос, данные и справка</div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-title">Внешний вид</div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>Тема оформления</span>
            <div className="segmented">
              {(
                [
                  ['system', 'Система'],
                  ['light', 'Светлая'],
                  ['dark', 'Тёмная'],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  className={db.settings.theme === v ? 'on' : ''}
                  onClick={() => settingsActions.update({ theme: v })}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginTop: 18 }}>
            <label htmlFor="limit">Базовая дневная норма задач: {db.settings.dailyTaskLimit}</label>
            <input
              id="limit"
              className="range"
              type="range"
              min={1}
              max={10}
              value={db.settings.dailyTaskLimit}
              onChange={(e) => settingsActions.update({ dailyTaskLimit: Number(e.target.value) })}
            />
            <span className="hint">Используется в формуле рекомендаций по нагрузке.</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Голосовые напоминания</div>

          {!supported && (
            <div className="banner danger" style={{ marginBottom: 14 }}>
              <Icon name="speaker" size={17} /> Браузер не поддерживает синтез речи. Остальные функции работают.
            </div>
          )}

          {supported && ruVoices.length === 0 && voices.length > 0 && (
            <div className="banner warn" style={{ marginBottom: 14 }}>
              <Icon name="speaker" size={17} /> Русский голос не найден: напоминания покажутся текстом + сигналом.
            </div>
          )}

          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <span>Включить голосовые напоминания</span>
            <button
              className={`switch${voice.enabled ? ' on' : ''}`}
              role="switch"
              aria-checked={voice.enabled}
              onClick={() => patchVoice({ enabled: !voice.enabled })}
            />
          </div>

          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <span>Предупредительный сигнал</span>
            <button
              className={`switch${voice.signal ? ' on' : ''}`}
              role="switch"
              aria-checked={voice.signal}
              onClick={() => patchVoice({ signal: !voice.signal })}
            />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="vvoice">Голос</label>
            <select
              id="vvoice"
              className="select"
              value={voice.voiceURI || (pickVoice(voices, '')?.voiceURI ?? '')}
              onChange={(e) => patchVoice({ voiceURI: e.target.value })}
              disabled={!supported}
            >
              <option value="">Авто (приоритет ru-RU)</option>
              {ruVoices.length > 0 && (
                <optgroup label="Русские">
                  {ruVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </optgroup>
              )}
              {otherVoices.length > 0 && (
                <optgroup label="Другие">
                  {otherVoices.slice(0, 40).map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {supported && voices.length === 0 && <span className="hint">Голоса ещё загружаются…</span>}
            {supported && !hasRussianVoice(voices) && voices.length > 0 && (
              <span className="hint">Русский голос в системе не обнаружен.</span>
            )}
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="vrate">
              Скорость речи: {voice.rate.toFixed(1)}x
            </label>
            <input
              id="vrate"
              className="range"
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={voice.rate}
              onChange={(e) => patchVoice({ rate: Number(e.target.value) })}
            />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="vvol">Громкость: {voice.volume}%</label>
            <input
              id="vvol"
              className="range"
              type="range"
              min={0}
              max={100}
              value={voice.volume}
              onChange={(e) => patchVoice({ volume: Number(e.target.value) })}
            />
          </div>

          <div className="field">
            <label htmlFor="vrep">Повторов напоминания: {voice.repeats}</label>
            <input
              id="vrep"
              className="range"
              type="range"
              min={0}
              max={3}
              value={voice.repeats}
              onChange={(e) => patchVoice({ repeats: Number(e.target.value) })}
            />
            <span className="hint">Интервал повтора и «отложить» — 10 минут.</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">Журнал напоминаний</div>
        {db.reminderLog.length === 0 ? (
          <div className="empty">Сработавших напоминаний пока нет</div>
        ) : (
          [...db.reminderLog]
            .slice()
            .reverse()
            .slice(0, 20)
            .map((l) => (
              <div className="history-item" key={l.id}>
                <span style={{ width: 100, fontVariantNumeric: 'tabular-nums' }}>{formatTime(l.at)}</span>
                <span style={{ flex: '1 1 auto', overflowWrap: 'anywhere' }}>{l.text}</span>
                <span className="tag">
                  {l.result === 'spoken'
                    ? 'озвучено'
                    : l.result === 'signal-only'
                      ? 'текст + сигнал'
                      : l.result === 'blocked'
                        ? 'недоступно'
                        : 'ошибка'}
                </span>
              </div>
            ))
        )}
        {db.reminderLog.length > 0 && (
          <button className="btn sm ghost" style={{ marginTop: 10 }} onClick={() => reminderActions.clearLog()}>
            Очистить журнал
          </button>
        )}
      </div>

      <div className="grid two" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-title">Данные</div>
          <div className="row wrap">
            <button className="btn" onClick={exportData}>
              <Icon name="download" size={16} /> Экспорт JSON
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} /> Импорт JSON
            </button>
            <button className="btn danger" onClick={clearAll}>
              <Icon name="trash" size={16} /> Очистить данные
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
              e.target.value = '';
            }}
          />
          <div className="hint" style={{ marginTop: 12 }}>
            Данные хранятся только в этом браузере (localStorage) и не покидают устройство.
          </div>

          {importError && <div className="banner danger" style={{ marginTop: 12 }}>{importError}</div>}

          {importPreview && (
            <div className="banner info" style={{ marginTop: 12, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <span>
                Найдено: {importPreview.tasks.length} задач, {importPreview.moodEntries.length} чек-инов,{' '}
                {importPreview.categories.length} категорий.
              </span>
              <div className="row">
                <button className="btn sm primary" onClick={confirmImport}>
                  Заменить данные
                </button>
                <button className="btn sm" onClick={() => setImportPreview(null)}>
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">О приложении</div>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="muted">Версия</span>
            <strong>{APP_VERSION}</strong>
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <span className="muted">Хранилище</span>
            <strong>planner_db_v1</strong>
          </div>
          <div className="hint" style={{ marginBottom: 10 }}>
            Планировщик — офлайн PWA: задачи, трекер состояния, голосовые напоминания и чат-бот без нейросетей.
          </div>
          <button className="btn" onClick={() => window.alert(HELP_TEXT)}>
            <Icon name="help" size={16} /> Справка по командам бота
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">История данных</div>
        <div className="row wrap" style={{ gap: 18 }}>
          <span className="muted small">Задач: {db.tasks.length}</span>
          <span className="muted small">Категорий: {db.categories.length}</span>
          <span className="muted small">Чек-инов: {db.moodEntries.length}</span>
          <span className="muted small">Напоминаний: {db.reminders.length}</span>
          <span className="muted small">Сообщений чата: {db.chatMessages.length}</span>
        </div>
      </div>
    </>
  );
}

