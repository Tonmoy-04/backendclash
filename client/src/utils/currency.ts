import { englishToBengali } from './numberConverter';

export interface FormatOptions {
  decimals?: number; // number of decimal places
  withSymbol?: boolean; // include currency symbol
  symbol?: string; // override currency symbol
  useBengaliDigits?: boolean; // convert digits to Bengali numerals
}

// Format integer/fraction using Indian/Bangladeshi grouping: 12,34,56,789.12
export const formatNumberIndian = (value: number | string, decimals = 0): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!isFinite(num)) return '';

  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);

  const fixed = decimals > 0 ? abs.toFixed(decimals) : Math.floor(abs).toString();
  const [intPart, fracPart] = fixed.split('.');

  if (intPart.length <= 3) {
    return sign + intPart + (fracPart ? `.${fracPart}` : '');
  }

  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);

  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length) parts.unshift(rest);

  const grouped = parts.join(',') + ',' + last3;
  return sign + grouped + (fracPart ? `.${fracPart}` : '');
};

export const formatBDT = (value: number | string, opts: FormatOptions = {}): string => {
  const { decimals = 0, withSymbol = true, symbol = '৳', useBengaliDigits = false } = opts;
  const formatted = formatNumberIndian(value, decimals);
  if (!formatted) return '';
  const withSym = withSymbol ? `${symbol}${formatted}` : formatted;
  return useBengaliDigits ? englishToBengali(withSym) : withSym;
};
