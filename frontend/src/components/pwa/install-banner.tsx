'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '@/lib/client/install-prompt';

const DISMISSED_KEY = 'bemz-' + 'install' + '-dismissed';

/**
 * The proactive half of installation: a card that appears unprompted on phones. The header
 * button is the permanent entry point, so this only has to catch people who would never notice
 * it — and it stays out of the way once dismissed or once the app is installed.
 */
export function InstallBanner() {
  const pathname = usePathname();
  const { canPrompt, standalone, ios, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (standalone || localStorage.getItem(DISMISSED_KEY)) return;
    setDismissed(false);
  }, [standalone]);

  async function onInstall() {
    const outcome = await install();
    if (outcome === 'accepted') setDismissed(true);
  }

  function onDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  }

  if (dismissed || standalone || pathname === '/login' || pathname === '/register') return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 md:hidden">
      <div className="card flex items-center gap-3 p-3 shadow-raised">
        <img src="/icons/icon-192.png" alt="" className="size-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-900">Bemz works as an app on your phone</p>
          <p className="mt-0.5 text-xs text-ink-600">
            {canPrompt
              ? 'Installs in one tap, no app store needed.'
              : ios
                ? 'In Safari: tap Share, then "Add to Home Screen".'
                : 'Or open the browser menu and tap "Install app".'}
          </p>
        </div>
        {canPrompt && (
          <Button size="sm" className="shrink-0" onClick={onInstall}>
            <Download className="size-4" />
            Install
          </Button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss install message"
          className="shrink-0 rounded p-1 text-ink-400 hover:text-ink-600"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
