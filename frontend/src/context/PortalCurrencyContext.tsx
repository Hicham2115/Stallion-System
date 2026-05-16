import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Currency } from '@/types';
import { portalApi } from '@/context/PortalAuthContext';
import { formatCurrency } from '@/lib/utils';

const STORAGE_KEY = 'stallion_portal_currency';

const FALLBACK: Record<string, Record<string, number>> = {
  MAD: { MAD: 1, USD: 0.1015, EUR: 0.0922 },
  USD: { USD: 1, MAD: 9.85, EUR: 0.9079 },
  EUR: { EUR: 1, MAD: 10.85, USD: 1.1015 },
};

interface PortalCurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  convert: (amount: number, from?: Currency) => number;
  fmt: (amount: number, from?: Currency) => string;
}

const PortalCurrencyContext = createContext<PortalCurrencyContextValue | null>(null);

interface Props {
  children: React.ReactNode;
  defaultCurrency?: string;
}

export function PortalCurrencyProvider({ children, defaultCurrency }: Props) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Currency | null;
    return stored || (defaultCurrency as Currency) || 'MAD';
  });
  const [rates, setRates] = useState<Record<string, Record<string, number>>>(FALLBACK);

  useEffect(() => {
    portalApi.get<Record<string, Record<string, number>>>('/rates')
      .then(({ data }) => { if (data && Object.keys(data).length > 0) setRates(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (defaultCurrency && !localStorage.getItem(STORAGE_KEY)) {
      setCurrencyState(defaultCurrency as Currency);
    }
  }, [defaultCurrency]);

  const setCurrency = useCallback((c: Currency) => {
    localStorage.setItem(STORAGE_KEY, c);
    setCurrencyState(c);
  }, []);

  const convert = useCallback((amount: number, from: Currency = 'MAD') => {
    if (from === currency) return amount;
    const rate = rates[from]?.[currency] ?? FALLBACK[from]?.[currency] ?? 1;
    return amount * rate;
  }, [currency, rates]);

  const fmt = useCallback((amount: number, from: Currency = 'MAD') => {
    return formatCurrency(convert(amount, from), currency);
  }, [convert, currency]);

  return (
    <PortalCurrencyContext.Provider value={{ currency, setCurrency, convert, fmt }}>
      {children}
    </PortalCurrencyContext.Provider>
  );
}

export function usePortalCurrency() {
  const ctx = useContext(PortalCurrencyContext);
  if (!ctx) throw new Error('usePortalCurrency must be used inside PortalCurrencyProvider');
  return ctx;
}
