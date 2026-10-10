import {
  logger,
  debug,
  info,
  warn,
  error,
  getRecentLogs,
  clearLogs,
  MAX_LOG_BUFFER_SIZE,
} from '../../src/utils/logger';

describe('src/utils/logger', () => {
  let originalConsoleLog;
  let originalConsoleInfo;
  let originalConsoleWarn;
  let originalConsoleError;
  let originalDev;
  let originalNodeEnv;

  beforeEach(() => {
    clearLogs();
    originalConsoleLog = console.log;
    originalConsoleInfo = console.info;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalDev = global.__DEV__;
    originalNodeEnv = process.env.NODE_ENV;

    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    global.__DEV__ = originalDev;
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('Level emission in development mode', () => {
    beforeEach(() => {
      global.__DEV__ = true;
    });

    test('debug emits to console.log in development', () => {
      debug('Debug message test', { key: 'val' });
      expect(console.log).toHaveBeenCalledWith('Debug message test', { key: 'val' });
    });

    test('info emits to console.info in development', () => {
      info('Info message test');
      expect(console.info).toHaveBeenCalledWith('Info message test');
    });

    test('warn always emits to console.warn', () => {
      warn('Warning test', 'arg2');
      expect(console.warn).toHaveBeenCalledWith('Warning test', 'arg2');
    });

    test('error always emits to console.error', () => {
      error('Error test', new Error('Something failed'));
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Level suppression in production mode', () => {
    beforeEach(() => {
      global.__DEV__ = false;
      process.env.NODE_ENV = 'production';
    });

    test('debug is silenced in production mode', () => {
      debug('Silent debug log');
      expect(console.log).not.toHaveBeenCalled();
    });

    test('CR-02: debug/info neither emit nor buffer in production', () => {
      debug('Prod debug noise', { content: 'verbose' });
      info('Prod info noise', { content: 'verbose' });
      expect(console.log).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(getRecentLogs()).toHaveLength(0);
    });

    test('info is silenced in production mode', () => {
      info('Silent info log');
      expect(console.info).not.toHaveBeenCalled();
    });

    test('warn still passes through in production mode', () => {
      warn('Critical operational warning');
      expect(console.warn).toHaveBeenCalledWith('Critical operational warning');
    });

    test('CR-02: warn/error still buffer + passthrough in production', () => {
      warn('Prod warn signal');
      error('Prod error signal');
      expect(console.warn).toHaveBeenCalledWith('Prod warn signal');
      expect(console.error).toHaveBeenCalledWith('Prod error signal');
      const logs = getRecentLogs();
      expect(logs).toHaveLength(2);
      expect(logs.map((l) => l.level)).toEqual(['WARN', 'ERROR']);
    });

    test('error still passes through in production mode', () => {
      error('Catastrophic failure');
      expect(console.error).toHaveBeenCalledWith('Catastrophic failure');
    });
  });

  describe('Circular ring-buffer forensics & FIFO eviction', () => {
    test('records entries with timestamp, level, and details', () => {
      debug('Buffer test entry', 123);
      const logs = getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('DEBUG');
      expect(logs[0].message).toBe('Buffer test entry');
      expect(logs[0].details).toEqual([123]);
      expect(new Date(logs[0].timestamp).toISOString()).toBe(logs[0].timestamp);
    });

    test('enforces MAX_LOG_BUFFER_SIZE with FIFO eviction on overflow', () => {
      expect(MAX_LOG_BUFFER_SIZE).toBe(50);

      // Log 60 entries
      for (let i = 1; i <= 60; i++) {
        info(`Message #${i}`);
      }

      const logs = getRecentLogs();
      expect(logs).toHaveLength(50);
      // First 10 items (1 to 10) should have been evicted; earliest remaining should be #11
      expect(logs[0].message).toBe('Message #11');
      expect(logs[49].message).toBe('Message #60');
    });

    test('getRecentLogs returns an immutable snapshot that resists outside mutation', () => {
      info('Immutable test');
      const snapshot1 = getRecentLogs();
      snapshot1.push({ level: 'FAKE', message: 'Hacked' });
      // WR-02: entries are deep-frozen at record time — mutation attempts
      // either throw (strict mode) or silently no-op (transpiled output).
      // Either way the live buffer must be unaffected.
      try {
        snapshot1[0].message = 'Mutated';
      } catch {
        // strict-mode throw is fine — buffer still intact
      }
      try {
        snapshot1[0].details.push('injected');
      } catch {
        // strict-mode throw is fine — buffer still intact
      }

      const snapshot2 = getRecentLogs();
      expect(snapshot2).toHaveLength(1);
      expect(snapshot2[0].message).toBe('Immutable test');
      expect(snapshot2[0].details).toEqual([]);
    });

    test('nested detail mutation cannot corrupt the forensic buffer (WR-02)', () => {
      error('Nested test', { cause: { reason: 'disk-full', nested: { code: 42 } } });
      const snapshot = getRecentLogs();
      expect(Object.isFrozen(snapshot[0])).toBe(true);
      expect(Object.isFrozen(snapshot[0].details)).toBe(true);
      expect(Object.isFrozen(snapshot[0].details[0])).toBe(true);
      try {
        snapshot[0].details[0].cause.nested.code = 999;
      } catch {
        // strict-mode throw is fine — buffer still intact
      }

      const fresh = getRecentLogs();
      expect(fresh[0].details[0].cause.nested.code).toBe(42);
    });

    test('CR-01: sensitive keys are redacted before buffering', () => {
      info('Vault opened', {
        notebook: 'Personal',
        title: 'Secret meeting notes',
        content: 'User wrote private diary entry #42',
        token: 'abc123',
        habitTitle: 'Quit smoking',
        cueText: 'Craving after lunch',
        safeField: 'operational-status-ok',
      });
      const logs = getRecentLogs();
      const details = logs[0].details[0];
      expect(details.notebook).toBe('[Redacted]');
      expect(details.title).toBe('[Redacted]');
      expect(details.content).toBe('[Redacted]');
      expect(details.token).toBe('[Redacted]');
      expect(details.habitTitle).toBe('[Redacted]');
      expect(details.cueText).toBe('[Redacted]');
      expect(details.safeField).toBe('operational-status-ok');
      expect(JSON.stringify(logs)).not.toContain('Secret meeting notes');
      expect(JSON.stringify(logs)).not.toContain('private diary entry #42');
      expect(JSON.stringify(logs)).not.toContain('Quit smoking');
      expect(JSON.stringify(logs)).not.toContain('Craving after lunch');
    });

    test('clearLogs clears the buffer entirely', () => {
      warn('Log 1');
      error('Log 2');
      expect(getRecentLogs()).toHaveLength(2);

      clearLogs();
      expect(getRecentLogs()).toHaveLength(0);
    });

    test('safely records Error instances in message and details without throwing', () => {
      const err = new Error('Disk full');
      error(err, { cause: new Error('Sub-error') });

      const logs = getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('ERROR');
      expect(logs[0].message).toContain('Disk full');
      expect(logs[0].details[0].cause.message).toBe('Sub-error');
    });
  });

  describe('babel.config.js configuration verification', () => {
    const babelConfig = require('../../babel.config');

    test('includes transform-remove-console excluding error and warn in production', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const config = babelConfig({ cache: () => {} });
        const removeConsolePlugin = config.plugins.find(
          (p) => Array.isArray(p) && p[0] === 'transform-remove-console',
        );
        expect(removeConsolePlugin).toBeDefined();
        expect(removeConsolePlugin[1]).toEqual({ exclude: ['error', 'warn'] });

        // reanimated must be the last plugin
        const lastPlugin = config.plugins[config.plugins.length - 1];
        expect(lastPlugin).toBe('react-native-reanimated/plugin');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('omits transform-remove-console in development or test', () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'test';
        const config = babelConfig({ cache: () => {} });
        const removeConsolePlugin = config.plugins.find(
          (p) => Array.isArray(p) && p[0] === 'transform-remove-console',
        );
        expect(removeConsolePlugin).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
