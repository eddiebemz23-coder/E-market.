'use client';

import { useSyncExternalStore } from 'react';

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InstallSnapshot = {
  /** The browser handed us an install prompt we can trigger with one tap. */
  canPrompt: boolean;
  /** Already running as an installed app, so every install affordance should disappear. */
  standalone: boolean;
  /** iOS never fires beforeinstallprompt, so the instructions are the only path there. */
  ios: boolean;
};

const IDLE: InstallSnapshot = { canPrompt: false, standalone: false, ios: false };

let snapshot = IDLE;
let pendingEvent: PromptEvent | null = null;
const listeners = new Set<() => void>();
let listening = false;

function publish(next: InstallSnapshot) {
  snapshot = next;
  for (const notify of listeners) notify();
}

/**
 * One listener for the whole app. `beforeinstallprompt` fires once and its event object is
 * single-use, so a header button and a banner each keeping their own copy would leave one of
 * them pointing at an already-consumed prompt.
 */
function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;

  publish({
    canPrompt: false,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true,
    ios:
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    pendingEvent = event as PromptEvent;
    publish({ ...snapshot, canPrompt: true });
  });

  window.addEventListener('appinstalled', () => {
    pendingEvent = null;
    publish({ ...snapshot, canPrompt: false, standalone: true });
  });
}

export function useInstallPrompt() {
  const current = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      listen();
      return () => listeners.delete(notify);
    },
    () => snapshot,
    () => IDLE,
  );

  async function install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!pendingEvent) return 'unavailable';
    await pendingEvent.prompt();
    const { outcome } = await pendingEvent.userChoice;
    pendingEvent = null;
    publish({ ...snapshot, canPrompt: false });
    return outcome;
  }

  return { ...current, install };
}
