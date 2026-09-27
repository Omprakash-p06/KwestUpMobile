/**
 * Centralized Local Date Utility Engine
 * =====================================
 * Single authoritative source of date/time calculation for calendar dates.
 * Eliminates UTC slicing bugs by strictly operating on device-local calendar units.
 */

/**
 * Returns a `YYYY-MM-DD` string in the device's local timezone.
 *
 * @param {Date|string|number} [input=new Date()] - Date instance, timestamp, or string
 * @returns {string} Formatted `YYYY-MM-DD` string, or empty string if invalid
 */
export function getLocalDateString(input = new Date()) {
  if (input === null || input === undefined || input === '') {
    return '';
  }

  let d;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const testDate = new Date(year, month - 1, day);
      if (
        testDate.getFullYear() === year &&
        testDate.getMonth() === month - 1 &&
        testDate.getDate() === day
      ) {
        return trimmed;
      }
      return '';
    }
    d = new Date(trimmed);
  } else if (typeof input === 'number') {
    d = new Date(input);
  } else {
    d = new Date(input);
  }

  if (!d || isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a `YYYY-MM-DD` string into a local Date instance set to midnight local time (00:00:00.000).
 * Prevents negative UTC timezone shifts caused by standard ECMAScript UTC midnight parsing.
 *
 * @param {string|Date|number} dateStr
 * @returns {Date}
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return new Date(dateStr.getTime());
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month - 1, day, 0, 0, 0, 0);
      }
    }
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Returns the `YYYY-MM-DD` string for the day immediately preceding the given date in local time.
 *
 * @param {Date|string|number} [input=new Date()]
 * @returns {string}
 */
export function getYesterdayLocalDateString(input = new Date()) {
  const base = input instanceof Date
    ? new Date(input.getTime())
    : (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
        ? parseLocalDate(input)
        : (input ? new Date(input) : new Date()));
  if (isNaN(base.getTime())) return '';
  base.setDate(base.getDate() - 1);
  return getLocalDateString(base);
}

/**
 * Returns the `YYYY-MM-DD` string for the day immediately following the given date in local time.
 *
 * @param {Date|string|number} [input=new Date()]
 * @returns {string}
 */
export function getTomorrowLocalDateString(input = new Date()) {
  const base = input instanceof Date
    ? new Date(input.getTime())
    : (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
        ? parseLocalDate(input)
        : (input ? new Date(input) : new Date()));
  if (isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + 1);
  return getLocalDateString(base);
}

/**
 * Returns the `YYYY-MM` month string in the device's local timezone.
 *
 * @param {Date|string|number} [input=new Date()]
 * @returns {string}
 */
export function getLocalMonthString(input = new Date()) {
  const str = getLocalDateString(input);
  return str ? str.slice(0, 7) : '';
}

/**
 * Returns the `MM-DD` month and day string in the device's local timezone.
 *
 * @param {Date|string|number} [input=new Date()]
 * @returns {string}
 */
export function getLocalMonthDayString(input = new Date()) {
  const str = getLocalDateString(input);
  return str ? str.slice(5, 10) : '';
}

/**
 * Determines whether two dates, timestamps, or date strings fall on the exact same local calendar day.
 *
 * @param {Date|string|number} d1
 * @param {Date|string|number} d2
 * @returns {boolean}
 */
export function isSameLocalDay(d1, d2) {
  if (!d1 || !d2) return false;
  const s1 = getLocalDateString(d1);
  const s2 = getLocalDateString(d2);
  if (!s1 || !s2) return false;
  return s1 === s2;
}

export default {
  getLocalDateString,
  parseLocalDate,
  getYesterdayLocalDateString,
  getTomorrowLocalDateString,
  getLocalMonthString,
  getLocalMonthDayString,
  isSameLocalDay,
};
