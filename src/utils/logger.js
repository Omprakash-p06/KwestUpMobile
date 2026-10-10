/* eslint-disable no-console */
/**
 * Structured Logging & In-Memory Forensics Breadcrumb Engine
 *
 * OBS-01: Environment-aware logging utility with bounded circular ring-buffer.
 * In development (__DEV__ === true), debug and info messages flow to the console.
 * In production (__DEV__ === false), debug and info messages are silenced, while
 * warn and error diagnostics always pass through to native console.
 *
 * All levels record to an in-memory 50-entry FIFO ring-buffer for crash forensics.
 */

export const MAX_LOG_BUFFER_SIZE = 50;

const logBuffer = [];

/**
 * Determine if current execution environment is development mode.
 * Falls back to NODE_ENV when __DEV__ is not defined.
 */
export const isDevelopment = () => {
  if (typeof __DEV__ !== 'undefined') {
    return Boolean(__DEV__);
  }
  return process.env.NODE_ENV !== 'production';
};

/**
 * Safely serialize any object or Error instance recursively.
 *
 * CR-01: key-based PII redaction is applied BEFORE buffering so user content
 * (note titles/bodies, vault names, tokens, …) never lands verbatim in the
 * forensic ring-buffer — and therefore never in the copy-pasteable crash
 * report built from it. String values are length-capped to bound memory.
 * A WeakSet cycle guard (not just the depth cap) prevents infinite recursion.
 */
const SENSITIVE_KEYS =
  /(content|body|note|title|text|message|passphrase|token|key|secret|password|habitTitle|cueText)/i;
const MAX_STRING_CHARS = 1000;
const MAX_ARRAY_ITEMS = 50;

const truncateString = (value) =>
  value.length > MAX_STRING_CHARS
    ? `${value.slice(0, MAX_STRING_CHARS)}…[truncated]`
    : value;

const serializeItem = (item, depth = 0, seen = new WeakSet()) => {
  if (depth > 4) return '[Max Depth]';
  if (typeof item === 'string') return truncateString(item);
  if (item instanceof Error) {
    return {
      name: item.name,
      message: truncateString(item.message),
      stack: truncateString(item.stack || ''),
      ...(item.cause
        ? { cause: serializeItem(item.cause, depth + 1, seen) }
        : {}),
    };
  }
  if (typeof item === 'object' && item !== null) {
    if (seen.has(item)) return '[Circular]';
    seen.add(item);
    if (Array.isArray(item)) {
      return item
        .slice(0, MAX_ARRAY_ITEMS)
        .map((val) => serializeItem(val, depth + 1, seen));
    }
    const serialized = {};
    for (const key of Object.keys(item)) {
      try {
        serialized[key] = SENSITIVE_KEYS.test(key)
          ? '[Redacted]'
          : serializeItem(item[key], depth + 1, seen);
      } catch {
        serialized[key] = '[Unserializable]';
      }
    }
    return serialized;
  }
  return item;
};

/**
 * Safely format log arguments to string/object representation
 */
const sanitizeEntry = (message, details) => {
  let formattedMessage = '';
  if (typeof message === 'string') {
    formattedMessage = message;
  } else if (message instanceof Error) {
    formattedMessage = message.message || message.toString();
  } else {
    try {
      formattedMessage = JSON.stringify(message);
    } catch {
      formattedMessage = String(message);
    }
  }

  const safeDetails = details.map((item) => serializeItem(item));

  return {
    timestamp: new Date().toISOString(),
    message: formattedMessage,
    details: safeDetails,
  };
};

/**
 * Push an entry into the in-memory circular ring-buffer with FIFO eviction.
 *
 * WR-02: entries are deep-frozen at record time, so consumers holding a
 * snapshot from getRecentLogs() cannot corrupt the live buffer by mutating
 * nested detail objects (e.g. logs[0].details[0].cause).
 */
const deepFreeze = (value, seen = new WeakSet()) => {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  Object.values(value).forEach((child) => deepFreeze(child, seen));
  return Object.freeze(value);
};

const recordBreadcrumb = (level, message, details) => {
  const entry = sanitizeEntry(message, details);
  entry.level = level;
  deepFreeze(entry);

  if (logBuffer.length >= MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
  logBuffer.push(entry);
};

// CR-02 decision (documented): debug AND info are fully gated on
// isDevelopment() — they neither emit to console NOR buffer breadcrumbs in
// production. Rationale: the migrated debug/info chatter (migration, export,
// sync) is high-volume and privacy-sensitive, and the plan promises these
// levels are "silenced in production". warn/error always buffer + passthrough
// at every level because they carry operational/forensic signal.
export const debug = (message, ...details) => {
  if (!isDevelopment()) return; // do not buffer prod debug noise
  recordBreadcrumb('DEBUG', message, details);
  console.log(message, ...details);
};

export const info = (message, ...details) => {
  if (!isDevelopment()) return; // do not buffer prod info noise
  recordBreadcrumb('INFO', message, details);
  console.info(message, ...details);
};

export const warn = (message, ...details) => {
  recordBreadcrumb('WARN', message, details);
  console.warn(message, ...details);
};

export const error = (message, ...details) => {
  recordBreadcrumb('ERROR', message, details);
  console.error(message, ...details);
};

/**
 * Return a snapshot copy of the ring-buffer for diagnostics or crash reporting.
 *
 * WR-02: entries are deep-frozen at record time, so the snapshot shares the
 * frozen entry objects directly (no spread-copy — spreading would shed the
 * freeze). Consumers cannot mutate buffer state through the snapshot; only
 * the outer array is a fresh copy.
 */
export const getRecentLogs = () => {
  return [...logBuffer];
};

/**
 * Clear all buffered log breadcrumbs.
 */
export const clearLogs = () => {
  logBuffer.length = 0;
};

export const logger = {
  debug,
  info,
  warn,
  error,
  getRecentLogs,
  clearLogs,
  MAX_LOG_BUFFER_SIZE,
  isDevelopment,
};

export default logger;
