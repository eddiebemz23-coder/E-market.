import 'server-only';
import nodemailer from 'nodemailer';
import { prisma } from './prisma';
import { env } from './env';

/**
 * Email transport (SMTP — Gmail app password in production). Mirrors the SMS rail: when
 * credentials are absent the message is logged and the notification row is written as SENT
 * with a `simulated:` provider id, so flows stay testable without pretending a real inbox
 * was reached.
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  message: string;
  userId?: string;
  template?: string;
  data?: Record<string, unknown>;
};

export type SendEmailResult = {
  providerMessageId: string;
  simulated: boolean;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  const config = env();
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = env();

  const notification = await prisma.notification.create({
    data: {
      userId: input.userId ?? (await resolveUserId(input.to)),
      channel: 'EMAIL',
      template: input.template ?? 'generic',
      body: `${input.subject}\n\n${input.message}`,
      data: (input.data ?? {}) as Record<string, never>,
      status: 'QUEUED',
    },
  });

  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    console.warn(`[email:simulated] -> ${input.to}: ${input.subject} | ${input.message}`);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', providerMessageId: `simulated:${notification.id}` },
    });
    return { providerMessageId: `simulated:${notification.id}`, simulated: true };
  }

  try {
    const info = await getTransporter().sendMail({
      from: config.EMAIL_FROM || config.SMTP_USER,
      to: input.to,
      subject: input.subject,
      text: input.message,
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'SENT', providerMessageId: info.messageId ?? `smtp:${notification.id}`, sentAt: new Date() },
    });
    return { providerMessageId: info.messageId ?? `smtp:${notification.id}`, simulated: false };
  } catch (error) {
    await prisma.notification.update({ where: { id: notification.id }, data: { status: 'FAILED' } });
    throw error;
  }
}

async function resolveUserId(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) return user.id;
  const ops = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  if (ops) return ops.id;
  throw new Error('No admin account exists to attribute an orphan notification to');
}

/** The OTP email body — same code as the SMS, so either channel completes the flow. */
export function otpEmail(code: string, ttlSeconds: number): { subject: string; message: string } {
  const minutes = Math.round(ttlSeconds / 60);
  return {
    subject: `Bemz: your verification code is ${code}`,
    message: `Your Bemz verification code is ${code}. It expires in ${minutes} minutes.\n\nThe same code was also sent by SMS. Never share this code with anyone — Bemz staff will never ask for it.\n\nIf you did not request this code, you can ignore this email.`,
  };
}