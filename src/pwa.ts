import { useSyncExternalStore } from 'react';

interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  /** True once a service worker controls this page, so reloading offline will work. */
  controlled: boolean;
  online: boolean;
  registrationError: string | null;
}

let state: PwaState = {
  needRefresh: false,
  offlineReady: false,
  controlled: typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  registrationError: null,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
let doUpdate: ((reload?: boolean) => Promise<void>) | null = null;

export function initPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => set({ controlled: true }));
  if (import.meta.env.DEV) return;
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      doUpdate = registerSW({
        onNeedRefresh: () => set({ needRefresh: true }),
        onOfflineReady: () => set({ offlineReady: true, controlled: true }),
        onRegisterError: (e: unknown) => set({ registrationError: String(e) }),
      });
    })
    .catch((e: unknown) => set({ registrationError: String(e) }));
}

export function applyUpdate() {
  if (doUpdate) void doUpdate(true);
  else window.location.reload();
}

export function dismissOfflineReady() {
  set({ offlineReady: false });
}

export function dismissRefresh() {
  set({ needRefresh: false });
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
