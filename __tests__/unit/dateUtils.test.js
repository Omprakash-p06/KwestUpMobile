/**
 * Unit Tests: Centralized Date Utility Engine
 * ===========================================
 * Verifies local timezone handling, boundary rollovers, leap years, and parsing.
 */

import {
  getLocalDateString,
  parseLocalDate,
  getYesterdayLocalDateString,
  getTomorrowLocalDateString,
  getLocalMonthString,
  getLocalMonthDayString,
  isSameLocalDay,
} from '../../src/utils/dateUtils';

describe('dateUtils', () => {
  describe('getLocalDateString', () => {
    it('returns today in YYYY-MM-DD format by default', () => {
      const today = getLocalDateString();
      expect(typeof today).toBe('string');
      expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true);

      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(today).toBe(expected);
    });

    it('formats a specific Date object using local year, month, and day', () => {
      const specificDate = new Date(2026, 4, 15, 14, 30); // May 15, 2026
      expect(getLocalDateString(specificDate)).toBe('2026-05-15');
    });

    it('passes through an already valid YYYY-MM-DD string', () => {
      expect(getLocalDateString('2026-11-20')).toBe('2026-11-20');
      expect(getLocalDateString('  2026-07-04  ')).toBe('2026-07-04');
    });

    it('converts timestamp numbers (epoch ms) into local YYYY-MM-DD', () => {
      const date = new Date(2026, 8, 27); // Sep 27, 2026
      expect(getLocalDateString(date.getTime())).toBe('2026-09-27');
    });

    it('returns empty string for null, undefined, or empty string', () => {
      expect(getLocalDateString(null)).toBe('');
      expect(getLocalDateString('')).toBe('');
      expect(getLocalDateString('   ')).toBe('');
    });

    it('rejects invalid date strings and non-existent calendar dates', () => {
      expect(getLocalDateString('invalid-date')).toBe('');
      expect(getLocalDateString('2023-02-29')).toBe(''); // Not a leap year
      expect(getLocalDateString('2026-04-31')).toBe(''); // April only has 30 days
    });

    it('accepts valid leap year date 2024-02-29', () => {
      expect(getLocalDateString('2024-02-29')).toBe('2024-02-29');
    });
  });

  describe('parseLocalDate', () => {
    it('parses YYYY-MM-DD at local midnight (00:00:00.000)', () => {
      const parsed = parseLocalDate('2026-04-01');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(3); // 0-indexed April
      expect(parsed.getDate()).toBe(1);
      expect(parsed.getHours()).toBe(0);
      expect(parsed.getMinutes()).toBe(0);
      expect(parsed.getSeconds()).toBe(0);
      expect(parsed.getMilliseconds()).toBe(0);
    });

    it('handles leap year date 2024-02-29 at local midnight', () => {
      const parsed = parseLocalDate('2024-02-29');
      expect(parsed.getFullYear()).toBe(2024);
      expect(parsed.getMonth()).toBe(1); // February
      expect(parsed.getDate()).toBe(29);
    });

    it('safely handles existing Date objects or numbers', () => {
      const orig = new Date(2026, 5, 10);
      const copy = parseLocalDate(orig);
      expect(copy.getTime()).toBe(orig.getTime());

      const fromNum = parseLocalDate(orig.getTime());
      expect(fromNum.getTime()).toBe(orig.getTime());
    });

    it('falls back safely to valid Date without throwing for invalid inputs', () => {
      expect(parseLocalDate(null)).toBeInstanceOf(Date);
      expect(parseLocalDate('')).toBeInstanceOf(Date);
      expect(parseLocalDate('random-junk')).toBeInstanceOf(Date);
    });
  });

  describe('getYesterdayLocalDateString', () => {
    it('calculates the day before a regular day', () => {
      expect(getYesterdayLocalDateString('2026-05-15')).toBe('2026-05-14');
    });

    it('handles month boundary rollovers', () => {
      expect(getYesterdayLocalDateString('2026-05-01')).toBe('2026-04-30');
      expect(getYesterdayLocalDateString('2026-04-01')).toBe('2026-03-31');
    });

    it('handles leap year rollover on March 1st', () => {
      expect(getYesterdayLocalDateString('2024-03-01')).toBe('2024-02-29');
    });

    it('handles non-leap year rollover on March 1st', () => {
      expect(getYesterdayLocalDateString('2023-03-01')).toBe('2023-02-28');
    });

    it('handles year boundary rollover (Jan 1 to Dec 31)', () => {
      expect(getYesterdayLocalDateString('2026-01-01')).toBe('2025-12-31');
    });
  });

  describe('getTomorrowLocalDateString', () => {
    it('calculates the day after a regular day', () => {
      expect(getTomorrowLocalDateString('2026-05-15')).toBe('2026-05-16');
    });

    it('handles month boundary rollovers', () => {
      expect(getTomorrowLocalDateString('2026-04-30')).toBe('2026-05-01');
      expect(getTomorrowLocalDateString('2026-05-31')).toBe('2026-06-01');
    });

    it('handles leap year rollover on February 28th and 29th', () => {
      expect(getTomorrowLocalDateString('2024-02-28')).toBe('2024-02-29');
      expect(getTomorrowLocalDateString('2024-02-29')).toBe('2024-03-01');
    });

    it('handles non-leap year rollover on February 28th', () => {
      expect(getTomorrowLocalDateString('2023-02-28')).toBe('2023-03-01');
    });

    it('handles year boundary rollover (Dec 31 to Jan 1)', () => {
      expect(getTomorrowLocalDateString('2025-12-31')).toBe('2026-01-01');
    });
  });

  describe('getLocalMonthString and getLocalMonthDayString', () => {
    it('extracts YYYY-MM correctly', () => {
      expect(getLocalMonthString('2026-10-15')).toBe('2026-10');
      expect(getLocalMonthString(new Date(2026, 0, 5))).toBe('2026-01');
    });

    it('extracts MM-DD correctly for birthdays and calendar keys', () => {
      expect(getLocalMonthDayString('2026-10-15')).toBe('10-15');
      expect(getLocalMonthDayString(new Date(2026, 11, 25))).toBe('12-25');
    });
  });

  describe('isSameLocalDay', () => {
    it('returns true for two identical date strings', () => {
      expect(isSameLocalDay('2026-04-01', '2026-04-01')).toBe(true);
    });

    it('returns true for same day with different local hours', () => {
      const morning = new Date(2026, 3, 1, 8, 30);
      const night = new Date(2026, 3, 1, 23, 45);
      expect(isSameLocalDay(morning, night)).toBe(true);
      expect(isSameLocalDay(morning, '2026-04-01')).toBe(true);
    });

    it('returns false for adjacent calendar days', () => {
      expect(isSameLocalDay('2026-04-01', '2026-04-02')).toBe(false);
      const d1 = new Date(2026, 3, 1, 23, 59, 59);
      const d2 = new Date(2026, 3, 2, 0, 0, 1);
      expect(isSameLocalDay(d1, d2)).toBe(false);
    });

    it('returns false when either argument is null, undefined, or invalid', () => {
      expect(isSameLocalDay(null, '2026-04-01')).toBe(false);
      expect(isSameLocalDay('2026-04-01', undefined)).toBe(false);
      expect(isSameLocalDay('invalid', '2026-04-01')).toBe(false);
    });
  });
});
