import type { CurrencyCode } from '@/lib/money';
import {
  AFRICA_MARKETS,
  AFRICAN_COUNTRY_ORDER,
  countryForCurrency,
  type AfricanCountryCode,
} from '@/lib/geo-africa';

/**
 * Client-side dialling facts for every African market. `src/lib/phone.ts` owns the parsing and
 * is deliberately `server-only`, so a form that has to render a placeholder and a country
 * switcher in the browser reads these instead. Both sides share `geo-africa.ts`.
 */
export interface RegionInfo {
  code: AfricanCountryCode;
  name: string;
  dialCode: string;
  currency: CurrencyCode;
  currencyLabel: string;
  phoneHint: string;
  examplePhone: string;
}

export const REGIONS: Record<AfricanCountryCode, RegionInfo> = Object.fromEntries(
  AFRICAN_COUNTRY_ORDER.map((code) => {
    const market = AFRICA_MARKETS[code];
    return [
      code,
      {
        code,
        name: market.name,
        dialCode: market.dialCode,
        currency: market.currency,
        currencyLabel: market.currencyLabel,
        phoneHint: `Local number or full number starting with +${market.dialCode}`,
        examplePhone: 'Your phone number',
      },
    ];
  }),
) as Record<AfricanCountryCode, RegionInfo>;

export const REGION_LIST = AFRICAN_COUNTRY_ORDER.map((code) => REGIONS[code]);

export const regionForCurrency = (currency: CurrencyCode): AfricanCountryCode =>
  countryForCurrency(currency);