/**
 * Utility functions for date conversion and validation
 */

/**
 * Bengali digit map
 */
const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * Convert Bengali numerals to English numerals
 * @param input - String that may contain Bengali numerals
 * @returns String with all Bengali numerals converted to English
 */
function bengaliToEnglish(input) {
  if (!input) return input;
  let result = input;
  bengaliDigits.forEach((digit, index) => {
    const regex = new RegExp(digit, 'g');
    result = result.replace(regex, englishDigits[index]);
  });
  return result;
}

/**
 * Parse date string and return Date object or null
 * Handles dd/mm/yyyy, yyyy-mm-dd, and ISO formats
 * @param dateString - Date string that may contain Bengali numerals
 * @returns Date object or null if invalid
 */
function parseDDMMYYYY(dateString) {
  if (!dateString) return null;

  console.log('[parseDDMMYYYY] Input:', dateString);
  
  // Convert Bengali numerals to English
  const englishDate = bengaliToEnglish(dateString);
  console.log('[parseDDMMYYYY] After Bengali conversion:', englishDate);
  
  // Try to parse dd/mm/yyyy format first
  const parts = englishDate.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    
    if (!day || !month || !year) {
      console.log('[parseDDMMYYYY] Missing date parts');
      return null;
    }

    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) {
      console.log('[parseDDMMYYYY] Invalid numeric values');
      return null;
    }
    
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12 || yearNum < 1900 || yearNum > 2100) {
      console.log('[parseDDMMYYYY] Out of range values');
      return null;
    }
    
    // Create ISO string and parse to Date
    const isoString = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const date = new Date(isoString);
    
    if (isNaN(date.getTime())) {
      console.log('[parseDDMMYYYY] Invalid date object from ISO:', isoString);
      return null;
    }
    
    console.log('[parseDDMMYYYY] Successfully parsed:', date.toISOString());
    return date;
  }
  
  // Try ISO format or standard Date parsing
  const date = new Date(englishDate);
  if (!isNaN(date.getTime())) {
    console.log('[parseDDMMYYYY] Parsed as ISO/standard:', date.toISOString());
    return date;
  }
  
  console.log('[parseDDMMYYYY] Failed to parse');
  return null;
}

/**
 * Legacy function - kept for backward compatibility
 * @deprecated Use parseDDMMYYYY instead
 */
function sanitizeDate(dateString) {
  const parsed = parseDDMMYYYY(dateString);
  return parsed ? parsed.toISOString() : dateString;
}

module.exports = {
  bengaliToEnglish,
  sanitizeDate,
  parseDDMMYYYY
};
