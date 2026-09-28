import React from 'react';
import { Text, View, Share } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import * as Clipboard from 'expo-clipboard';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { logger } from '../../src/utils/logger';

// Component that can throw during render
const ThrowingComponent = ({ shouldThrow, message }) => {
  if (shouldThrow) {
    throw new Error(message || 'Simulated Render Failure');
  }
  return <Text testID="healthy-child">Healthy Component Content</Text>;
};

describe('src/components/ErrorBoundary', () => {
  let originalConsoleError;
  let loggerErrorSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    logger.clearLogs();
    originalConsoleError = console.error;
    console.error = jest.fn(); // Suppress React error logging in tests
    loggerErrorSpy = jest.spyOn(logger, 'error');
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    console.error = originalConsoleError;
    loggerErrorSpy.mockRestore();
  });

  test('TC-OBS-06: Renders children normally when no error occurs', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ErrorBoundary>
      );
    });

    const root = tree.root;
    expect(root.findByProps({ testID: 'healthy-child' })).toBeDefined();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  test('TC-OBS-06 & TC-OBS-07: Catches render exception and displays recovery UI conforming to 19-UI-SPEC.md', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} message="Corrupt Note Tree" />
        </ErrorBoundary>
      );
    });

    const root = tree.root;
    const textNodes = root.findAllByType(Text);
    const combinedText = textNodes.map((n) => n.props.children).flat().join(' ');

    // 19-UI-SPEC.md copywriting contract verification
    expect(combinedText).toContain('Something Went Wrong');
    expect(combinedText).toContain(
      'KwestUp encountered an unexpected error. Your notes, tasks, and data remain safe on your device.'
    );
    expect(combinedText).toContain('Try Again');
    expect(combinedText).toContain('Copy Error Report');

    // Logger integration verification
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Unhandled React Error:',
      'Corrupt Note Tree',
      expect.any(String)
    );
  });

  test('TC-OBS-08: Try Again action resets error state', () => {
    let tree;
    let shouldThrow = true;

    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={shouldThrow} message="Transient Fail" />
        </ErrorBoundary>
      );
    });

    const instance = tree.root.instance;
    expect(instance.state.hasError).toBe(true);

    // Update children prop to healthy and press "Try Again"
    act(() => {
      tree.update(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={false} message="Transient Fail" />
        </ErrorBoundary>
      );
    });

    act(() => {
      instance.handleRetry();
    });

    expect(instance.state.hasError).toBe(false);
    expect(instance.state.error).toBeNull();
    expect(tree.root.findByProps({ testID: 'healthy-child' })).toBeDefined();
  });

  test('TC-OBS-09: Copy Error Report formats and writes diagnostic report to clipboard', async () => {
    // CR-01: breadcrumb carrying user content under a sensitive key must be
    // redacted in the clipboard payload, never verbatim.
    logger.info('Note opened', { title: 'Secret note #42' });
    logger.warn('Storage latency spike: 120ms');

    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} message="Fatal Parser Failure" />
        </ErrorBoundary>
      );
    });

    const instance = tree.root.instance;
    await act(async () => {
      await instance.handleCopyReport();
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    const copiedText = Clipboard.setStringAsync.mock.calls[0][0];

    expect(copiedText).toContain('=== KwestUp Diagnostics & Crash Report ===');
    expect(copiedText).toContain('Fatal Parser Failure');
    // CR-01: user content redacted, operational signal preserved
    expect(copiedText).toContain('[Redacted]');
    expect(copiedText).not.toContain('Secret note #42');
    expect(copiedText).toContain('Storage latency spike: 120ms');

    // Toast confirmation verification
    expect(instance.state.copiedToast).toBe(true);
    const root = tree.root;
    const textNodes = root.findAllByType(Text);
    const combinedText = textNodes.map((n) => n.props.children).flat().join(' ');
    expect(combinedText).toContain('Error report copied to clipboard');

    act(() => {
      jest.advanceTimersByTime(3500);
    });
    expect(instance.state.copiedToast).toBe(false);
  });

  test('Toggles collapsible diagnostic details between hidden and visible', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} message="Trace inspection test" />
        </ErrorBoundary>
      );
    });

    const instance = tree.root.instance;
    expect(instance.state.showDetails).toBe(false);

    // Toggle open
    act(() => {
      instance.toggleDetails();
    });
    expect(instance.state.showDetails).toBe(true);

    const root = tree.root;
    const textNodes = root.findAllByType(Text);
    const combinedText = textNodes.map((n) => n.props.children).flat().join(' ');
    expect(combinedText).toContain('Hide Diagnostic Details');
    expect(combinedText).toContain('Trace inspection test');

    // Toggle closed
    act(() => {
      instance.toggleDetails();
    });
    expect(instance.state.showDetails).toBe(false);
  });

  test('Supports custom fallback render function if provided via props', () => {
    let tree;
    const customFallback = (retry) => (
      <View testID="custom-fallback">
        <Text>Custom Recovery UI</Text>
      </View>
    );

    act(() => {
      tree = renderer.create(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent shouldThrow={true} message="Custom fallback test" />
        </ErrorBoundary>
      );
    });

    const root = tree.root;
    expect(root.findByProps({ testID: 'custom-fallback' })).toBeDefined();
  });

  test('WR-04: clipboard failure falls back to Share and still confirms copy', async () => {
    Clipboard.setStringAsync.mockRejectedValueOnce(new Error('clipboard denied'));
    Share.share = jest.fn().mockResolvedValue({ action: 'sharedAction' });

    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} message="Share fallback test" />
        </ErrorBoundary>
      );
    });

    const instance = tree.root.instance;
    await act(async () => {
      await instance.handleCopyReport();
    });

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(Share.share).toHaveBeenCalledTimes(1);
    expect(instance.state.copiedToast).toBe(true);
    expect(instance.state.copyFailed).toBe(false);
  });

  test('WR-04: double failure (clipboard + Share) shows failure UI, not success toast', async () => {
    Clipboard.setStringAsync.mockRejectedValueOnce(new Error('clipboard denied'));
    Share.share = jest.fn().mockRejectedValueOnce(new Error('share denied'));

    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} message="Double failure test" />
        </ErrorBoundary>
      );
    });

    const instance = tree.root.instance;
    await act(async () => {
      await instance.handleCopyReport();
    });

    expect(instance.state.copiedToast).toBe(false);
    expect(instance.state.copyFailed).toBe(true);
    const textNodes = tree.root.findAllByType(Text);
    const combinedText = textNodes.map((n) => n.props.children).flat().join(' ');
    expect(combinedText).toContain('Copy failed — please screenshot this screen');
  });

  test('WR-05: Restart Application tertiary action shows manual-restart prompt', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} message="Restart prompt test" />
        </ErrorBoundary>
      );
    });

    const instance = tree.root.instance;
    expect(instance.state.showRestartHint).toBe(false);

    let combinedText = tree.root
      .findAllByType(Text)
      .map((n) => n.props.children)
      .flat()
      .join(' ');
    expect(combinedText).toContain('Restart Application');

    act(() => {
      instance.handleRestartPrompt();
    });
    expect(instance.state.showRestartHint).toBe(true);

    combinedText = tree.root
      .findAllByType(Text)
      .map((n) => n.props.children)
      .flat()
      .join(' ');
    expect(combinedText).toContain('Please close and reopen KwestUp to restart the application.');
  });

  test('WR-06: explicit isDark prop renders without crashing', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ErrorBoundary isDark={false} currentTheme={{ background: '#0F172A' }}>
          <ThrowingComponent shouldThrow={true} message="Theme prop test" />
        </ErrorBoundary>
      );
    });
    expect(tree.root.instance.state.hasError).toBe(true);
  });
});
