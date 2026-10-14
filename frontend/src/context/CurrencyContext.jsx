import { createContext, useContext, useMemo, useState } from 'react';
import { formatCurrency, formatCompactCurrency } from '../utils/format.js';

const CurrencyContext = createContext(null);
const STORAGE_KEY = 'freelancer-currency';

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'LKR' ? 'LKR' : 'USD';
    } catch {
      return 'USD';
    }
  });

  const value = useMemo(() => ({
    currency,
    setCurrency: (next) => {
      if (!['USD', 'LKR'].includes(next)) return;
      setCurrencyState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Keep the selection usable when browser storage is unavailable.
      }
    },
    formatCurrency: (amount) => formatCurrency(amount, currency),
    formatCompactCurrency: (amount) => formatCompactCurrency(amount, currency),
  }), [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);
