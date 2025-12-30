/**
 * Utility functions for converting between Bengali and English numerals
 */

// Bengali digit map
const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Convert Bengali numerals to English numerals
 * @param input - String that may contain Bengali numerals
 * @returns String with all Bengali numerals converted to English
 */
export const bengaliToEnglish = (input: string): string => {
  let result = input;
  bengaliDigits.forEach((digit, index) => {
    const regex = new RegExp(digit, 'g');
    result = result.replace(regex, englishDigits[index]);
  });
  return result;
};

/**
 * Convert English numerals to Bengali numerals
 * @param input - String that may contain English numerals
 * @returns String with all English numerals converted to Bengali
 */
export const englishToBengali = (input: string): string => {
  let result = input;
  englishDigits.forEach((digit, index) => {
    const regex = new RegExp(digit, 'g');
    result = result.replace(regex, bengaliDigits[index]);
  });
  return result;
};

/**
 * Convert string input to number, handling both Bengali and English numerals
 * @param input - String that may contain Bengali or English numerals
 * @returns Number value, or NaN if conversion fails
 */
export const parseNumericInput = (input: string): number => {
  if (!input) return 0;
  const englishString = bengaliToEnglish(input);
  return Number(englishString);
};

/**
 * Format a number for display, optionally converting to Bengali numerals
 * @param value - Numeric value to format
 * @param options - Formatting options
 * @returns Formatted string
 */
export const formatNumericOutput = (
  value: number | string,
  options: {
    decimals?: number;
    useBengali?: boolean;
  } = {}
): string => {
  const { decimals = 2, useBengali = false } = options;
  
  let result = typeof value === 'string' ? value : Number(value).toFixed(decimals);
  
  if (useBengali) {
    result = englishToBengali(result);
  }
  
  return result;
};
