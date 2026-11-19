import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/guards';
import { LoginForm } from '@/components/auth/login-form';
import { ArrowUpRight, Globe2, ShoppingBag, Store } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Bemz with a code sent to your phone, or with a password.',
  robots: { index: false, follow: false },
};

/**
 * `callbackUrl` is the page the buyer was on when the site asked them to sign in — checkout, a
 * seller dashboard, an order. It is echoed back only after the session exists.
 */
export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  const user = await getSessionUser();
  if (user) redirect(safeTarget(searchParams.callbackUrl));

  return (
    <div className="auth-page container-page flex items-center py-8 sm:py-14">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_0.95fr] lg:gap-20">
        <aside className="hidden py-8 lg:block">
          <p className="inline-flex items-center gap-2 rounded-full border border-bemz-200/70 bg-white/60 px-4 py-2 text-xs font-semibold tracking-wide text-bemz-900">
            <Globe2 className="size-4" aria-hidden="true" /> THE AFRICAN MARKETPLACE
          </p>
          <h2 className="mt-8 text-6xl font-semibold leading-[1.08] tracking-tight text-bemz-950">
            Your market.<br /><span className="text-pink-800">Across Africa.</span>
          </h2>
          <p className="mt-6 max-w-sm text-lg leading-relaxed text-ink-600">
            Great finds. Local businesses. New possibilities. Your next connection starts here.
          </p>
          <div className="mt-10 flex gap-8 border-t border-bemz-900/10 pt-7">
            <div>
              <ShoppingBag className="mb-3 size-5 text-bemz-800" aria-hidden="true" />
              <p className="text-sm font-semibold text-bemz-950">Find something you love</p>
              <p className="mt-1 text-xs text-ink-600">Discover shops across Africa</p>
            </div>
            <div>
              <Store className="mb-3 size-5 text-pink-800" aria-hidden="true" />
              <p className="text-sm font-semibold text-bemz-950">Grow your business</p>
              <p className="mt-1 text-xs text-ink-600">Make your next connection</p>
            </div>
          </div>
          <p className="mt-12 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-bemz-800">
            A continent of possibilities <ArrowUpRight className="size-4" aria-hidden="true" />
          </p>
        </aside>
        <LoginForm callbackUrl={safeTarget(searchParams.callbackUrl)} />
      </div>
    </div>
  );
}

/** Only ever a same-origin relative path — a signed-in visitor must not be bounced off-site. */
function safeTarget(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return '/';
  return candidate;
}
