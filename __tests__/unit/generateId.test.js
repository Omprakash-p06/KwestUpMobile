import { generateId } from '../../src/utils/generateId';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('is safe to embed in storage keys and file names', () => {
    // Only lowercase base36 plus the separator — no characters that need
    // escaping in AsyncStorage keys or vault file paths.
    expect(generateId()).toMatch(/^[a-z0-9-]+$/);
  });

  it('never collides across 10,000 rapid calls', () => {
    const ids = new Set();
    for (let i = 0; i < 10000; i += 1) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(10000);
  });

  it('stays unique within a single millisecond', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    try {
      const ids = new Set();
      for (let i = 0; i < 2000; i += 1) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(2000);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('produces distinct prefixes for distinct timestamps', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const a = generateId();
    nowSpy.mockReturnValue(1700000000001);
    const b = generateId();
    nowSpy.mockRestore();

    const prefix = (id) => id.split('-')[0];
    expect(prefix(a)).not.toBe(prefix(b));
  });
});
