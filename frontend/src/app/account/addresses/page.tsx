import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth/guards';
import { listAddresses } from '@/lib/services/accounts';
import { regionForCurrency } from '@/lib/client/regions';
import { AddressBook } from '@/components/account/address-book';

/**
 * `GET /account/addresses`
 *
 * The address book is read server-side and edited through `/api/me/addresses`, because the zone
 * behind each stop is what prices delivery — the browser is not allowed to describe an address in
 * a way the server would not have chosen itself.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Delivery addresses', description: 'Your saved delivery stops on Bemz Africa.', robots: { index: false } };

export default async function AddressesPage() {
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent('/account/addresses')}`);

  const addresses = await listAddresses(user.id);

  return (
    <div className="container-page max-w-4xl space-y-5 py-6">
      <div>
        <Link href="/account" className="inline-flex items-center gap-1 text-sm text-ink-600 hover:text-bemz-700">
          <ArrowLeft className="size-4" aria-hidden />
          Account settings
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-ink-950">Delivery addresses</h1>
        <p className="mt-1 text-sm text-ink-600">
          Your saved delivery stops — checkout starts with your default address and re-prices delivery
          when you choose another.
        </p>
      </div>

      <AddressBook addresses={addresses} defaultCountry={regionForCurrency(user.preferredCurrency)} />

      <p className="rounded-card bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-600">
        Delivery availability, fees and estimated times depend on the country, delivery zone and seller coverage.
        For example, a nearby zone may cost less than a remote one. Payment options also depend on country and zone;
        cash on delivery is only shown where available.{' '}
        <Link href="/checkout" className="font-medium text-bemz-700 hover:underline">
          Go to checkout
        </Link>
        .
      </p>
    </div>
  );
}
