import { withRoute, jsonBody, readJson, tooManyRequests, serviceUnavailable } from '@/lib/http';
import { authLimiter, otpLimiter } from '@/lib/rate-limit';
import { otpRequestSchema } from '@/lib/validation/auth';
import { requestOtp, OtpError } from '@/lib/otp';
import { normalisePhone } from '@/lib/phone';

/**
 * `POST /api/auth/otp/request`
 *
 * Sends the 6-digit code by SMS AND email. Every purpose needs an existing account —
 * registration (which now requires email + password) creates the account first, then
 * requests a `REGISTER` code to prove both channels.
 */
export const POST = withRoute(async (request: Request) => {
  const ipLimit = await authLimiter(request, 'otp-request');
  if (!ipLimit.allowed) {
    throw tooManyRequests('Too many code requests from this device, try again shortly', ipLimit.retryAfterSeconds);
  }

  const body = await readJson(request, otpRequestSchema);

  // A second, per-number limit: one SIM should not be able to bill us from one browser.
  const e164Preview = normalisePhone(body.phone, body.defaultRegion ?? 'UG').e164;
  const phoneLimit = await otpLimiter(request, e164Preview);
  if (!phoneLimit.allowed) {
    throw tooManyRequests('Slow down — codes are already on the way', phoneLimit.retryAfterSeconds);
  }

  try {
    const result = await requestOtp({
      phone: body.phone,
      purpose: body.purpose,
      defaultRegion: body.defaultRegion,
      allowNewAccount: false,
    });
    return jsonBody({
      ...result,
      message: 'Check your phone and email for a 6-digit code. It expires shortly.',
    });
  } catch (error) {
    // An unreachable gateway is our failure, not the buyer's; keep the code unusable but
    // tell the client to retry rather than showing "invalid number".
    if (error instanceof OtpError) throw error;
    if (error instanceof Error && error.message.includes('SMS failed')) {
      throw serviceUnavailable('The SMS gateway did not accept the message — try again in a minute');
    }
    throw error;
  }
});

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
