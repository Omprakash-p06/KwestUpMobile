/**
 * Global Jest Setup & Native Mocks Harness
 * ==========================================
 * Provides complete in-memory mocks for all native and Expo modules
 * allowing headless test execution in Node.js without native build artifacts.
 */

// 1. AsyncStorage Mock (Official in-memory mock)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// 2. Expo File System (In-memory virtual filesystem mock)
// Variables prefixed with `mock` are allowed inside jest.mock() factory
const mockInMemoryFS = new Map();

const mockNormalizePath = (uri) => {
  if (!uri) return '';
  let path = uri.replace(/^file:\/\//, '');
  if (!path.startsWith('/')) path = '/' + path;
  return path;
};

// Seed root directories
mockInMemoryFS.set('/mock-docs/', { isDirectory: true, content: null });
mockInMemoryFS.set('/mock-cache/', { isDirectory: true, content: null });

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///mock-docs/',
  cacheDirectory: 'file:///mock-cache/',
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64',
  },
  getInfoAsync: jest.fn(async (uri) => {
    const path = mockNormalizePath(uri);
    const entry = mockInMemoryFS.get(path);
    if (!entry) {
      const dirEntry = mockInMemoryFS.get(path + '/');
      if (dirEntry) {
        return { exists: true, isDirectory: true, uri, size: 0 };
      }
      return { exists: false, isDirectory: false, uri };
    }
    return {
      exists: true,
      isDirectory: entry.isDirectory,
      size: entry.content ? entry.content.length : 0,
      modificationTime: entry.modificationTime || Math.floor(Date.now() / 1000),
      uri,
    };
  }),
  makeDirectoryAsync: jest.fn(async (uri) => {
    let path = mockNormalizePath(uri);
    if (!path.endsWith('/')) path += '/';
    mockInMemoryFS.set(path, { isDirectory: true, content: null });
  }),
  writeAsStringAsync: jest.fn(async (uri, contents) => {
    const path = mockNormalizePath(uri);
    mockInMemoryFS.set(path, { isDirectory: false, content: String(contents) });
  }),
  readAsStringAsync: jest.fn(async (uri) => {
    const path = mockNormalizePath(uri);
    const entry = mockInMemoryFS.get(path);
    if (!entry || entry.isDirectory) {
      throw new Error(`File does not exist: ${uri}`);
    }
    return entry.content;
  }),
  deleteAsync: jest.fn(async (uri) => {
    let path = mockNormalizePath(uri);
    mockInMemoryFS.delete(path);
    if (!path.endsWith('/')) {
      mockInMemoryFS.delete(path + '/');
    }
    const prefix = path.endsWith('/') ? path : path + '/';
    for (const key of mockInMemoryFS.keys()) {
      if (key.startsWith(prefix)) {
        mockInMemoryFS.delete(key);
      }
    }
  }),
  readDirectoryAsync: jest.fn(async (uri) => {
    let dirPath = mockNormalizePath(uri);
    if (!dirPath.endsWith('/')) dirPath += '/';
    const names = new Set();
    for (const key of mockInMemoryFS.keys()) {
      if (key.startsWith(dirPath) && key !== dirPath) {
        const sub = key.slice(dirPath.length);
        const name = sub.split('/')[0];
        if (name) names.add(name);
      }
    }
    return Array.from(names);
  }),
  copyAsync: jest.fn(async ({ from, to }) => {
    const fromPath = mockNormalizePath(from);
    const toPath = mockNormalizePath(to);
    const entry = mockInMemoryFS.get(fromPath);
    if (!entry) throw new Error(`Source not found: ${from}`);
    mockInMemoryFS.set(toPath, { ...entry });
  }),
  moveAsync: jest.fn(async ({ from, to }) => {
    const fromPath = mockNormalizePath(from);
    const toPath = mockNormalizePath(to);
    const entry = mockInMemoryFS.get(fromPath);
    if (!entry) throw new Error(`Source not found: ${from}`);
    mockInMemoryFS.set(toPath, { ...entry });
    mockInMemoryFS.delete(fromPath);
  }),
  __inMemoryFS: mockInMemoryFS,
  __resetFS: () => {
    mockInMemoryFS.clear();
    mockInMemoryFS.set('/mock-docs/', { isDirectory: true, content: null });
    mockInMemoryFS.set('/mock-cache/', { isDirectory: true, content: null });
  },
}));

// 3. llama.rn (Native C++ LLM binding mock)
jest.mock('llama.rn', () => ({
  initLlama: jest.fn().mockResolvedValue({
    completion: jest.fn().mockResolvedValue({ text: 'Mock LLM completion response' }),
    release: jest.fn().mockResolvedValue(true),
    tokenize: jest.fn().mockResolvedValue([1, 2, 3]),
    detokenize: jest.fn().mockResolvedValue('detokenized text'),
  }),
  releaseAllLlama: jest.fn().mockResolvedValue(true),
}));

// 4. react-native-android-widget Mock
jest.mock('react-native-android-widget', () => ({
  requestWidgetUpdate: jest.fn().mockResolvedValue(true),
  registerWidgetTaskHandler: jest.fn(),
  FlexWidget: 'FlexWidget',
  TextWidget: 'TextWidget',
  IconWidget: 'IconWidget',
}));

// 5. Expo Notifications & Haptics & Sharing Mocks
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-notification-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  deleteNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getNotificationChannelsAsync: jest.fn().mockResolvedValue([]),
  getNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  AndroidNotificationPriority: {
    HIGH: 'high',
    DEFAULT: 'default',
  },
  AndroidImportance: {
    UNKNOWN: 0,
    UNSPECIFIED: 1,
    NONE: 2,
    MIN: 3,
    LOW: 4,
    DEFAULT: 5,
    HIGH: 6,
    MAX: 7,
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn().mockReturnValue([{ granted: true }, jest.fn()]),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(''),
  hasStringAsync: jest.fn().mockResolvedValue(true),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = (props) => React.createElement(Text, props, props.name || '');
  return {
    __esModule: true,
    default: {
      MaterialCommunityIcons: MockIcon,
      Ionicons: MockIcon,
      Feather: MockIcon,
      AntDesign: MockIcon,
      FontAwesome: MockIcon,
      MaterialIcons: MockIcon,
    },
    MaterialCommunityIcons: MockIcon,
    Ionicons: MockIcon,
    Feather: MockIcon,
    AntDesign: MockIcon,
    FontAwesome: MockIcon,
    MaterialIcons: MockIcon,
  };
});

// 6. React Native Reanimated Mock
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);
