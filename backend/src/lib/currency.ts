import { prisma } from './prisma';

export type Currency = 'MAD' | 'USD' | 'EUR';

// Fallback rates (updated May 2026): 1 USD ≈ 9.85 MAD, 1 EUR ≈ 10.85 MAD
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  MAD: { MAD: 1, USD: 0.1015, EUR: 0.0922 },
  USD: { USD: 1, MAD: 9.85, EUR: 0.9079 },
  EUR: { EUR: 1, MAD: 10.85, USD: 1.1015 },
};

let ratesCache: Record<string, Record<string, number>> = {
  MAD: { ...FALLBACK_RATES.MAD },
  USD: { ...FALLBACK_RATES.USD },
  EUR: { ...FALLBACK_RATES.EUR },
};

export function convert(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount;
  const rate = ratesCache[from]?.[to] ?? FALLBACK_RATES[from]?.[to] ?? 1;
  return amount * rate;
}

export async function syncRates(): Promise<void> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/MAD');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { rates: Record<string, number> };
    const { rates } = data;

    const currencies: Currency[] = ['MAD', 'USD', 'EUR'];
    const newCache: Record<string, Record<string, number>> = {};

    for (const base of currencies) {
      newCache[base] = {};
      for (const target of currencies) {
        let rate: number;
        if (base === target) {
          rate = 1;
        } else if (base === 'MAD') {
          rate = rates[target] ?? FALLBACK_RATES.MAD[target];
        } else {
          const baseToMAD = 1 / (rates[base] ?? (1 / FALLBACK_RATES.MAD[base]));
          const madToTarget = rates[target] ?? FALLBACK_RATES.MAD[target];
          rate = baseToMAD * madToTarget;
        }
        newCache[base][target] = rate;

        // Upsert into DB via raw SQL (avoids Prisma model type issues)
        try {
          await prisma.$executeRaw`
            INSERT INTO exchange_rates (id, base_currency, target_currency, rate, updated_at)
            VALUES (${`${base}_${target}`}, ${base}, ${target}, ${rate}, NOW())
            ON CONFLICT (base_currency, target_currency) DO UPDATE SET rate = ${rate}, updated_at = NOW()
          `;
        } catch {
          // DB write failure is non-fatal
        }
      }
    }

    ratesCache = newCache;
    console.log('[currency] Exchange rates synced from API');
  } catch (err) {
    console.warn('[currency] Rate sync failed, using cached/fallback rates:', (err as Error).message);
  }
}

export async function loadRatesFromDB(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ base_currency: string; target_currency: string; rate: number }[]>`
      SELECT base_currency, target_currency, rate FROM exchange_rates
    `;
    if (!rows.length) return;
    const cache: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      if (!cache[r.base_currency]) cache[r.base_currency] = {};
      cache[r.base_currency][r.target_currency] = Number(r.rate);
    }
    ratesCache = cache;
    console.log('[currency] Rates loaded from DB');
  } catch (err) {
    console.warn('[currency] Could not load rates from DB:', (err as Error).message);
  }
}

export function getRatesCache(): Record<string, Record<string, number>> {
  return ratesCache;
}
