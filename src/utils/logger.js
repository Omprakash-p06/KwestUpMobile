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
 * Safely serialize any object or Error instance recursively
 */
const serializeItem = (item, depth = 0) => {
  if (depth > 4) return '[Max Depth]';
  if (item instanceof Error) {
    return {
      name: item.name,
      message: item.message,
      stack: item.stack,
      ...(item.cause ? { cause: serializeItem(item.cause, depth + 1) } : {}),
    };
  }
  if (typeof item === 'object' && item !== null) {
    if (Array.isArray(item)) {
      return item.map((val) => serializeItem(val, depth + 1));
    }
    const serialized = {};
    for (const key of Object.keys(item)) {
      try {
        serialized[key] = serializeItem(item[key], depth + 1);
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
 */
const recordBreadcrumb = (level, message, details) => {
  const entry = sanitizeEntry(message, details);
  entry.level = level;

  if (logBuffer.length >= MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }
  logBuffer.push(entry);
};

export const debug = (message, ...details) => {
  recordBreadcrumb('DEBUG', message, details);
  if (isDevelopment()) {
    console.log(message, ...details);
  }
};

export const info = (message, ...details) => {
  recordBreadcrumb('INFO', message, details);
  if (isDevelopment()) {
    console.info ? console.info(message, ...details) : console.log(message, ...details);
  }
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
 * Return an immutable snapshot copy of the ring-buffer for diagnostics or crash reporting.
 */
export const getRecentLogs = () => {
  return logBuffer.map((entry) => ({ ...entry, details: [...entry.details] }));
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
