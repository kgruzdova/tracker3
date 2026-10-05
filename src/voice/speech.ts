import { useEffect, useState } from 'react';

export type SpeakResult = 'spoken' | 'no-voice' | 'blocked' | 'error';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!speechSupported()) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    const timer = window.setTimeout(load, 600);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.clearTimeout(timer);
    };
  }, []);

  return voices;
}

export function pickVoice(voices: SpeechSynthesisVoice[], voiceURI: string): SpeechSynthesisVoice | null {
  if (voiceURI) {
    const exact = voices.find((v) => v.voiceURI === voiceURI);
    if (exact) return exact;
  }
  const ru = voices.filter((v) => v.lang.toLowerCase().startsWith('ru'));
  if (ru.length) return ru[0];
  const any = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return any[0] ?? null;
}

export function hasRussianVoice(voices: SpeechSynthesisVoice[]): boolean {
  return voices.some((v) => v.lang.toLowerCase().startsWith('ru'));
}

let audioCtx: AudioContext | null = null;

export function playSignal(kind: 'soft' | 'loud' = 'soft'): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const freqs = kind === 'loud' ? [880, 1174] : [740];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  } catch {
    // аудио недоступно — молча пропускаем
  }
}

export interface SpeakOptions {
  text: string;
  voiceURI: string;
  rate: number;
  volume: number;
}

export function speak({ text, voiceURI, rate, volume }: SpeakOptions): Promise<SpeakResult> {
  if (!speechSupported()) return Promise.resolve('blocked');
  const synth = window.speechSynthesis;
  try {
    synth.cancel();
    const voice = pickVoice(synth.getVoices(), voiceURI);
    if (!voice || !voice.lang.toLowerCase().startsWith('ru')) {
      return Promise.resolve('no-voice');
    }
    return new Promise<SpeakResult>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.rate = rate;
      u.volume = Math.min(1, Math.max(0, volume));
      let settled = false;
      const finish = (r: SpeakResult) => {
        if (settled) return;
        settled = true;
        resolve(r);
      };
      u.onend = () => finish('spoken');
      u.onerror = (e) => finish(e.error === 'interrupted' ? 'spoken' : 'error');
      window.setTimeout(() => finish('error'), 12000);
      try {
        synth.speak(u);
      } catch {
        finish('error');
      }
    });
  } catch {
    return Promise.resolve('error');
  }
}
