import { withRoute, jsonBody, parseQuery, privateCache } from '@/lib/http';
import { requireAdmin } from '@/lib/auth/guards';
import { listUsers } from '@/lib/services/moderation';
import { adminUsersQuerySchema } from '@/lib/validation/commerce';

/**
 * `GET /api/admin/users`
 *
 * The verification desk roster: search by name, phone or email, filter by status, role or
 * "still unverified", newest accounts first. No credential material is ever selected.
 */
export const GET = withRoute(async (request: Request) => {
  await requireAdmin();
  const query = parseQuery(request, adminUsersQuerySchema);

  return jsonBody(
    await listUsers({
      ...(query.q ? { q: query.q } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      unverifiedOnly: query.unverified,
      page: query.page,
      perPage: query.perPage,
    }),
    200,
    privateCache(),
  );
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';