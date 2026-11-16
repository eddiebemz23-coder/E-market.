'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'bemz-' + 'install' + '-dismissed';

/**
 * Browsers hide their install entry point behind a menu, and a first-time buyer on a phone
 * never finds it — so the site asks for the install itself. Chromium fires
 * `beforeinstallprompt`, which gives us a one-tap button; iOS Safari refuses programmatic
 * installs, so the banner spells out the Share-sheet path instead of faking a button.
 */
export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(DISMISSED_KEY)) return;
    setHidden(false);

    setIos(
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    );

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as PromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setHidden(true);
    setPromptEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setHidden(true);
  }

  if (hidden) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 md:hidden">
      <div className="card flex items-center gap-3 p-3 shadow-raised">
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">Bemz works as an app on your phone</p>
          <p className="mt-0.5 text-xs text-ink-600">
            {promptEvent
              ? 'Installs in one tap — no app store needed.'
              : ios
                ? 'In Safari: tap Share, then "Add to Home Screen".'
                : 'Or open the browser menu (⋮) and tap "Install app".'}
          </p>
        </div>
        {promptEvent && (
          <Button size="sm" className="shrink-0" onClick={install}>
            <Download className="size-4" />
            Install
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install message"
          className="shrink-0 rounded p-1 text-ink-400 hover:text-ink-600"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
