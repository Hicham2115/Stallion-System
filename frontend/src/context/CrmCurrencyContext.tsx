import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '@/lib/api';

export type CrmCurrency = 'MAD' | 'USD' | 'EUR';

const SYMBOLS: Record<CrmCurrency, string> = { MAD: 'MAD', USD: '$', EUR: '€' };
const FALLBACK: Record<string, Record<string, number>> = {
  MAD: { MAD: 1, USD: 0.1015, EUR: 0.0922 },
  USD: { USD: 1, MAD: 9.85, EUR: 0.9079 },
  EUR: { EUR: 1, MAD: 10.85, USD: 1.1015 },
};

interface CrmCurrencyCtx {
  currency: CrmCurrency;
  setCurrency: (c: CrmCurrency) => void;
  fmt: (amount: number, fromCurrency?: CrmCurrency) => string;
  convert: (amount: number, fromCurrency?: CrmCurrency) => number;
}

const Ctx = createContext<CrmCurrencyCtx>({
  currency: 'MAD',
  setCurrency: () => {},
  fmt: (n) => n.toLocaleString('en-MA', { maximumFractionDigits: 0 }) + ' MAD',
  convert: (n) => n,
});

export function CrmCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CrmCurrency>('MAD');
  const [rates, setRates] = useState<Record<string, Record<string, number>>>(FALLBACK);

  useEffect(() => {
    api.get<Record<string, Record<string, number>>>('/crm/rates')
      .then(({ data }) => setRates(data))
      .catch(() => {});
  }, []);

  const convert = (amount: number, from: CrmCurrency = 'MAD'): number => {
    if (from === currency) return amount;
    const rate = rates[from]?.[currency] ?? FALLBACK[from]?.[currency] ?? 1;
    return amount * rate;
  };

  const fmt = (amount: number, from: CrmCurrency = 'MAD'): string => {
    const converted = convert(amount, from);
    if (currency === 'USD') return '$' + converted.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (currency === 'EUR') return '€' + converted.toLocaleString('en-DE', { maximumFractionDigits: 0 });
    return converted.toLocaleString('en-MA', { maximumFractionDigits: 0 }) + ' MAD';
  };

  return <Ctx.Provider value={{ currency, setCurrency, fmt, convert }}>{children}</Ctx.Provider>;
}

export function useCrmCurrency() { return useContext(Ctx); }
export { SYMBOLS };
