/**
 * Single source of truth for the African markets: country codes, currencies and dialling
 * facts. Pure data (no server-only) so the phone parser, the Zod enums, the money helpers
 * and the browser country switcher all read the same list.
 */

export const AFRICAN_COUNTRY_CODES = [
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI',
  'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR',
  'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN',
  'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'EH', 'ZM', 'ZW',
] as const;

export type AfricanCountryCode = (typeof AFRICAN_COUNTRY_CODES)[number];

export const AFRICAN_CURRENCIES = [
  'UGX', 'KES', 'USD',
  'DZD', 'AOA', 'XOF', 'BWP', 'BIF', 'CVE', 'XAF', 'CDF', 'DJF', 'EGP', 'ERN', 'SZL',
  'ETB', 'GMD', 'GHS', 'GNF', 'LSL', 'LRD', 'LYD', 'MGA', 'MWK', 'MRU', 'MUR', 'MAD',
  'MZN', 'NAD', 'NGN', 'RWF', 'STN', 'SCR', 'SLE', 'SOS', 'ZAR', 'SSP', 'SDG', 'TZS',
  'TND', 'ZMW', 'ZWG', 'KMF',
] as const;

export type AfricanCurrency = (typeof AFRICAN_CURRENCIES)[number];

export type AfricanMarket = {
  code: AfricanCountryCode;
  name: string;
  currency: AfricanCurrency;
  dialCode: string;
  currencyLabel: string;
};

