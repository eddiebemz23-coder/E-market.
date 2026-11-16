import type { Metadata } from 'next';
import Link from 'next/link';
import { adminPage } from '@/lib/admin-page';
import { listUsers } from '@/lib/services/moderation';
import { parseParams, hrefWith } from '@/lib/catalog-params';
import { adminUsersQuerySchema } from '@/lib/validation/commerce';
import { formatDate, humanise } from '@/lib/client/format';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { VerifyUserButton } from '@/components/admin/verify-user-button';

/**
 * `GET /admin/users`
 *
 * The verification desk: every account with both verification stamps visible, a search box and
 * filters that live in the URL, and a one-click manual verify for the accounts whose OTP never
 * landed. Restricting an account (suspend/ban) stays on the case file, where the open-order
 * warning lives — this page is for letting people in, not locking them out.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Users', robots: { index: false } };

const STATUS_TONE: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  PENDING_VERIFICATION: 'info',
  SUSPENDED: 'warning',
  BANNED: 'danger',
  DELETED: 'neutral',
};

const ROLE_LABEL: Record<string, string> = { BUYER: 'Buyer', SELLER: 'Seller', ADMIN: 'Platform team' };

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'PENDING_VERIFICATION', label: 'Awaiting verification' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'BANNED', label: 'Banned' },
];

function VerifiedMark({ label, at }: { label: string; at: Date | null }) {
  return at ? (
    <Badge tone="success">{label} ✓</Badge>
  ) : (
    <Badge tone="neutral">{label} —</Badge>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await adminPage('/admin/users');

  const query = parseParams(adminUsersQuerySchema, searchParams);
  const roster = await listUsers({
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.role ? { role: query.role } : {}),
    unverifiedOnly: query.unverified,
    page: query.page,
    perPage: query.perPage,
  });

  const filters = {
    q: query.q,
    status: query.status,
    role: query.role,
    unverified: query.unverified ? 'true' : undefined,
    perPage: query.perPage,
  };
  const hrefFor = (page: number) => hrefWith('/admin/users', { ...filters, page: query.page }, { page });

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">Users</h1>
            <p className="mt-1 max-w-prose text-sm text-ink-600">
              Every account, newest first. Verify manually when a code never landed; suspend or ban
              from the case file so the open-order warning is in front of you.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              href={hrefWith('/admin/users', {}, { status: 'PENDING_VERIFICATION' })}
              className="rounded-card bg-ink-50 px-3 py-2 font-medium text-ink-700 hover:bg-ink-100"
            >
              {roster.counts.pendingVerification} awaiting verification
            </Link>
            <Link
              href={hrefWith('/admin/users', {}, { unverified: 'true' })}
              className="rounded-card bg-ink-50 px-3 py-2 font-medium text-ink-700 hover:bg-ink-100"
            >
              {roster.counts.unverified} unverified channel{roster.counts.unverified === 1 ? '' : 's'}
            </Link>
          </div>
        </div>

        <form method="get" action="/admin/users" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="field-label" htmlFor="q">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q ?? ''}
              maxLength={120}
              placeholder="Name, phone or email"
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={query.status ?? ''} className="field-input">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="role">
              Role
            </label>
            <select id="role" name="role" defaultValue={query.role ?? ''} className="field-input">
              <option value="">Everyone</option>
              <option value="BUYER">Buyers</option>
              <option value="SELLER">Sellers</option>
              <option value="ADMIN">Platform team</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="unverified">
              Verification
            </label>
            <select id="unverified" name="unverified" defaultValue={query.unverified ? 'true' : ''} className="field-input">
              <option value="">Everyone</option>
              <option value="true">Still unverified</option>
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              className="rounded-lg bg-bemz-700 px-4 py-2 text-sm font-semibold text-white hover:bg-bemz-800"
            >
              Apply filters
            </button>
            <Link href="/admin/users" className="px-2 py-2 text-sm text-ink-500 underline-offset-2 hover:underline">
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className="card overflow-hidden">
        {roster.items.length === 0 ? (
          <EmptyState
            title="No accounts match"
            description="Loosen the filters, or wait for the first registration — new accounts land here the moment they sign up."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-5 py-2 font-medium">Account</th>
                  <th className="py-2 pr-3 font-medium">Country</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Verified</th>
                  <th className="py-2 pr-3 font-medium">Joined</th>
                  <th className="py-2 pr-5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {roster.items.map((user) => {
                  const name = user.name ?? 'Account with no name';
                  const canVerify =
                    user.status !== 'SUSPENDED' &&
                    user.status !== 'BANNED' &&
                    (!user.phoneVerified || (user.email !== null && !user.emailVerified));
                  return (
                    <tr key={user.id}>
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="font-semibold text-bemz-700 underline-offset-2 hover:underline"
                        >
                          {name}
                        </Link>
                        <p className="tabular mt-0.5 text-xs text-ink-500">{user.phone ?? 'no phone'}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{user.email ?? 'no email'}</p>
                      </td>
                      <td className="py-3 pr-3 text-xs text-ink-600">
                        {user.country ? `${user.country.name} (${user.country.code})` : '—'}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone="neutral">{ROLE_LABEL[user.role] ?? humanise(user.role)}</Badge>
                        {user.shopCount > 0 && (
                          <p className="mt-1 text-xs text-ink-500">
                            {user.shopCount} stall{user.shopCount === 1 ? '' : 's'}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={STATUS_TONE[user.status] ?? 'neutral'}>{humanise(user.status)}</Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-col items-start gap-1">
                          <VerifiedMark label="Phone" at={user.phoneVerified} />
                          <VerifiedMark label="Email" at={user.emailVerified} />
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-xs text-ink-500">{formatDate(user.createdAt)}</td>
                      <td className="py-3 pr-5">
                        <div className="flex items-center justify-end gap-2">
                          {canVerify && <VerifyUserButton userId={user.id} name={name} />}
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="text-xs text-ink-500 underline-offset-2 hover:underline"
                          >
                            Case file
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-ink-100 px-5 py-3">
          <Pagination page={roster.page} perPage={roster.perPage} total={roster.total} hrefFor={hrefFor} />
          <p className="text-xs text-ink-500">
            {roster.total} account{roster.total === 1 ? '' : 's'} match the current filters.
          </p>
        </div>
      </section>
    </div>
  );
}