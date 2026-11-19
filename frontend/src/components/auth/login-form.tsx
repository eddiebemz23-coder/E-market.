'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { ArrowRight, KeyRound, MessageSquare, ShieldCheck } from 'lucide-react';
import { api, ApiFailure } from '@/lib/client/api';
import { useCart } from '@/lib/client/cart-store';
import { PhoneInput } from '@/components/auth/phone-input';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import type { AfricanCountryCode } from '@/lib/geo-africa';

type Mode = 'code' | 'password';

interface OtpTicket {
  e164: string;
  expiresInSeconds: number;
  cooldownSeconds: number;
  devCode?: string;
  message: string;
}

/**
 * Two doors, one session. The code path is what the market uses; the password path exists for
 * admin staff and for shops that insist on one — see `src/lib/auth/options.ts`.
 */
export function LoginForm({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const router = useRouter();
  const { mergeAfterSignIn, count } = useCart();

  const [mode, setMode] = useState<Mode>('code');
  const [region, setRegion] = useState<AfricanCountryCode>('UG');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<OtpTicket | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function sendCode() {
    if (busy || phone.trim().length < 9) return;
    setError(null);
    setBusy(true);
    try {
      const result = await api.post<OtpTicket>('/api/auth/otp/request', {
        phone,
        purpose: 'LOGIN',
        defaultRegion: region,
      });
      setTicket(result);
      setSecondsLeft(result.cooldownSeconds);
    } catch (failure) {
      setError(failure instanceof ApiFailure ? failure.message : 'Could not send the code');
    } finally {
      setBusy(false);
    }
  }

  async function finishSignIn(provider: 'phone-otp' | 'password', credentials: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const result = await signIn(provider, { ...credentials, redirect: false });
      if (!result || result.error) {
        setError(
          result?.error === 'CredentialsSignin'
            ? 'Your sign-in details did not match. Check them and try again.'
            : 'Sign-in failed. Try again, or request a new code.',
        );
        return;
      }

      // A basket filled while browsing as a guest must survive the login that follows it.
      if (count > 0) await mergeAfterSignIn();
      router.replace(callbackUrl);
      router.refresh();
    } catch {
      setError('Could not complete sign-in. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card mx-auto max-w-lg">
      <div className="mb-7 flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-bemz-800">YOUR BEMZ ACCOUNT</p>
        <span className="grid size-10 place-items-center rounded-full bg-bemz-50 text-bemz-800">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-bemz-950 sm:text-4xl">Welcome back</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">Sign in to your African marketplace.</p>

      <div role="group" aria-label="Sign-in method" className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-bemz-50/80 p-1.5">
        {(['code', 'password'] as Mode[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            disabled={busy}
            onClick={() => {
              setMode(option);
              setError(null);
            }}
            className={cn(
              'flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition-colors disabled:opacity-60 min-[400px]:gap-2 min-[400px]:text-sm',
              mode === option ? 'bg-white text-bemz-950 shadow-sm' : 'text-ink-600 hover:text-bemz-800',
            )}
          >
            {option === 'code' ? <MessageSquare className="size-4" aria-hidden="true" /> : <KeyRound className="size-4" aria-hidden="true" />}
            {option === 'code' ? 'One-time code' : 'Password'}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {error}
        </p>
      )}

      {mode === 'code' ? (
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            if (ticket) {
              if (code.length === 6) void finishSignIn('phone-otp', { phone: ticket.e164, code });
            } else {
              void sendCode();
            }
          }}
        >
          <PhoneInput value={phone} onChange={setPhone} region={region} onRegionChange={setRegion} disabled={busy || Boolean(ticket)} />

          {!ticket ? (
            <Button block size="lg" className="rounded-xl bg-bemz-800 hover:bg-bemz-900" loading={busy} disabled={phone.trim().length < 9} type="submit">
              Continue with code <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <>
              <p className="text-sm text-ink-600">{ticket.message}</p>
              <TextField
                label="6-digit code"
                name="code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={busy}
                required
                autoFocus
                placeholder="000000"
                hint={
                  ticket.devCode
                    ? `Development mode — the code is ${ticket.devCode}. It expires in ${Math.round(ticket.expiresInSeconds / 60)} min.`
                    : `Sent to ${ticket.e164}`
                }
              />

              <div className="flex items-center gap-3">
                <Button block size="lg" className="rounded-xl bg-bemz-800 hover:bg-bemz-900" type="submit" loading={busy} disabled={code.length !== 6}>
                  Sign in <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="lg" type="button" disabled={secondsLeft > 0 || busy} onClick={sendCode}>
                  {secondsLeft > 0 ? `${secondsLeft}s` : 'Resend'}
                </Button>
              </div>

              <button type="button" disabled={busy} onClick={() => { setTicket(null); setCode(''); setError(null); }} className="min-h-11 text-sm text-bemz-800 underline disabled:opacity-60">
                Use a different number
              </button>
            </>
          )}
        </form>
      ) : (
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void finishSignIn('password', { identifier, password });
          }}
        >
          <TextField
            label="Phone or email"
            name="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            placeholder="Email or phone with country code"
            disabled={busy}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={busy}
            required
          />
          <Button block size="lg" className="rounded-xl bg-bemz-800 hover:bg-bemz-900" type="submit" loading={busy}>
            Sign in <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </form>
      )}

      <p className="mt-8 border-t border-ink-100 pt-6 text-center text-sm text-ink-600">
        New to Bemz?{' '}
        <Link href="/register" className="font-semibold text-pink-800 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
