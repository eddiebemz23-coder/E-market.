import 'server-only';
import { parsePhoneNumberFromString, type CountryCode as LibCountryCode } from 'libphonenumber-js';
import {
  AFRICA_MARKETS,
  AFRICAN_COUNTRY_CODES,
  isAfricanCountry,
  type AfricanCountryCode,
  type AfricanCurrency,
} from './geo-africa';

/**
 * Phone numbers are the primary identity across the African markets. Everything is stored as
 * E.164 so payment APIs receive a number they can route, and so `0772123456`, `772123456`,
 * `+256772123456` and `256772123456` all resolve to the same account. The leading national
 * trunk `0` is stripped before parsing — the canonical local format is `7xxxxxxxx`.
 */

export const SUPPORTED_REGIONS = AFRICAN_COUNTRY_CODES;
export type SupportedRegion = AfricanCountryCode;

export const REGION_DIAL_CODES: Record<SupportedRegion, string> = Object.fromEntries(
  AFRICAN_COUNTRY_CODES.map((code) => [code, AFRICA_MARKETS[code].dialCode]),
) as Record<SupportedRegion, string>;

export type NormalisedPhone = {
  e164: string;
  region: SupportedRegion;
  national: string; // 772123456 — what the buyer typed after the country code
  isMobile: boolean;
};

export class PhoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhoneError';
  }
}

/**
 * @param raw whatever the user typed (local format with or without the leading 0, +E164,
 *            with spaces or dashes)
 * @param defaultRegion used only when the number has no `+` country code
 */
export function normalisePhone(raw: string, defaultRegion: SupportedRegion = 'UG'): NormalisedPhone {
  let trimmed = raw.trim().replace(/[\s()-]/g, '');
  if (trimmed.length === 0) throw new PhoneError('Enter a phone number');

  // Canonical local format is 7xxxxxxxx: drop the trunk prefix so 0772… and 772… agree.
  if (!trimmed.startsWith('+')) trimmed = trimmed.replace(/^0+/, '');

  const parsed = parsePhoneNumberFromString(trimmed, defaultRegion as LibCountryCode);
  if (!parsed) throw new PhoneError('That phone number is not valid — use the format 7xxxxxxxx');
  if (!parsed.country || !isAfricanCountry(parsed.country)) {
    throw new PhoneError('Only African phone numbers are supported');
  }
  if (!parsed.isPossible()) throw new PhoneError('That phone number looks incomplete');

  const region = parsed.country;
  const national = parsed.nationalNumber;

  return {
    e164: parsed.number,
    region,
    national,
    isMobile: parsed.getType() === 'MOBILE',
  };
}

export const tryNormalisePhone = (raw: string, defaultRegion?: SupportedRegion) => {
  try {
    return { ok: true as const, phone: normalisePhone(raw, defaultRegion) };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : 'Invalid phone number' };
  }
};

export function currencyForRegion(region: SupportedRegion): AfricanCurrency {
  return AFRICA_MARKETS[region].currency;
}

/**
 * Mobile-money operator hints from the national prefix. Only the two launch markets have
 * published MoMo/Airtel blocks wired here; other African markets fall back to asking the
 * buyer to pick a wallet at checkout.
 */
const OPERATOR_PREFIXES: Partial<Record<SupportedRegion, Array<{ prefix: string; provider: 'MTN_MOMO' | 'AIRTEL_MONEY' }>>> = {
  UG: [
    { prefix: '77', provider: 'MTN_MOMO' },
    { prefix: '78', provider: 'MTN_MOMO' },
    { prefix: '75', provider: 'MTN_MOMO' }, // newer MTN block (also used by Airtel reissues)
    { prefix: '70', provider: 'AIRTEL_MONEY' },
    { prefix: '79', provider: 'AIRTEL_MONEY' },
    { prefix: '74', provider: 'AIRTEL_MONEY' },
    { prefix: '76', provider: 'AIRTEL_MONEY' },
  ],
  KE: [
    { prefix: '708', provider: 'AIRTEL_MONEY' },
    { prefix: '709', provider: 'AIRTEL_MONEY' },
    { prefix: '737', provider: 'AIRTEL_MONEY' },
    { prefix: '738', provider: 'AIRTEL_MONEY' },
    { prefix: '739', provider: 'AIRTEL_MONEY' },
    { prefix: '728', provider: 'AIRTEL_MONEY' },
  ],
};

export function guessMobileMoneyProvider(
  phone: NormalisedPhone | string,
): 'MTN_MOMO' | 'AIRTEL_MONEY' | undefined {
  const normalised = typeof phone === 'string' ? normalisePhone(phone) : phone;
  const prefixes = OPERATOR_PREFIXES[normalised.region];
  if (!prefixes) return undefined;
  const dialCode = REGION_DIAL_CODES[normalised.region];
  const withoutDial = normalised.e164.replace(`+${dialCode}`, '');
  // Three-digit prefixes are checked before two-digit ones.
  const candidates = [...prefixes].sort((a, b) => b.prefix.length - a.prefix.length);
  return candidates.find((candidate) => withoutDial.startsWith(candidate.prefix))?.provider;
}

/** Shown in the UI next to an input so the buyer sees the expected shape. */
export const phonePlaceholder = (_region: SupportedRegion) => '7xxxxxxxx';

/**
 * A confirmation screen has to say WHERE a code went without printing a number that could be
 * read over a shoulder at a cyber café or copied out of a screenshot.
 */
export const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return '••••••';
  return `${digits.slice(0, 3)} •••• ${digits.slice(-3)}`;
};

export const isSupportedRegion = (value: string): value is SupportedRegion => isAfricanCountry(value);

/** Exposed for the login/signup country selector. */
export const SUPPORTED_COUNTRIES = AFRICAN_COUNTRY_CODES.map((region) => ({
  region,
  dialCode: REGION_DIAL_CODES[region],
  currency: currencyForRegion(region),
  placeholder: phonePlaceholder(region),
}));