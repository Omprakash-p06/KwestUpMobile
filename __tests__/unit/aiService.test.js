import * as FileSystem from 'expo-file-system';
import { AppState } from 'react-native';
import { initLlama, releaseAllLlama } from 'llama.rn';
import {
  MODEL_FILENAME,
  MODEL_PINNED_COMMIT,
  MODEL_EXPECTED_SHA256,
  MODEL_EXPECTED_SIZE,
  MODEL_DOWNLOAD_URL,
  MODEL_PATH,
  computeSha256,
  hashFileSha256,
  defaultFileHashValidator,
  MODEL_HASH_CHUNK_BYTES,
  verifyModelIntegrity,
  isModelDownloaded,
  loadModel,
  unloadModel,
  getModelContextStatus,
  resetIdleTimer,
  IDLE_UNLOAD_TIMEOUT_MS,
  subscribeAppState,
  unsubscribeAppState,
  extractTasksFromNoteHeuristic,
  summarizeNoteHeuristic,
  extractTasksFromNote,
  summarizeNote,
  parseGlobalCommand,
  handleAppStateChange,
} from '../../src/utils/aiService';

describe('aiService - Plan 18-01 & 18-02: Pipeline Hardening & Memory Lifecycle', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    await unloadModel();
    jest.clearAllMocks();
    initLlama.mockReset();
    releaseAllLlama.mockReset();
    initLlama.mockResolvedValue({ completion: jest.fn(), release: jest.fn() });
    releaseAllLlama.mockResolvedValue(true);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await unloadModel();
  });

  // =========================================================================
  // Plan 18-01: Model Pinning & Integrity Verification
  // =========================================================================
  describe('Model Configuration & Pinning Constants', () => {
    it('pins the Hugging Face download URL to the verified commit hash', () => {
      expect(MODEL_FILENAME).toBe('qwen2.5-0.5b-instruct-q4_k_m.gguf');
      expect(MODEL_PINNED_COMMIT).toBe('9217f5db79a29953eb74d5343926648285ec7e67');
      expect(MODEL_EXPECTED_SHA256).toBe(
        '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db'
      );
      expect(MODEL_EXPECTED_SIZE).toBe(491400032);
      expect(MODEL_DOWNLOAD_URL).toBe(
        `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/${MODEL_PINNED_COMMIT}/${MODEL_FILENAME}`
      );
    });

    it('computeSha256 correctly computes hex digest using crypto-js', () => {
      expect(computeSha256('')).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
      expect(computeSha256('hello world')).toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      );
      expect(computeSha256(null)).toBe('');
      expect(computeSha256(undefined)).toBe('');
    });
  });

  describe('verifyModelIntegrity & isModelDownloaded', () => {
    it('returns false when model file does not exist', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });

      const isValid = await verifyModelIntegrity(MODEL_PATH);
      expect(isValid).toBe(false);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('default path fail-closes when size matches but content hash cannot be verified', async () => {
      // Size match alone no longer passes: the default validator streams the
      // file through SHA-256, and the mock FS holds no such file (read throws).
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      const isValid = await verifyModelIntegrity(MODEL_PATH);
      expect(isValid).toBe(false);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(MODEL_PATH, {
        idempotent: true,
      });
    });

    it('explicit null validator keeps the size-only fast path (no hashing)', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      const isValid = await verifyModelIntegrity(MODEL_PATH, null);
      expect(isValid).toBe(true);
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('deletes file and returns false if file size is corrupted or truncated', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: 350000000,
      });

      const isValid = await verifyModelIntegrity(MODEL_PATH);
      expect(isValid).toBe(false);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(MODEL_PATH, {
        idempotent: true,
      });
    });

    it('calls custom validator and deletes file if custom validator fails', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      const customValidator = jest.fn().mockResolvedValue(false);
      const isValid = await verifyModelIntegrity(MODEL_PATH, customValidator);

      expect(customValidator).toHaveBeenCalledWith(MODEL_PATH);
      expect(isValid).toBe(false);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(MODEL_PATH, {
        idempotent: true,
      });
    });

    it('isModelDownloaded delegates to verifyModelIntegrity', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      const downloaded = await isModelDownloaded();
      expect(downloaded).toBe(true);
    });
  });

  describe('loadModel Mutex & Concurrency Lock', () => {
    it('throws when model is not downloaded', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });

      await expect(loadModel()).rejects.toThrow(
        'Model not downloaded or corrupted. Please download the AI model first.'
      );
    });

    it('successfully loads model context when verified', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      const ctx = await loadModel();
      expect(ctx).toBeDefined();
      expect(initLlama).toHaveBeenCalledTimes(1);
      expect(initLlama).toHaveBeenCalledWith(
        expect.objectContaining({
          model: MODEL_PATH,
          n_ctx: 2048,
          n_threads: 2,
          n_gpu_layers: 0,
        })
      );
    });

    it('coalesces concurrent calls into a single initialization promise', async () => {
      FileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      let callCount = 0;
      initLlama.mockImplementation(async () => {
        callCount++;
        await new Promise((r) => setImmediate(r));
        return { completion: jest.fn(), release: jest.fn() };
      });

      const [ctx1, ctx2, ctx3] = await Promise.all([
        loadModel(),
        loadModel(),
        loadModel(),
      ]);

      expect(ctx1).toBe(ctx2);
      expect(ctx2).toBe(ctx3);
      expect(callCount).toBe(1);
    });

    it('unloadModel calls releaseAllLlama and resets context', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      await loadModel();
      expect(initLlama).toHaveBeenCalledTimes(1);

      await unloadModel();
      expect(releaseAllLlama).toHaveBeenCalledTimes(1);

      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });
      await loadModel();
      expect(initLlama).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // Plan 18-02: Memory Lifecycle & Context Status
  // =========================================================================
  describe('Memory Lifecycle & Diagnostics (AI-02)', () => {
    it('getModelContextStatus accurately reflects loaded and loading states', async () => {
      expect(getModelContextStatus()).toEqual({
        isLoaded: false,
        isLoading: false,
      });

      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      await loadModel();
      expect(getModelContextStatus()).toEqual({
        isLoaded: true,
        isLoading: false,
      });

      await unloadModel();
      expect(getModelContextStatus()).toEqual({
        isLoaded: false,
        isLoading: false,
      });
    });

    it('handleAppStateChange background/inactive transition triggers unloadModel', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      await loadModel();
      expect(getModelContextStatus().isLoaded).toBe(true);

      await handleAppStateChange('background');
      expect(releaseAllLlama).toHaveBeenCalled();
      expect(getModelContextStatus().isLoaded).toBe(false);
    });

    it('idle timer unloads model after inactivity', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      await loadModel();
      expect(getModelContextStatus().isLoaded).toBe(true);

      jest.useFakeTimers();
      resetIdleTimer();
      // Advance past the 5-minute idle threshold
      jest.advanceTimersByTime(IDLE_UNLOAD_TIMEOUT_MS + 1000);
      await Promise.resolve();
      expect(releaseAllLlama).toHaveBeenCalled();
      expect(getModelContextStatus().isLoaded).toBe(false);

      jest.useRealTimers();
    });
  });

  // =========================================================================
  // Plan 18-02: Rule-Based Heuristic Extraction
  // =========================================================================
  describe('Rule-Based Heuristic Extraction (Offline Fallbacks)', () => {
    describe('extractTasksFromNoteHeuristic', () => {
      it('returns empty array for empty, non-string, or null inputs', () => {
        expect(extractTasksFromNoteHeuristic(null)).toEqual([]);
        expect(extractTasksFromNoteHeuristic(undefined)).toEqual([]);
        expect(extractTasksFromNoteHeuristic('')).toEqual([]);
        expect(extractTasksFromNoteHeuristic('   \n  ')).toEqual([]);
      });

      it('extracts markdown checkboxes properly', () => {
        const note = `
# Grocery List
- [ ] Buy organic whole milk
- [x] Pick up eggs from market
* [ ] Call plumber about leak
+ [ ] Review quarterly budget
`;
        const tasks = extractTasksFromNoteHeuristic(note);
        expect(tasks).toContain('Buy organic whole milk');
        expect(tasks).toContain('Pick up eggs from market');
        expect(tasks).toContain('Call plumber about leak');
        expect(tasks).toContain('Review quarterly budget');
      });

      it('extracts explicit TODO/Action tags', () => {
        const note = `
Meeting Notes:
TODO: Send follow-up email to client
Action: Prepare presentation slides
FIXME: Repair broken navigation drawer link
`;
        const tasks = extractTasksFromNoteHeuristic(note);
        expect(tasks).toContain('Send follow-up email to client');
        expect(tasks).toContain('Prepare presentation slides');
        expect(tasks).toContain('Repair broken navigation drawer link');
      });

      it('extracts bullet points starting with imperative action verbs', () => {
        const note = `
Next steps:
- Buy stationery for office
* Call Dr. Martinez for checkup
• Schedule team sync for Monday
- Organize shared documents
`;
        const tasks = extractTasksFromNoteHeuristic(note);
        expect(tasks).toContain('Buy stationery for office');
        expect(tasks).toContain('Call Dr. Martinez for checkup');
        expect(tasks).toContain('Schedule team sync for Monday');
        expect(tasks).toContain('Organize shared documents');
      });

      it('deduplicates identical tasks ignoring case', () => {
        const note = `
- [ ] Buy milk
TODO: Buy milk
- Buy milk
`;
        const tasks = extractTasksFromNoteHeuristic(note);
        expect(tasks).toEqual(['Buy milk']);
      });
    });

    describe('summarizeNoteHeuristic', () => {
      it('returns placeholder for empty note', () => {
        expect(summarizeNoteHeuristic('')).toBe('• Empty note');
        expect(summarizeNoteHeuristic(null)).toBe('• Empty note');
      });

      it('extracts headings and bold topics as summary bullets', () => {
        const note = `
# Architecture Review
We discussed offline resilience.

## Core Decisions
**Storage Strategy**: Use AsyncStorage with AES encryption.
**AI Pipeline**: Local Qwen 0.5B GGUF with heuristic fallbacks.

- [ ] Complete Phase 18
`;
        const summary = summarizeNoteHeuristic(note);
        expect(summary).toContain('• Architecture Review');
        expect(summary).toContain('• Core Decisions');
        expect(summary).toContain('• Storage Strategy - Use AsyncStorage with AES encryption.');
        expect(summary).toContain('• Task: Complete Phase 18');
      });

      it('falls back to paragraph first sentences when no headings exist', () => {
        const note = `
Antigravity coding pairs human intelligence with automated verification. It maintains local-first guarantees.

Every milestone undergoes rigorous auditing. This ensures zero regression in production releases.
`;
        const summary = summarizeNoteHeuristic(note);
        expect(summary).toContain('• Antigravity coding pairs human intelligence with automated verification');
        expect(summary).toContain('• Every milestone undergoes rigorous auditing');
      });
    });
  });

  // =========================================================================
  // Plan 18-02: Graceful Fallbacks in Inference Methods
  // =========================================================================
  describe('Inference Fallback Resilience', () => {
    it('extractTasksFromNote falls back to heuristic when model is unavailable', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });

      const note = `
# Project Plan
- [ ] Implement local-first encryption
- [ ] Validate unit test suite
`;
      const tasks = await extractTasksFromNote(note);
      expect(tasks).toEqual([
        'Implement local-first encryption',
        'Validate unit test suite',
      ]);
    });

    it('summarizeNote falls back to heuristic and triggers token callback when model fails', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({ exists: false });

      const note = `
# Feature Launch
Release v3.5 is targeted for this week.
`;
      const tokenStream = [];
      const onToken = (token) => tokenStream.push(token);

      const summary = await summarizeNote(note, onToken);
      expect(summary).toContain('• Feature Launch');
      expect(tokenStream.join('')).toContain('• Feature Launch');
    });

    describe('parseGlobalCommand fallback parsing', () => {
      beforeEach(() => {
        FileSystem.getInfoAsync.mockResolvedValue({ exists: false });
      });

      it('parses expense transaction via keyword fallback', async () => {
        const cmd = 'Spent $45 on groceries';
        const res = await parseGlobalCommand(cmd);
        expect(res).toEqual({
          type: 'transaction',
          transactionType: 'expense',
          amount: 45,
          category: 'Food',
          description: 'groceries',
        });
      });

      it('parses income transaction via keyword fallback', async () => {
        const cmd = 'Earned $3200 salary';
        const res = await parseGlobalCommand(cmd);
        expect(res).toEqual({
          type: 'transaction',
          transactionType: 'income',
          amount: 3200,
          category: 'Salary',
          description: 'Income',
        });
      });

      it('parses birthday via keyword fallback', async () => {
        const cmd = "Add birthday for Sarah on Oct 25";
        const res = await parseGlobalCommand(cmd);
        expect(res.type).toBe('birthday');
        expect(res.name).toBe('Sarah');
        expect(res.date).toBe('10-25');
      });

      it('parses tomorrow task with local date authority', async () => {
        const cmd = 'Buy milk tomorrow';
        const res = await parseGlobalCommand(cmd);
        expect(res.type).toBe('task');
        expect(res.title).toBe('Buy milk');
        expect(res.dueDate).toBeDefined();
        // Ensure due date parses as valid ISO string
        expect(new Date(res.dueDate).toISOString()).toBe(res.dueDate);
      });

      it('parses today task with local date authority', async () => {
        const cmd = 'Call dentist today';
        const res = await parseGlobalCommand(cmd);
        expect(res.type).toBe('task');
        expect(res.title).toBe('Call dentist');
        expect(res.dueDate).toBeDefined();
        expect(new Date(res.dueDate).toISOString()).toBe(res.dueDate);
      });

      it('returns a safe task instead of throwing on null/undefined/non-string input (W-3)', async () => {
        for (const bad of [null, undefined, 42]) {
          const res = await parseGlobalCommand(bad);
          expect(res).toEqual({
            type: 'task',
            title: 'New Task',
            description: expect.any(String),
            dueDate: null,
          });
        }
      });
    });
  });

  // =========================================================================
  // Review fixes: C-1 default SHA-256 file verification path
  // =========================================================================
  describe('SHA-256 File Verification Default Path (C-1)', () => {
    const toB64 = (s) => Buffer.from(s, 'utf8').toString('base64');
    let originalReadImpl;

    beforeEach(() => {
      originalReadImpl = FileSystem.readAsStringAsync.getMockImplementation();
    });

    afterEach(() => {
      FileSystem.readAsStringAsync.mockImplementation(originalReadImpl);
    });

    it('hashFileSha256 streams base64 chunks incrementally without loading the whole file', async () => {
      FileSystem.readAsStringAsync.mockImplementation(async (uri, opts) =>
        (opts?.position ?? 0) === 0 ? toB64('hello world') : ''
      );

      await expect(hashFileSha256('file:///mock-docs/models/x.gguf', 4)).resolves.toBe(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
      );
      expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ encoding: 'base64', position: 0, length: 4 })
      );
    });

    it('verifyModelIntegrity default path rejects a same-size file with wrong hash and deletes it', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });
      FileSystem.readAsStringAsync.mockImplementation(async (uri, opts) =>
        (opts?.position ?? 0) === 0 ? toB64('tampered content, same size lie') : ''
      );

      const isValid = await verifyModelIntegrity(MODEL_PATH);
      expect(isValid).toBe(false);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(MODEL_PATH, {
        idempotent: true,
      });
    });

    it('verifyModelIntegrity treats a throwing validator as a mismatch (fail-closed)', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      await expect(
        verifyModelIntegrity(MODEL_PATH, async () => {
          throw new Error('HSM offline');
        })
      ).resolves.toBe(false);
      expect(FileSystem.deleteAsync).toHaveBeenCalledWith(MODEL_PATH, {
        idempotent: true,
      });
    });

    it('verifyModelIntegrity(null) keeps the explicit size-only fast path without hashing', async () => {
      FileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      await expect(verifyModelIntegrity(MODEL_PATH, null)).resolves.toBe(true);
      expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
      expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
    });

    it('defaultFileHashValidator compares against the pinned SHA-256 constant', async () => {
      FileSystem.readAsStringAsync.mockImplementation(async () => '');
      // Empty stream hashes to e3b0... which is NOT the pinned model hash.
      await expect(defaultFileHashValidator(MODEL_PATH)).resolves.toBe(false);
      expect(MODEL_HASH_CHUNK_BYTES).toBe(8 * 1024 * 1024);
    });
  });

  // =========================================================================
  // Review fixes: W-1 unload-while-inflight race
  // =========================================================================
  describe('Unload-While-Inflight Race (W-1)', () => {
    it('releases the late-resolving context instead of resurrecting it', async () => {
      FileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });

      let resolveInit;
      initLlama.mockImplementationOnce(
        () => new Promise((res) => { resolveInit = res; })
      );

      const loadPromise = loadModel();
      expect(getModelContextStatus().isLoading).toBe(true);

      // Unload synchronously mid-flight: the generation bump is captured before
      // initLlama is even invoked, so the late result must be released.
      await unloadModel();
      // Flush the microtask queue so the in-flight init reaches initLlama.
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));
      expect(initLlama).toHaveBeenCalledTimes(1);
      resolveInit({ completion: jest.fn(), release: jest.fn() });

      await expect(loadPromise).rejects.toThrow('cancelled');
      expect(getModelContextStatus()).toEqual({
        isLoaded: false,
        isLoading: false,
      });
      expect(releaseAllLlama).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Review fixes: W-2 inference errors release native memory
  // =========================================================================
  describe('Inference Error Native Release (W-2)', () => {
    it('failed inference releases native memory via unloadModel (no leaked handle)', async () => {
      FileSystem.getInfoAsync.mockResolvedValue({
        exists: true,
        size: MODEL_EXPECTED_SIZE,
      });
      initLlama.mockResolvedValueOnce({
        completion: jest.fn().mockRejectedValueOnce(new Error('native GGML failure')),
        release: jest.fn(),
      });

      const summary = await summarizeNote('# Launch Notes\nRelease v3.5 ships this week.');
      expect(releaseAllLlama).toHaveBeenCalled();
      expect(getModelContextStatus().isLoaded).toBe(false);
      expect(summary).toContain('• Launch Notes');
    });
  });

  // =========================================================================
  // Review fixes: W-6 numbered-list heuristic precision
  // =========================================================================
  describe('Numbered-List Heuristic Precision (W-6)', () => {
    it('requires an action verb for numbered items (no short-item fallback)', () => {
      const note = `1. Introduction\n2. Prerequisites\n3. References\n1. Buy milk tomorrow`;
      const tasks = extractTasksFromNoteHeuristic(note);
      expect(tasks).not.toContain('Introduction');
      expect(tasks).not.toContain('Prerequisites');
      expect(tasks).not.toContain('References');
      expect(tasks).toContain('Buy milk tomorrow');
    });
  });

  // =========================================================================
  // Review fixes: W-5 AppState subscription lifecycle
  // =========================================================================
  describe('AppState Subscription Lifecycle (W-5)', () => {
    it('subscribe/unsubscribe manage the lifecycle idempotently without throwing', () => {
      expect(() => {
        const first = subscribeAppState();
        const second = subscribeAppState();
        expect(second).toBe(first);
        unsubscribeAppState();
        unsubscribeAppState(); // safe when already unsubscribed
      }).not.toThrow();
    });
  });
});
