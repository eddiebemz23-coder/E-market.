/**
 * One-shot expansion seed: upserts the 52 non-launch African markets with their regions and
 * major-city districts. Idempotent — safe to re-run. Launch markets UG/KE are untouched.
 *
 * Run: npx tsx prisma/seed-africa.ts   (reads DATABASE_URL/DIRECT_URL from .env)
 */
import { readFileSync } from 'node:fs';

for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i < 1 || line.startsWith('#')) continue;
  const key = line.slice(0, i).trim();
  let value = line.slice(i + 1).trim();
  if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  if (!process.env[key]) process.env[key] = value;
}

const { PrismaClient } = await import('@prisma/client');
const { AFRICA_EXPANSION } = await import('./data/africa');
const { AFRICA_MARKETS } = await import('../src/lib/geo-africa');

const prisma = new PrismaClient();

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function main() {
  let countries = 0;
  let regions = 0;
  let districts = 0;

  for (const entry of AFRICA_EXPANSION) {
    const market = AFRICA_MARKETS[entry.code as keyof typeof AFRICA_MARKETS];
    if (!market) throw new Error(`No market facts for ${entry.code}`);

    const country = await prisma.country.upsert({
      where: { code: entry.code as never },
      update: { name: market.name, currency: market.currency as never, phonePrefix: `+${market.dialCode}`, isActive: true },
      create: {
        code: entry.code as never,
        name: market.name,
        currency: market.currency as never,
        phonePrefix: `+${market.dialCode}`,
        taxRateBps: 0,
        taxLabel: 'VAT',
        isActive: true,
      },
    });
    countries++;

    const regionIds = new Map<string, number>();
    for (const name of entry.regions) {
      const code = slug(name);
      const region = await prisma.region.upsert({
        where: { countryId_code: { countryId: country.id, code } },
        update: { name },
        create: { countryId: country.id, code, name },
      });
      regionIds.set(name, region.id);
      regions++;
    }

    const seen = new Set<string>();
    for (const [name, regionName, isMajor] of entry.districts) {
      let code = slug(name).toUpperCase();
      while (seen.has(code)) code += 'X';
      seen.add(code);
      const regionId = regionIds.get(regionName);
      if (!regionId) throw new Error(`${entry.code}: district ${name} references unknown region ${regionName}`);
      await prisma.district.upsert({
        where: { countryId_code: { countryId: country.id, code } },
        update: { name, regionId, isMajor: Boolean(isMajor) },
        create: { countryId: country.id, code, name, regionId, isMajor: Boolean(isMajor) },
      });
      districts++;
    }
  }

  console.log(`Africa expansion seeded: ${countries} countries, ${regions} regions, ${districts} districts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());