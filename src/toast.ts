import { useSyncExternalStore } from 'react';

export interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

let items: ToastItem[] = [];
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function toast(text: string, kind: 'info' | 'error' = 'info') {
  counter += 1;
  const item = { id: counter, text, kind };
  items = [...items, item].slice(-4);
  emit();
  setTimeout(() => {
    items = items.filter((i) => i.id !== item.id);
    emit();
  }, 4000);
}

export function dismissToast(id: number) {
  items = items.filter((i) => i.id !== id);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => items,
  );
}
