'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { api, ApiFailure } from '@/lib/client/api';
import { useCart } from '@/lib/client/cart-store';
import { PhoneInput } from '@/components/auth/phone-input';
import { Button } from '@/components/ui/button';
import { CheckboxField, SwitchField, TextField } from '@/components/ui/field';
import { REGIONS, type RegionInfo } from '@/lib/client/regions';
import type { AfricanCountryCode } from '@/lib/geo-africa';

type Region = AfricanCountryCode;

interface RegisterResponse {
  user: { id: string; name: string | null; phone: string; role: string };
  shop: { id: string; name: string; slug: string } | null;
  hasPassword: boolean;
  cartMerged: boolean;
}

/**
 * Registration is one form for both doors: a buyer who wants a password and a trader who wants
 * a shop in the same request. The shop row lands as PENDING because the district, KYC and payout
 * details are filled in on the dashboard — see `createShopShell` in `src/lib/services/accounts.ts`.
 */
export function RegisterForm({ initialSeller = false, callbackUrl = '/' }: { initialSeller?: boolean; callbackUrl?: string }) {
  const router = useRouter();
  const { mergeAfterSignIn, count } = useCart();

  const [region, setRegion] = useState<Region>('UG');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [asSeller, setAsSeller] = useState(initialSeller);
  const [shopName, setShopName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [issues, setIssues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [signedUpPhone, setSignedUpPhone] = useState<string | null>(null);
  const [shopCreated, setShopCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function rememberRegion(next: Region) {
    setRegion(next);
    // The country select and the dialling prefix are the same fact; keep them in step.
    setIssues((current) => ({ ...current, country: '', phone: '' }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIssues({});
    setBusy(true);
    try {
      const result = await api.post<RegisterResponse>('/api/auth/register', {
        name,
        phone,
        email: email.trim(),
        password,
        country: region,
        asSeller,
        shopName: asSeller ? shopName : undefined,
        acceptTerms: true,
      });

      // Send the first verification code to BOTH channels right away; a delivery hiccup must
      // not block account creation — the buyer can resend from the code step below.
      await api
        .post('/api/auth/otp/request', { phone, purpose: 'REGISTER', defaultRegion: region })
        .catch(() => null);

      setShopCreated(Boolean(asSeller && result.shop));
      setSignedUpPhone(result.user.phone);
      setSecondsLeft(60);
    } catch (failure) {
      if (failure instanceof ApiFailure) {
        setIssues(failure.issues);
        setFormError(failure.message);
      } else {
        setFormError('Could not create the account. Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!signedUpPhone) return;
    setOtpError(null);
    setOtpBusy(true);
    const result = await signIn('phone-otp', { phone: signedUpPhone, code, redirect: false });
    setOtpBusy(false);
    if (!result || result.error) {
      setOtpError('That code did not match. Check the latest email or SMS and try again.');
      return;
    }
    if (count > 0) await mergeAfterSignIn();
    router.replace(shopCreated ? '/seller' : callbackUrl);
    router.refresh();
  }

  async function resendCode() {
    if (!signedUpPhone) return;
    setOtpError(null);
    setOtpBusy(true);
    try {
      await api.post('/api/auth/otp/request', { phone: signedUpPhone, purpose: 'REGISTER', defaultRegion: region });
      setSecondsLeft(60);
    } catch (failure) {
      setOtpError(failure instanceof ApiFailure ? failure.message : 'Could not resend the code');
    } finally {
      setOtpBusy(false);
    }
  }

  if (signedUpPhone) {
    return (
      <div className="auth-card mx-auto max-w-lg">
        <p className="mb-5 text-[11px] font-semibold tracking-[0.2em] text-bemz-800">ALMOST THERE</p>
        <h1 className="text-3xl font-semibold tracking-tight text-bemz-950">Check your code</h1>
        <p className="mt-2 text-sm text-ink-600">
          {shopCreated
            ? 'Your shop is open in draft. Verify the account, then add your first listing.'
            : 'One last step before you start buying.'}
        </p>
        <p className="mt-3 text-sm text-ink-500">
          We sent a 6-digit code to <span className="font-medium text-ink-800">{signedUpPhone}</span>
          {email.trim() ? (
            <>
              {' '}and <span className="font-medium text-ink-800">{email.trim()}</span>
            </>
          ) : null}
          . Enter it below.
        </p>

        {otpError && (
          <p role="alert" className="mt-4 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-800">
            {otpError}
          </p>
        )}

        <form className="mt-4 space-y-4" onSubmit={verifyCode}>
          <TextField
            label="6-digit code"
            name="code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            hint="The same code arrives by SMS and email — either one works."
          />
          <div className="flex items-center gap-3">
            <Button block size="lg" type="submit" loading={otpBusy} disabled={code.length !== 6}>
              Verify and continue
            </Button>
            <Button variant="ghost" size="lg" type="button" disabled={secondsLeft > 0 || otpBusy} onClick={resendCode}>
              {secondsLeft > 0 ? `${secondsLeft}s` : 'Resend'}
            </Button>
          </div>
        </form>

        <button
          type="button"
          onClick={() => { setSignedUpPhone(null); setCode(''); setOtpError(null); }}
          className="mt-4 text-sm text-bemz-700 underline"
        >
          Use a different number
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card mx-auto max-w-lg">
      <p className="mb-5 text-[11px] font-semibold tracking-[0.2em] text-bemz-800">JOIN BEMZ AFRICA</p>
      <h1 className="text-3xl font-semibold tracking-tight text-bemz-950">Your next connection starts here.</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        Create your account to shop, sell and connect across Africa.
      </p>

      {formError && (
        <p role="alert" className="mt-4 rounded-lg bg-clay-50 px-3 py-2 text-sm text-clay-800">
          {formError}
        </p>
      )}

      <form className="mt-5 space-y-4" onSubmit={submit}>
        <TextField
          label="Full name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          placeholder="Sarah Nakato"
          error={issues.name}
          required
        />

        <PhoneInput
          value={phone}
          onChange={setPhone}
          region={region}
          onRegionChange={rememberRegion}
          error={issues.phone}
          label="Phone number"
          autoComplete="tel"
          required
        />

        <div>
          <label className="field-label" htmlFor="register-country">
            Country
          </label>
          <select
            id="register-country"
            className="field-input"
            value={region}
            onChange={(event) => rememberRegion(event.target.value as Region)}
          >
            {(Object.values(REGIONS) as RegionInfo[]).map((option) => (
              <option key={option.code} value={option.code}>
                {option.name} — prices in {option.currency}
              </option>
            ))}
          </select>
          {issues.country && <p className="mt-1 text-sm text-clay-700">{issues.country}</p>}
        </div>

        <TextField
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          error={issues.email}
          hint="Verification codes and receipts go here."
          required
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          error={issues.password}
          hint="At least 8 characters with one number."
          required
        />

        <div className="rounded-card border border-ink-200 p-4">
          <SwitchField
            label="Register as a seller"
            description="Open a shop and list products. You can do this later too."
            checked={asSeller}
            onChange={setAsSeller}
          />
          {asSeller && (
            <div className="mt-4">
              <TextField
                label="Shop name"
                name="shopName"
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
                placeholder="Nakato Fresh Produce"
                error={issues.shopName}
                hint="Buyers see this on every listing. You can rename it later."
                required
              />
            </div>
          )}
        </div>

        <CheckboxField
          label="I accept the buyer and seller terms"
          description="Includes the delivery, returns and commission rules for your country."
          checked={acceptTerms}
          onChange={(event) => setAcceptTerms(event.target.checked)}
        />
        {issues.acceptTerms && <p className="text-sm text-clay-700">{issues.acceptTerms}</p>}

        <Button block size="lg" className="rounded-xl bg-bemz-800 hover:bg-bemz-900" type="submit" loading={busy} disabled={!acceptTerms}>
          {asSeller ? 'Create account and shop' : 'Create account'}
        </Button>
      </form>

      <p className="mt-8 border-t border-ink-100 pt-6 text-center text-sm text-ink-600">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-pink-800 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
