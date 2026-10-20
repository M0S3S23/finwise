export const CURRENCIES = [
  { code: 'ZMW', name: 'Zambian Kwacha' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'KES', name: 'Kenyan Shilling' },
  { code: 'NGN', name: 'Nigerian Naira' },
  { code: 'GHS', name: 'Ghanaian Cedi' },
  { code: 'TZS', name: 'Tanzanian Shilling' },
  { code: 'UGX', name: 'Ugandan Shilling' },
  { code: 'BWP', name: 'Botswana Pula' },
  { code: 'MWK', name: 'Malawian Kwacha' },
  { code: 'NAD', name: 'Namibian Dollar' },
  { code: 'MZN', name: 'Mozambican Metical' },
  { code: 'RWF', name: 'Rwandan Franc' },
  { code: 'ZWG', name: 'Zimbabwe Gold' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'INR', name: 'Indian Rupee' },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [string, ...string[]];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
  { value: 'credit', label: 'On credit' },
  { value: 'other', label: 'Other' },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value'];
export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS.map((p) => p.value) as [PaymentMethod, ...PaymentMethod[]];
export const paymentLabel = (v?: string) => PAYMENT_METHODS.find((p) => p.value === v)?.label ?? v ?? '';

/** Round to 2 decimal places, avoiding float drift (e.g. 0.1 + 0.2). */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const fmtCache = new Map<string, Intl.NumberFormat>();
export function formatMoney(amount: number, currency = 'USD', opts: { compact?: boolean } = {}) {
  const key = `${currency}-${opts.compact ? 'c' : 'f'}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat('en', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        notation: opts.compact ? 'compact' : 'standard',
        maximumFractionDigits: opts.compact ? 1 : 2,
        minimumFractionDigits: opts.compact ? 0 : 2,
      });
    } catch {
      f = new Intl.NumberFormat('en', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    }
    fmtCache.set(key, f);
  }
  return f.format(amount || 0);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(n || 0);
}
