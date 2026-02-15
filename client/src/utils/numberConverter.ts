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

/**
 * Parse date string in dd/mm/yyyy format and return yyyy-mm-dd format for API
 * @param dateString - Date string in dd/mm/yyyy format
 * @returns Date string in yyyy-mm-dd format for API, or empty string if invalid
 */
export const parseDisplayDateToAPI = (dateString: string): string => {
  if (!dateString) return '';
  const parts = dateString.split('/');
  if (parts.length !== 3) return '';
  const [day, month, year] = parts;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
  // Validate
  if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
    return '';
  }
  
  return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
};

/**
 * Convert yyyy-mm-dd format to dd/mm/yyyy format for display
 * @param dateString - Date string in yyyy-mm-dd format
 * @returns Date string in dd/mm/yyyy format
 */
export const formatAPIDateToDisplay = (dateString: string): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};
/**
 * Format date to dd/mm/yyyy format
 * @param date - Date object or string
 * @returns Formatted date string in dd/mm/yyyy format
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format date and time to dd/mm/yyyy, hh:mm:ss AM/PM format
 * Ensures the time is displayed in local timezone with 12-hour format
 * @param date - Date object or string (ISO 8601 format)
 * @returns Formatted datetime string in local time with 12-hour format
 */
export const formatDateTime = (date: Date | string | null | undefined): string => {
  // Handle null, undefined, or empty strings
  if (!date) {
    return '';
  }
  
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Trim whitespace and handle empty strings
    const trimmedDate = date.trim();
    if (!trimmedDate) {
      return '';
    }
    // Parse ISO 8601 date string and ensure local time conversion
    dateObj = new Date(trimmedDate);
  } else {
    dateObj = date;
  }
  
  // Check if the date is valid
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  // Get local date and time components
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  // Convert to 12-hour format
  let hours = dateObj.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const hoursStr = String(hours).padStart(2, '0');
  
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hoursStr}:${minutes}:${seconds} ${ampm}`;
};

/**
 * Convert date to yyyy-mm-dd format for input[type="date"]
 * @param date - Date object or string
 * @returns Formatted date string in yyyy-mm-dd format
 */
export const toInputDateFormat = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
