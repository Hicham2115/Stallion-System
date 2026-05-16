import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '@/lib/api';
import { Currency, ExchangeRates } from '@/types';

const STORAGE_KEY = 'stallion_currency';

const FALLBACK: ExchangeRates = {
  MAD: { MAD: 1, USD: 0.1, EUR: 0.093 },
  USD: { USD: 1, MAD: 10.0, EUR: 0.93 },
  EUR: { EUR: 1, MAD: 10.75, USD: 1.075 },
};

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: ExchangeRates;
  convert: (amount: number, from?: Currency) => number;
  fmt: (amount: number, from?: Currency) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const LOCALES: Record<Currency, string> = { MAD: 'fr-MA', USD: 'en-US', EUR: 'de-DE' };

function formatAmount(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALES[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem(STORAGE_KEY) as Currency) || 'MAD'
  );
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK);

  useEffect(() => {
    api.get<ExchangeRates>('/currency/rates')
      .then(res => { if (res.data && Object.keys(res.data).length > 0) setRates(res.data); })
      .catch(() => {});
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    localStorage.setItem(STORAGE_KEY, c);
    setCurrencyState(c);
  }, []);

  const convert = useCallback((amount: number, from: Currency = 'MAD'): number => {
    if (from === currency) return amount;
    const rate = rates[from]?.[currency] ?? FALLBACK[from]?.[currency] ?? 1;
    return amount * rate;
  }, [currency, rates]);

  const fmt = useCallback((amount: number, from: Currency = 'MAD'): string => {
    return formatAmount(convert(amount, from), currency);
  }, [convert, currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, convert, fmt }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
