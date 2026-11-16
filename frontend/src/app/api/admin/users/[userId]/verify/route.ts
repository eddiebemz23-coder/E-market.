import { z } from 'zod';
import { withRoute, readJson, jsonBody, privateCache, RouteContext } from '@/lib/http';
import { requireAdmin } from '@/lib/auth/guards';
import { verifyUserByAdmin } from '@/lib/services/moderation';
import { adminUserVerifySchema } from '@/lib/validation/commerce';

const paramsSchema = z.object({ userId: z.string().min(1).max(64) });

/**
 * `POST /api/admin/users/{userId}/verify`
 *
 * Manual verification when the OTP never landed. Stamps the unproven channels, activates a
 * PENDING_VERIFICATION account, and files the decision in the audit trail with a named actor.
 */
export const POST = withRoute<{ userId: string }>(
  async (request: Request, context: RouteContext<{ userId: string }>) => {
    const admin = await requireAdmin();
    const { userId } = paramsSchema.parse(context.params);
    const { reason } = await readJson(request, adminUserVerifySchema);

    return jsonBody(await verifyUserByAdmin(userId, { reason, actorId: admin.id }), 200, privateCache());
  },
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';