export const AFRICA_MARKETS: Record<AfricanCountryCode, AfricanMarket> = {
  DZ: { code: 'DZ', name: 'Algeria', currency: 'DZD', dialCode: '213', currencyLabel: 'Algerian dinar' },
  AO: { code: 'AO', name: 'Angola', currency: 'AOA', dialCode: '244', currencyLabel: 'Angolan kwanza' },
  BJ: { code: 'BJ', name: 'Benin', currency: 'XOF', dialCode: '229', currencyLabel: 'CFA franc (BCEAO)' },
  BW: { code: 'BW', name: 'Botswana', currency: 'BWP', dialCode: '267', currencyLabel: 'Botswana pula' },
  BF: { code: 'BF', name: 'Burkina Faso', currency: 'XOF', dialCode: '226', currencyLabel: 'CFA franc (BCEAO)' },
  BI: { code: 'BI', name: 'Burundi', currency: 'BIF', dialCode: '257', currencyLabel: 'Burundian franc' },
  CV: { code: 'CV', name: 'Cape Verde', currency: 'CVE', dialCode: '238', currencyLabel: 'Cape Verdean escudo' },
  CM: { code: 'CM', name: 'Cameroon', currency: 'XAF', dialCode: '237', currencyLabel: 'CFA franc (BEAC)' },
  CF: { code: 'CF', name: 'Central African Republic', currency: 'XAF', dialCode: '236', currencyLabel: 'CFA franc (BEAC)' },
  TD: { code: 'TD', name: 'Chad', currency: 'XAF', dialCode: '235', currencyLabel: 'CFA franc (BEAC)' },
  KM: { code: 'KM', name: 'Comoros', currency: 'KMF', dialCode: '269', currencyLabel: 'Comorian franc' },
  CG: { code: 'CG', name: 'Congo', currency: 'XAF', dialCode: '242', currencyLabel: 'CFA franc (BEAC)' },
  CD: { code: 'CD', name: 'DR Congo', currency: 'CDF', dialCode: '243', currencyLabel: 'Congolese franc' },
  CI: { code: 'CI', name: "Côte d'Ivoire", currency: 'XOF', dialCode: '225', currencyLabel: 'CFA franc (BCEAO)' },
  DJ: { code: 'DJ', name: 'Djibouti', currency: 'DJF', dialCode: '253', currencyLabel: 'Djiboutian franc' },
  EG: { code: 'EG', name: 'Egypt', currency: 'EGP', dialCode: '20', currencyLabel: 'Egyptian pound' },
  GQ: { code: 'GQ', name: 'Equatorial Guinea', currency: 'XAF', dialCode: '240', currencyLabel: 'CFA franc (BEAC)' },
  ER: { code: 'ER', name: 'Eritrea', currency: 'ERN', dialCode: '291', currencyLabel: 'Eritrean nakfa' },
  SZ: { code: 'SZ', name: 'Eswatini', currency: 'SZL', dialCode: '268', currencyLabel: 'Swazi lilangeni' },
  ET: { code: 'ET', name: 'Ethiopia', currency: 'ETB', dialCode: '251', currencyLabel: 'Ethiopian birr' },
  GA: { code: 'GA', name: 'Gabon', currency: 'XAF', dialCode: '241', currencyLabel: 'CFA franc (BEAC)' },
  GM: { code: 'GM', name: 'Gambia', currency: 'GMD', dialCode: '220', currencyLabel: 'Gambian dalasi' },
  GH: { code: 'GH', name: 'Ghana', currency: 'GHS', dialCode: '233', currencyLabel: 'Ghanaian cedi' },
  GN: { code: 'GN', name: 'Guinea', currency: 'GNF', dialCode: '224', currencyLabel: 'Guinean franc' },
  GW: { code: 'GW', name: 'Guinea-Bissau', currency: 'XOF', dialCode: '245', currencyLabel: 'CFA franc (BCEAO)' },
  KE: { code: 'KE', name: 'Kenya', currency: 'KES', dialCode: '254', currencyLabel: 'Kenyan shilling' },
  LS: { code: 'LS', name: 'Lesotho', currency: 'LSL', dialCode: '266', currencyLabel: 'Lesotho loti' },
  LR: { code: 'LR', name: 'Liberia', currency: 'LRD', dialCode: '231', currencyLabel: 'Liberian dollar' },
  LY: { code: 'LY', name: 'Libya', currency: 'LYD', dialCode: '218', currencyLabel: 'Libyan dinar' },
  MG: { code: 'MG', name: 'Madagascar', currency: 'MGA', dialCode: '261', currencyLabel: 'Malagasy ariary' },
  MW: { code: 'MW', name: 'Malawi', currency: 'MWK', dialCode: '265', currencyLabel: 'Malawian kwacha' },
  ML: { code: 'ML', name: 'Mali', currency: 'XOF', dialCode: '223', currencyLabel: 'CFA franc (BCEAO)' },
  MR: { code: 'MR', name: 'Mauritania', currency: 'MRU', dialCode: '222', currencyLabel: 'Mauritanian ouguiya' },
  MU: { code: 'MU', name: 'Mauritius', currency: 'MUR', dialCode: '230', currencyLabel: 'Mauritian rupee' },
  MA: { code: 'MA', name: 'Morocco', currency: 'MAD', dialCode: '212', currencyLabel: 'Moroccan dirham' },
  MZ: { code: 'MZ', name: 'Mozambique', currency: 'MZN', dialCode: '258', currencyLabel: 'Mozambican metical' },
  NA: { code: 'NA', name: 'Namibia', currency: 'NAD', dialCode: '264', currencyLabel: 'Namibian dollar' },
  NE: { code: 'NE', name: 'Niger', currency: 'XOF', dialCode: '227', currencyLabel: 'CFA franc (BCEAO)' },
  NG: { code: 'NG', name: 'Nigeria', currency: 'NGN', dialCode: '234', currencyLabel: 'Nigerian naira' },
  RW: { code: 'RW', name: 'Rwanda', currency: 'RWF', dialCode: '250', currencyLabel: 'Rwandan franc' },
  ST: { code: 'ST', name: 'São Tomé and Príncipe', currency: 'STN', dialCode: '239', currencyLabel: 'São Tomé dobra' },
  SN: { code: 'SN', name: 'Senegal', currency: 'XOF', dialCode: '221', currencyLabel: 'CFA franc (BCEAO)' },
  SC: { code: 'SC', name: 'Seychelles', currency: 'SCR', dialCode: '248', currencyLabel: 'Seychellois rupee' },
  SL: { code: 'SL', name: 'Sierra Leone', currency: 'SLE', dialCode: '232', currencyLabel: 'Sierra Leonean leone' },
  SO: { code: 'SO', name: 'Somalia', currency: 'SOS', dialCode: '252', currencyLabel: 'Somali shilling' },
  ZA: { code: 'ZA', name: 'South Africa', currency: 'ZAR', dialCode: '27', currencyLabel: 'South African rand' },
  SS: { code: 'SS', name: 'South Sudan', currency: 'SSP', dialCode: '211', currencyLabel: 'South Sudanese pound' },
  SD: { code: 'SD', name: 'Sudan', currency: 'SDG', dialCode: '249', currencyLabel: 'Sudanese pound' },
  TZ: { code: 'TZ', name: 'Tanzania', currency: 'TZS', dialCode: '255', currencyLabel: 'Tanzanian shilling' },
  TG: { code: 'TG', name: 'Togo', currency: 'XOF', dialCode: '228', currencyLabel: 'CFA franc (BCEAO)' },
  TN: { code: 'TN', name: 'Tunisia', currency: 'TND', dialCode: '216', currencyLabel: 'Tunisian dinar' },
  UG: { code: 'UG', name: 'Uganda', currency: 'UGX', dialCode: '256', currencyLabel: 'Uganda shilling' },
  EH: { code: 'EH', name: 'Western Sahara', currency: 'MAD', dialCode: '212', currencyLabel: 'Moroccan dirham' },
  ZM: { code: 'ZM', name: 'Zambia', currency: 'ZMW', dialCode: '260', currencyLabel: 'Zambian kwacha' },
  ZW: { code: 'ZW', name: 'Zimbabwe', currency: 'ZWG', dialCode: '263', currencyLabel: 'Zimbabwe Gold (ZiG)' },
};

/** Launch markets first, then the rest alphabetically — the order the country switcher shows. */
export const AFRICAN_COUNTRY_ORDER: AfricanCountryCode[] = [
  'UG', 'KE',
  ...AFRICAN_COUNTRY_CODES.filter((code) => code !== 'UG' && code !== 'KE').sort(),
];

export const isAfricanCountry = (value: string): value is AfricanCountryCode =>
  (AFRICAN_COUNTRY_CODES as readonly string[]).includes(value);

/** First market using a currency — XOF/XAF/MAD are shared, the switcher just needs one owner. */
export const countryForCurrency = (currency: AfricanCurrency): AfricanCountryCode => {
  const hit = AFRICAN_COUNTRY_ORDER.find((code) => AFRICA_MARKETS[code].currency === currency);
  return hit ?? 'UG';
};