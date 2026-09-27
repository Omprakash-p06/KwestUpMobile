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
 * Strict contract: only `YYYY-MM-DD` (validated by regex + component round-trip),
 * Date instances, and finite numbers are accepted. Anything else — null, undefined,
 * empty/whitespace strings, ISO datetimes, non-existent calendar dates
 * (`2023-02-29`), booleans, objects — yields an Invalid Date, never today.
 *
 * @param {string|Date|number} dateStr
 * @returns {Date} Local-midnight Date, or Invalid Date if input is not a valid calendar date
 */
export function parseLocalDate(dateStr) {
  if (dateStr === null || dateStr === undefined) return new Date(NaN);
  if (dateStr instanceof Date) return new Date(dateStr.getTime());
  if (typeof dateStr === 'number') {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(NaN) : d;
  }
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      const candidate = new Date(year, month - 1, day, 0, 0, 0, 0);
      if (
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day
      ) {
        return candidate;
      }
    }
    return new Date(NaN);
  }
  return new Date(NaN);
}

/**
 * Returns the `YYYY-MM-DD` string for the day immediately preceding the given date in local time.
 *
 * @param {Date|string|number} [input=new Date()]
 * @returns {string}
 */
export function getYesterdayLocalDateString(input = new Date()) {
  if (input === null || input === undefined || (typeof input === 'string' && input.trim() === '')) {
    input = new Date();
  }
  const base = input instanceof Date
    ? new Date(input.getTime())
    : (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
        ? parseLocalDate(input)
        : new Date(input));
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
  if (input === null || input === undefined || (typeof input === 'string' && input.trim() === '')) {
    input = new Date();
  }
  const base = input instanceof Date
    ? new Date(input.getTime())
    : (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
        ? parseLocalDate(input)
        : new Date(input));
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
  if (d1 === null || d1 === undefined || d1 === '') return false;
  if (d2 === null || d2 === undefined || d2 === '') return false;
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
