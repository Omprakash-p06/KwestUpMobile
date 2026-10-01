/**
 * KwestUp Mobile — On-Device AI Service
 * Manages llama.rn model lifecycle, context loading, and inference.
 * 
 * Uses: llama.rn (https://github.com/mybigday/llama.rn)
 * Model: Qwen2.5-0.5B-Instruct Q4_K_M GGUF (~468MB, runs offline)
 */

import { AppState } from "react-native";
import { initLlama, releaseAllLlama } from "llama.rn";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CryptoJS from "crypto-js";
import {
  getLocalMonthDayString,
  getLocalDateString,
  getTomorrowLocalDateString,
  parseLocalDate,
} from "./dateUtils";
import { logger } from "./logger";

// === Model Configuration & Cryptographic Integrity Constants ===
export const MODEL_FILENAME = "qwen2.5-0.5b-instruct-q4_k_m.gguf";
export const MODEL_PINNED_COMMIT = "9217f5db79a29953eb74d5343926648285ec7e67";
export const MODEL_EXPECTED_SHA256 = "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db";
export const MODEL_EXPECTED_SIZE = 491400032; // 491,400,032 bytes (~468.64 MB)
export const MODEL_DOWNLOAD_URL =
  `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/${MODEL_PINNED_COMMIT}/${MODEL_FILENAME}`;
export const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
export const MODEL_PATH = `${MODEL_DIR}${MODEL_FILENAME}`;
export const RESUMABLE_DOWNLOAD_KEY = "kwestup_ai_model_download_resumable";

// === Module-level context handle & concurrency lock ===
let _llamaContext = null;
let _initPromise = null;
let _idleTimer = null;
// Load generation: bumped on every unloadModel() so a late-resolving initLlama
// from a previous generation can be detected and released (see loadModel).
let _loadGeneration = 0;
let _appStateSubscription = null;
export const IDLE_UNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resets the idle timer. Unloads native model context after 5 minutes of inactivity.
 */
export const resetIdleTimer = () => {
  if (_idleTimer) {
    clearTimeout(_idleTimer);
  }
  _idleTimer = setTimeout(() => {
    unloadModel();
  }, IDLE_UNLOAD_TIMEOUT_MS);
  if (_idleTimer && typeof _idleTimer.unref === "function") {
    _idleTimer.unref();
  }
};

/**
 * Returns current model context status.
 */
export const getModelContextStatus = () => ({
  isLoaded: _llamaContext !== null,
  isLoading: _initPromise !== null,
});

/**
 * Handles AppState change to automatically unload native context when app is backgrounded or inactive.
 */
export const handleAppStateChange = (nextAppState) => {
  if (nextAppState === "background" || nextAppState === "inactive") {
    unloadModel();
  }
};

/**
 * Subscribes to AppState changes to auto-unload the native context when the app
 * is backgrounded or inactive. Idempotent — returns the existing subscription
 * when already subscribed. Returns null when AppState is unavailable.
 * Prefer calling this from the app root component's `useEffect` (see App.js);
 * the module-load auto-register below is the fallback for other importers.
 *
 * @returns {{remove: function}|null} the AppState subscription (or null)
 */
export const subscribeAppState = () => {
  if (_appStateSubscription) {
    return _appStateSubscription;
  }
  if (typeof AppState !== "undefined" && typeof AppState.addEventListener === "function") {
    _appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
  }
  return _appStateSubscription;
};

/**
 * Removes the AppState subscription created by {@link subscribeAppState}.
 * Safe to call when not subscribed.
 */
export const unsubscribeAppState = () => {
  if (_appStateSubscription) {
    try {
      if (typeof _appStateSubscription.remove === "function") {
        _appStateSubscription.remove();
      }
    } catch (e) {
      logger.warn("Error removing AppState subscription:", e);
    }
    _appStateSubscription = null;
  }
};

// Automatically unload native context when app is backgrounded or inactive to free memory.
// Fallback auto-register for importers outside the app root; App.js also subscribes
// explicitly (deduped by subscribeAppState).
subscribeAppState();

/**
 * Computes SHA-256 hash of a string or WordArray using crypto-js.
 * String-hashing helper only — it cannot hash the on-device GGUF file.
 * Use {@link hashFileSha256} for model-file integrity verification.
 * @param {string|CryptoJS.lib.WordArray} data
 * @returns {string} hex-encoded SHA-256 string ("" for unsupported input)
 */
export const computeSha256 = (data) => {
  if (typeof data !== "string" && !data?.sigBytes) {
    return "";
  }
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
};

/**
 * Decoded bytes per read window when streaming the model file through the
 * incremental SHA-256 hasher. 8 MB keeps each base64 window (~10.7 MB string)
 * small enough to avoid JS-heap pressure on mid-range devices.
 */
export const MODEL_HASH_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * Streams a file from device storage through an incremental SHA-256 hasher
 * without loading the whole file into memory.
 *
 * Uses `FileSystem.readAsStringAsync` with `{ encoding: Base64, position, length }`
 * (supported by expo-file-system ~18.x) to read fixed-size base64 windows,
 * decoding each window via `CryptoJS.enc.Base64.parse` and feeding the
 * resulting WordArray into `CryptoJS.algo.SHA256.create()`.
 *
 * @param {string} filePath - Path to the file to hash
 * @param {number} chunkBytes - Decoded bytes per read window
 * @returns {Promise<string>} hex-encoded SHA-256 digest of the file content
 * @throws if any chunk read fails
 */
export const hashFileSha256 = async (filePath, chunkBytes = MODEL_HASH_CHUNK_BYTES) => {
  const encoding = FileSystem.EncodingType?.Base64 ?? "base64";
  const hasher = CryptoJS.algo.SHA256.create();
  let position = 0;

  for (;;) {
    const chunk = await FileSystem.readAsStringAsync(filePath, {
      encoding,
      position,
      length: chunkBytes,
    });
    if (!chunk || chunk.length === 0) {
      break;
    }
    const words = CryptoJS.enc.Base64.parse(chunk);
    if (words.sigBytes === 0) {
      break;
    }
    const prevPosition = position;
    position += words.sigBytes;
    hasher.update(words);
    // Short window (or no forward progress) means EOF — finalize.
    if (words.sigBytes < chunkBytes || position <= prevPosition) {
      break;
    }
  }

  return hasher.finalize().toString(CryptoJS.enc.Hex);
};

/**
 * Default model-file hash validator. Streams the GGUF through {@link hashFileSha256}
 * and compares the digest against the pinned `MODEL_EXPECTED_SHA256`.
 * Fail-closed: any read error propagates so the caller treats the file as untrusted.
 *
 * @param {string} filePath - Path to the GGUF file
 * @returns {Promise<boolean>} true only when the digest matches the pinned constant
 */
export const defaultFileHashValidator = async (filePath = MODEL_PATH) => {
  const actual = await hashFileSha256(filePath);
  return actual.toLowerCase() === MODEL_EXPECTED_SHA256.toLowerCase();
};

/**
 * Verifies model presence and integrity against expected size and SHA-256 hash.
 * Automatically deletes corrupted or partial model files from the device filesystem.
 *
 * @param {string} filePath - Path to the GGUF file
 * @param {function|null|undefined} customValidator - Hash validator callback.
 *   Defaults to {@link defaultFileHashValidator} (chunked SHA-256 compared against
 *   `MODEL_EXPECTED_SHA256`). Pass an explicit `null` for the fast size-only path —
 *   used by `isModelDownloaded` to avoid re-streaming ~468 MB through the hasher on
 *   every inference entry; full hash verification runs at download time in `downloadModel`.
 * @returns {Promise<boolean>}
 */
export const verifyModelIntegrity = async (filePath = MODEL_PATH, customValidator = undefined) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      return false;
    }

    // 1. Exact byte size check
    if (fileInfo.size !== MODEL_EXPECTED_SIZE) {
      logger.warn(
        `Model file size mismatch: expected ${MODEL_EXPECTED_SIZE} bytes, but got ${fileInfo.size} bytes. Deleting corrupted model.`
      );
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      return false;
    }

    // 2. Cryptographic checksum validation (default: chunked SHA-256 vs pinned constant).
    // Pass explicit `null` to opt into the fast size-only path.
    const validator =
      customValidator === null
        ? null
        : typeof customValidator === "function"
          ? customValidator
          : defaultFileHashValidator;
    if (validator) {
      let isValidHash = false;
      try {
        isValidHash = await validator(filePath);
      } catch (hashErr) {
        // Fail-closed: a validator that throws (HSM offline, I/O error) is
        // treated as a mismatch, never as a pass.
        logger.warn("Model hash verification errored; treating as mismatch:", hashErr?.message);
        isValidHash = false;
      }
      if (!isValidHash) {
        logger.warn(`Model checksum mismatch against ${MODEL_EXPECTED_SHA256}. Deleting corrupted model.`);
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        return false;
      }
    }

    return true;
  } catch (err) {
    logger.error("Error verifying model integrity:", err);
    return false;
  }
};

/**
 * Returns true if the GGUF model file is cached on device and passes integrity verification.
 * Fast path (exact size + pinned-URL provenance): full SHA-256 verification runs at
 * download time in `downloadModel` — re-streaming ~468 MB through the hasher on every
 * inference entry would stall the UI for tens of seconds.
 */
export const isModelDownloaded = async () => {
  return await verifyModelIntegrity(MODEL_PATH, null);
};

/**
 * Downloads the Qwen2.5-0.5B-Instruct GGUF model file with progress callbacks.
 * Includes resumable support and retry logic for network instability.
 * @param {function} onProgress - called with { progress: 0–1, bytesReceived, totalBytes }
 */
export const downloadModel = async (onProgress) => {
  // Ensure models directory exists
  const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }

  const MAX_RETRIES = 10; // Increased from 3 to 10 for NothingOS background stability
  let attempt = 0;

  const performDownload = async () => {
    let downloadResumable;
    const savedState = await AsyncStorage.getItem(RESUMABLE_DOWNLOAD_KEY);

    const progressCallback = (downloadProgress) => {
      const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
      if (totalBytesExpectedToWrite > 0 && onProgress) {
        onProgress({
          progress: totalBytesWritten / totalBytesExpectedToWrite,
          bytesReceived: totalBytesWritten,
          totalBytes: totalBytesExpectedToWrite,
        });
      }
    };

    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        // Resume only state that targets the currently pinned model. A stale
        // URL/fileUri persisted by an older (or downgraded) app version must
        // never be resumed and trusted — discard it and start fresh.
        const isPinnedResume =
          parsedState.url === MODEL_DOWNLOAD_URL && parsedState.fileUri === MODEL_PATH;
        if (!isPinnedResume) {
          logger.warn(
            "Discarding stale download resume state (URL/file mismatch — expected pinned model). Starting fresh."
          );
          await AsyncStorage.removeItem(RESUMABLE_DOWNLOAD_KEY);
        } else {
          downloadResumable = new FileSystem.DownloadResumable(
            parsedState.url,
            parsedState.fileUri,
            parsedState.options,
            progressCallback,
            parsedState.resumeData
          );
          logger.info("🔄 Resuming AI model download...");
        }
      } catch (e) {
        logger.warn("Failed to parse saved download state, starting fresh:", e);
      }
    }

    if (!downloadResumable) {
      downloadResumable = FileSystem.createDownloadResumable(
        MODEL_DOWNLOAD_URL,
        MODEL_PATH,
        {},
        progressCallback
      );
    }

    try {
      const result = await downloadResumable.downloadAsync();
      if (!result || !result.uri) {
        throw new Error("Model download failed — no URI returned.");
      }
      // Post-download integrity gate (default chunked SHA-256 + exact size).
      // A truncated or substituted file is deleted here, never trusted.
      const integrityOk = await verifyModelIntegrity(MODEL_PATH);
      if (!integrityOk) {
        throw new Error(
          "Downloaded model failed integrity verification (size/SHA-256 mismatch). Corrupt file deleted; retry to re-download."
        );
      }
      // Success! Clear resume state
      await AsyncStorage.removeItem(RESUMABLE_DOWNLOAD_KEY);
      return result.uri;
    } catch (err) {
      // Save state for next time
      if (downloadResumable.savable()) {
        const state = JSON.stringify(downloadResumable.savable());
        await AsyncStorage.setItem(RESUMABLE_DOWNLOAD_KEY, state);
      }
      throw err;
    }
  };

  while (attempt < MAX_RETRIES) {
    try {
      return await performDownload();
    } catch (err) {
      attempt++;
      const errMsg = err.message || "";
      logger.warn("Download attempt %d failed:", attempt, errMsg);
      
      const isNetworkError = 
        errMsg.includes("ENOTFOUND") || 
        errMsg.includes("ERR_NAME_NOT_RESOLVED") ||
        errMsg.includes("CONNECTION_UNAVAILABLE") ||
        errMsg.includes("Network request failed") ||
        errMsg.includes("timeout") ||
        errMsg.includes("abort") ||
        errMsg.includes("MNSSecureTCP") || // NothingOS specific DGW errors
        errMsg.includes("StreamGroup");

      if (attempt >= MAX_RETRIES) {
        if (isNetworkError) {
          throw new Error("Network error: The connection timed out or was aborted by the system after 10 attempts. Please ensure your Wi-Fi is stable and try again. The download will resume from where it left off.");
        }
        throw err;
      }

      // Wait before retry with exponential backoff + jitter (1s, 2s, 4s... + random offset)
      const baseDelay = 1000 * Math.pow(2, Math.min(attempt - 1, 5)); // cap at 32s
      const jitter = Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
    }
  }
};

/**
 * Loads the GGUF model into a llama.rn inference context.
 * Uses a coalescing Promise lock to prevent multiple concurrent initializations.
 * Throws if model file is not downloaded or integrity verification fails.
 */
export const loadModel = async () => {
  resetIdleTimer();

  // 1. If already loaded, return it
  if (_llamaContext) {
    return _llamaContext;
  }

  // 2. Mutex check: coalesce concurrent callers onto the in-flight initialization promise
  if (_initPromise) {
    return _initPromise;
  }

  _initPromise = (async () => {
    // Capture the generation: if unloadModel() runs while initLlama is in
    // flight, the generation bumps and the late result must be released.
    const loadGeneration = _loadGeneration;
    try {
      const isValid = await isModelDownloaded();
      if (!isValid) {
        throw new Error("Model not downloaded or corrupted. Please download the AI model first.");
      }

      const freshContext = await initLlama({
        model: MODEL_PATH,
        use_mlock: false,
        n_ctx: 2048,          // stable 2048 prevents OOM native crashes on standard hardware
        n_threads: 2,         // reduced from 4 to 2 for better stability on mid-range Android devices
        n_gpu_layers: 0,      // CPU-only
        no_gpu_devices: true, // skip GPU device probing to avoid Unknown error on Android
      });

      // Unload-while-inflight race: the lifecycle manager freed the slot while
      // we were initializing — release the just-created native context instead
      // of silently resurrecting it, and reject so callers fall back cleanly.
      if (loadGeneration !== _loadGeneration) {
        try {
          await releaseAllLlama();
        } catch (releaseErr) {
          logger.warn("Error releasing superseded llama context:", releaseErr);
        }
        _llamaContext = null;
        throw new Error("Model load was cancelled (unload requested during initialization).");
      }

      _llamaContext = freshContext;
      return _llamaContext;
    } catch (err) {
      _llamaContext = null;
      const msg = err?.message || "Failed to initialize native model context";

      if (msg.includes("out of memory") || msg.includes("OOM")) {
        throw new Error("Device ran out of memory while loading the AI model. Try closing other apps.");
      }

      throw new Error(`Model initialization failed: ${msg}`);
    } finally {
      _initPromise = null;
    }
  })();

  return _initPromise;
};

/**
 * Releases the loaded model context to free device memory.
 * Bumps the load generation so any in-flight `initLlama` result is released
 * on arrival instead of resurrecting the context (unload-while-inflight race).
 */
export const unloadModel = async () => {
  _loadGeneration++;
  if (_idleTimer) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
  if (_llamaContext) {
    try {
      await releaseAllLlama();
    } catch (e) {
      logger.warn("Error releasing llama context:", e);
    }
    _llamaContext = null;
  }
};

/**
 * Rule-based heuristic task extractor from markdown text.
 * Runs offline with zero memory overhead when LLM is unavailable.
 * 
 * @param {string} noteContent
 * @returns {string[]} array of extracted task strings
 */
export const extractTasksFromNoteHeuristic = (noteContent) => {
  if (!noteContent || typeof noteContent !== "string") return [];

  const lines = noteContent.split("\n");
  const extracted = [];
  const seen = new Set();

  const addUnique = (task) => {
    const cleaned = task.trim().replace(/^[-*•]\s*/, "").replace(/[.]+$/, "");
    if (cleaned.length > 2 && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      extracted.push(cleaned);
    }
  };

  const actionVerbRegex =
    /^(?:Buy|Call|Send|Check|Review|Fix|Update|Create|Email|Prepare|Submit|Meet|Finish|Pay|Read|Write|Organize|Clean|Schedule|Order|Pick up|Deliver|Ship|Print|Cancel|Follow up|Contact)\b/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 1. Markdown checklist items: - [ ] Task or - [x] Task or * [ ] Task
    const checklistMatch = line.match(/^[-*+]\s*\[[\sXx]?\]\s*(.+)$/);
    if (checklistMatch && checklistMatch[1]) {
      addUnique(checklistMatch[1]);
      continue;
    }

    // 2. Explicit TODO / ACTION tags: TODO: Task, Action: Task
    const todoMatch = line.match(/^(?:TODO|Todo|FIXME|Action|Task):\s*(.+)$/i);
    if (todoMatch && todoMatch[1]) {
      addUnique(todoMatch[1]);
      continue;
    }

    // 3. Bullet points with action verbs: - Buy milk, * Call plumber
    const bulletMatch = line.match(/^[-*+•]\s+(.+)$/);
    if (bulletMatch && bulletMatch[1]) {
      const itemText = bulletMatch[1].trim();
      if (actionVerbRegex.test(itemText)) {
        addUnique(itemText);
        continue;
      }
    }

    // 4. Numbered list items with action verbs: 1. Buy milk, 2. Call doctor.
    // The verb match is required — plain short items like "1. Introduction"
    // are headings, not tasks (same precision rule as the bullet branch).
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (numberedMatch && numberedMatch[1]) {
      const itemText = numberedMatch[1].trim();
      if (actionVerbRegex.test(itemText)) {
        addUnique(itemText);
        continue;
      }
    }
  }

  return extracted;
};

/**
 * Rule-based heuristic summarizer for markdown notes.
 * Extracts title, major headings, and leading sentences when LLM is unavailable.
 * 
 * @param {string} noteContent
 * @returns {string} bullet-point summary
 */
export const summarizeNoteHeuristic = (noteContent) => {
  if (!noteContent || typeof noteContent !== "string" || !noteContent.trim()) {
    return "• Empty note";
  }

  const lines = noteContent.split("\n");
  const bullets = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 1. Markdown headings (# Heading, ## Subheading)
    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch && headingMatch[1]) {
      bullets.push(`• ${headingMatch[1].trim()}`);
      continue;
    }

    // 2. Important bold lead-in: **Important:** ...
    const boldMatch = line.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/);
    if (boldMatch) {
      const topic = boldMatch[1].trim();
      const rest = boldMatch[2] ? ` - ${boldMatch[2].trim()}` : "";
      bullets.push(`• ${topic}${rest}`);
      continue;
    }

    // 3. Checklist items
    const checkMatch = line.match(/^[-*+]\s*\[[\sXx]?\]\s*(.+)$/);
    if (checkMatch && checkMatch[1]) {
      bullets.push(`• Task: ${checkMatch[1].trim()}`);
      continue;
    }
  }

  // If no structured headers/checklists found, take first sentence of first few paragraphs
  if (bullets.length === 0) {
    const paragraphs = noteContent.split(/\n\s*\n/);
    for (const p of paragraphs) {
      const trimmed = p.trim().replace(/^[-*•#\s]+/, "");
      if (trimmed.length > 0) {
        const firstSentence = trimmed.split(/[.?!]/)[0];
        if (firstSentence && firstSentence.trim().length > 3) {
          bullets.push(`• ${firstSentence.trim()}`);
        }
      }
      if (bullets.length >= 5) break;
    }
  }

  return bullets.length > 0 ? bullets.slice(0, 7).join("\n") : "• Key points from note";
};

/**
 * Summarizes the given markdown note text using the on-device LLM.
 * Automatically falls back to heuristic extraction if the model is not ready or inference fails.
 * 
 * @param {string} noteContent - raw markdown content of the note
 * @param {function} onToken - streaming callback for each generated token
 */
export const summarizeNote = async (noteContent, onToken) => {
  resetIdleTimer();

  try {
    const ctx = await loadModel();

    // ~4 chars per token; budget: 2048 context - 256 output - ~150 prompt = ~1642 tokens input (~6500 chars)
    const MAX_INPUT_CHARS = 6000;
    const clampedContent = (noteContent || "").slice(0, MAX_INPUT_CHARS);

    const prompt = `<|im_start|>system
You are a concise note summarizer. Given a markdown note, output ONLY a bullet-point summary of the key ideas. No preamble, no explanation — just bullet points.
<|im_end|>
<|im_start|>user
Summarize this note:

${clampedContent}
<|im_end|>
<|im_start|>assistant
`;

    let fullText = "";

    await ctx.completion(
      {
        prompt,
        n_predict: 512,
        temperature: 0.3,
        top_p: 0.9,
        stop: ["<|im_end|>", "<|im_start|>"],
      },
      (data) => {
        if (data.token) {
          fullText += data.token;
          if (onToken) onToken(data.token);
        }
      }
    );

    if (fullText.trim().length > 0) {
      return fullText.trim();
    }
  } catch (err) {
    // Release native memory via the lifecycle manager (never just null the JS handle).
    await unloadModel();
    logger.warn("LLM summarization failed or model unavailable, falling back to heuristics:", err?.message);
  }

  // Fallback to pure rule-based heuristic summarization
  const fallbackSummary = summarizeNoteHeuristic(noteContent);
  if (onToken) onToken(fallbackSummary);
  return fallbackSummary;
};

/**
 * Extracts actionable tasks from the given markdown note text.
 * Automatically falls back to heuristic extraction if the model is not ready or inference fails.
 * 
 * @param {string} noteContent - raw markdown content of the note
 */
export const extractTasksFromNote = async (noteContent) => {
  resetIdleTimer();

  try {
    const ctx = await loadModel();

    // ~4 chars per token; budget: 2048 context - 192 output - ~150 prompt = ~1706 tokens input (~6800 chars)
    const MAX_INPUT_CHARS = 6000;
    const clampedContent = (noteContent || "").slice(0, MAX_INPUT_CHARS);

    const prompt = `<|im_start|>system
You are a task extractor. Given a markdown note, identify ALL actionable items, to-dos, or things that need to be done. Return ONLY a JSON array of short task title strings. Example: ["Buy groceries", "Call the dentist"]. No explanation.
<|im_end|>
<|im_start|>user
Extract tasks from this note:

${clampedContent}
<|im_end|>
<|im_start|>assistant
[`;

    let rawOutput = "[";

    await ctx.completion(
      {
        prompt,
        n_predict: 256,
        temperature: 0.1,
        top_p: 0.9,
        stop: ["]", "<|im_end|>", "<|im_start|>"],
      },
      (data) => {
        if (data.token) {
          rawOutput += data.token;
        }
      }
    );

    // Complete the JSON array
    rawOutput = rawOutput.trim();
    if (!rawOutput.endsWith("]")) rawOutput += "]";

    try {
      const parsed = JSON.parse(rawOutput);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((t) => typeof t === "string" && t.trim().length > 0);
      }
    } catch {
      // Fallback: extract quoted strings
      const matches = rawOutput.match(/"([^"]+)"/g) || [];
      const extracted = matches.map((m) => m.replace(/"/g, "").trim()).filter(Boolean);
      if (extracted.length > 0) return extracted;
    }
  } catch (err) {
    // Release native memory via the lifecycle manager (never just null the JS handle).
    await unloadModel();
    logger.warn("LLM task extraction failed or model unavailable, falling back to heuristics:", err?.message);
  }

  // Fallback to pure rule-based heuristic extraction
  return extractTasksFromNoteHeuristic(noteContent);
};

/**
 * Parses a global natural language command (e.g. "Buy milk tomorrow") into a structured task or birthday.
 * Uses the local offline LLM with robust regex fallback.
 * 
 * @param {string} command - the user's natural language request
 */
export const parseGlobalCommand = async (command) => {
  // Input guard (mirrors sibling-heuristic style): null/non-string input must
  // never reach the String.prototype calls in the keyword fallback below.
  if (!command || typeof command !== "string") {
    return {
      type: "task",
      title: "New Task",
      description: `Created via KwestUp AI Assistant from prompt: "${String(command)}"`,
      dueDate: null,
    };
  }
  resetIdleTimer();

  const todayStr = getLocalDateString();
  let rawOutput = "{";

  try {
    const ctx = await loadModel();

    const prompt = `<|im_start|>system
You are a command parser for KwestUp productivity app. You parse user natural language requests to create tasks or birthdays.
Today's date is ${todayStr}.
You MUST output ONLY a valid JSON object matching one of these formats:
1. For tasks: {"type": "task", "title": "Task title", "description": "Optional description", "dueDate": "YYYY-MM-DDTHH:mm:ss.sssZ" (optional)}
2. For birthdays: {"type": "birthday", "name": "Person's name", "date": "YYYY-MM-DD" or "MM-DD"}
3. For billing transactions: {"type": "transaction", "transactionType": "expense" or "income", "amount": Number, "description": "Transaction description", "category": "Food" or "Transport" or "Housing" or "Health" or "Salary" or "Other"}

No explanation, no other text — only the JSON object.
<|im_end|>
<|im_start|>user
Parse this command: "${command}"
<|im_end|>
<|im_start|>assistant
{`;

    await ctx.completion(
      {
        prompt,
        n_predict: 256,
        temperature: 0.1,
        top_p: 0.9,
        stop: ["}", "<|im_end|>", "<|im_start|>"],
      },
      (data) => {
        if (data.token) {
          rawOutput += data.token;
        }
      }
    );
  } catch (err) {
    // Release native memory via the lifecycle manager (never just null the JS handle).
    await unloadModel();
    // Fall through to keyword-based fallback below
    logger.warn("LLM parsing failed or model unavailable, falling back to keyword extraction:", err?.message);
  }

  rawOutput = rawOutput.trim();
  if (!rawOutput.endsWith("}")) rawOutput += "}";

  try {
    const parsed = JSON.parse(rawOutput);
    if (parsed.type) {
      return parsed;
    }
  } catch (err) {
    logger.error("Failed to parse AI command JSON:", rawOutput, err);
  }

  // Robust fallback parsing using regex/keywords if GGUF returns invalid JSON or wrong format
  const lower = command.toLowerCase();

  const expenseKeywords = ["spent", "spend", "bought", "cost", "expense", "paid"];
  const incomeKeywords = ["earned", "salary", "income", "received", "bonus"];
  const matchesExpense = expenseKeywords.some(kw => lower.includes(kw));
  const matchesIncome = incomeKeywords.some(kw => lower.includes(kw));

  if (matchesExpense || matchesIncome) {
    const transactionType = matchesIncome ? "income" : "expense";
    const amtMatch = command.match(/\d+(\.\d+)?/);
    const amount = amtMatch ? parseFloat(amtMatch[0]) : 0;
    let category = "Other";
    if (lower.includes("food") || lower.includes("eat") || lower.includes("dinner") || lower.includes("lunch") || lower.includes("grocer")) category = "Food";
    else if (lower.includes("car") || lower.includes("bus") || lower.includes("cab") || lower.includes("taxi") || lower.includes("uber") || lower.includes("transport")) category = "Transport";
    else if (lower.includes("rent") || lower.includes("room") || lower.includes("flat") || lower.includes("house") || lower.includes("housing")) category = "Housing";
    else if (lower.includes("doctor") || lower.includes("medicine") || lower.includes("hospital") || lower.includes("health") || lower.includes("gym")) category = "Health";
    else if (lower.includes("salary") || lower.includes("job") || lower.includes("work")) category = "Salary";

    let description = command.replace(/\d+(\.\d+)?/g, "").replace(/(spent|spend|bought|cost|expense|paid|earned|salary|income|received|bonus|on|for|rs|rupees|dollars|\$)/gi, "").trim();
    description = description.replace(/\s+/g, " ");
    return {
      type: "transaction",
      transactionType,
      amount,
      category,
      description: description || (transactionType === "income" ? "Income" : "Expense")
    };
  }

  if (lower.includes("birthday") || lower.includes("born") || lower.includes("bday")) {
    // Extract a name: e.g. "Mom's birthday on Oct 10" -> "Mom's birthday" or "Mom"
    let name = command;
    let dateStr = getLocalMonthDayString(); // default MM-DD

    // Try finding date like "Oct 10", "10-15", etc.
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    for (let i = 0; i < 12; i++) {
      if (lower.includes(monthNames[i])) {
        const monthNum = (i + 1).toString().padStart(2, "0");
        const match = lower.match(new RegExp(`${monthNames[i]}\\s*(\\d+)`));
        if (match) {
          dateStr = `${monthNum}-${match[1].padStart(2, "0")}`;
          name = name.replace(new RegExp(`${monthNames[i]}\\s*\\d+`, "gi"), "");
        }
        break;
      }
    }

    // Clean name: e.g. remove "add ", "create ", "birthday ", "bday "
    name = name.replace(/\b(add|create|birthday|bday|on|for|is|of)\b/gi, "").replace(/\s+/g, " ").trim();
    return {
      type: "birthday",
      name: name || "Someone's Birthday",
      date: dateStr
    };
  } else {
    // Treat as task
    let title = command.replace(/(add|create|task|todo)\s*/gi, "").trim();
    let dueDate = null;
    
    if (lower.includes("tomorrow")) {
      const tomorrowStr = getTomorrowLocalDateString();
      const tomorrow = parseLocalDate(tomorrowStr);
      // parseLocalDate is strict and yields Invalid Date on bad input —
      // never let toISOString() throw RangeError outside the LLM try/catch.
      if (isNaN(tomorrow.getTime())) {
        dueDate = null;
      } else {
        tomorrow.setHours(9, 0, 0, 0); // default to 9 AM tomorrow
        dueDate = tomorrow.toISOString();
      }
      title = title.replace(/tomorrow/gi, "").trim();
    } else if (lower.includes("today")) {
      const todayStr = getLocalDateString();
      const todayDate = parseLocalDate(todayStr);
      if (isNaN(todayDate.getTime())) {
        dueDate = null;
      } else {
        todayDate.setHours(17, 0, 0, 0); // default to 5 PM today
        dueDate = todayDate.toISOString();
      }
      title = title.replace(/today/gi, "").trim();
    }

    return {
      type: "task",
      title: title || "New Task",
      description: `Created via KwestUp AI Assistant from prompt: "${command}"`,
      dueDate
    };
  }
};

/**
 * auto-save Writing Assistant using on-device Qwen model.
 * Directly edits/improves the given markdown note content based on commandType.
 * 
 * @param {string} noteContent - raw note content
 * @param {string} commandType - "improve" | "grammar" | "longer" | "shorter" | "professional" | "casual"
 * @param {function} onToken - streaming callback
 */
export const assistWriting = async (noteContent, commandType, onToken) => {
  resetIdleTimer();
  const ctx = await loadModel();

  let systemPrompt = "";
  switch (commandType) {
    case "improve":
      systemPrompt = "You are a professional editor. Improve the writing style, flow, and word choice of the following text while preserving its exact meaning. Output ONLY the improved text in proper markdown format, no preamble or surrounding quotes.";
      break;
    case "grammar":
      systemPrompt = "You are a grammar and spelling checker. Correct all spelling, grammar, punctuation, and typos in the following text. Output ONLY the corrected text in proper markdown format, no preamble or surrounding quotes.";
      break;
    case "longer":
      systemPrompt = "You are a creative writer. Expand and elaborate on the following text by adding more descriptive detail, explanations, and depth, while maintaining the original message. Output ONLY the expanded text in proper markdown format, no preamble or surrounding quotes.";
      break;
    case "shorter":
      systemPrompt = "You are a concise editor. Condense, trim, and simplify the following text to make it extremely clear, tight, and short. Output ONLY the condensed text in proper markdown format, no preamble or surrounding quotes.";
      break;
    case "professional":
      systemPrompt = "You are a corporate communications writer. Rewrite the following text in a professional, polite, formal, and business-appropriate tone. Output ONLY the rewritten text in proper markdown format, no preamble or surrounding quotes.";
      break;
    case "casual":
      systemPrompt = "You are a friendly, warm writer. Rewrite the following text in an informal, engaging, warm, and casual tone. Output ONLY the rewritten text in proper markdown format, no preamble or surrounding quotes.";
      break;
    case "improvise":
      systemPrompt = "You are a professional content designer and markdown typographer. Given raw note text, improvise and reorganize it into a beautifully formatted markdown document. Use clear, nested headers (##, ###), bullet lists, bold text for key terms, blockquotes for important callouts, and clean spacing. Keep all the original information intact but make it look incredibly structured, polished, and professional. Output ONLY the beautifully formatted markdown, no preamble or surrounding quotes.";
      break;
    default:
      systemPrompt = "Improve the following text. Output ONLY the improved text in proper markdown format, no preamble.";
  }

  // Budget: 2048 total - 512 reserved for response - ~250 for system+user template = ~1286 tokens for input
  // At ~4 chars/token, that's ~5144 chars. Clamp at 5000 to remain robust against memory issues.
  const MAX_INPUT_CHARS = 5000;
  const clampedContent = (typeof noteContent === "string" ? noteContent : "").slice(0, MAX_INPUT_CHARS);

  const prompt = `<|im_start|>system
${systemPrompt}
<|im_end|>
<|im_start|>user
Text to process:
${clampedContent}
<|im_end|>
<|im_start|>assistant
`;

  let fullText = "";

  try {
    await ctx.completion(
      {
        prompt,
        n_predict: 1024,
        temperature: 0.2,
        top_p: 0.9,
        stop: ["<|im_end|>", "<|im_start|>"],
      },
      (data) => {
        if (data.token) {
          fullText += data.token;
          if (onToken) onToken(data.token);
        }
      }
    );
  } catch (err) {
    // Release native memory via the lifecycle manager so next call re-initialises cleanly
    await unloadModel();
    const msg = err?.message || "Native inference error";
    // Provide a user-readable error instead of raw "Unknown error"
    if (msg === "Unknown error" || msg.includes("GGML") || msg.includes("llama")) {
      throw new Error("The AI model encountered an error. Please close and reopen the AI assistant, then try again.");
    }
    throw new Error(msg);
  }

  return fullText.trim();
};

/**
 * Custom prompt-based Writing Assistant using on-device Qwen model.
 * Performs user-defined instruction on the given note content.
 * 
 * @param {string} noteContent - raw note content
 * @param {string} userInstruction - custom action requested by the user
 * @param {function} onToken - streaming callback
 */
export const assistWritingCustom = async (noteContent, userInstruction, onToken) => {
  resetIdleTimer();
  const ctx = await loadModel();

  const systemPrompt = `You are a helpful writing assistant. You must perform the following instruction on the provided text: "${userInstruction}". Follow the instruction precisely.

CRITICAL DESIGN & INTERACTIVE GUIDELINES:
1. ALWAYS OUTPUT MARKDOWN: Every output MUST be valid markdown format. Use headers (##, ###), bullet lists, bold, and other markdown elements to structure the response beautifully.
2. CLICKABLE CHECKLIST FORMATTING: If the instruction contains ANY of the words "task", "todo", "checklist", "action items", "to-do", or implies creating actionable items, you MUST format each task strictly as a standard markdown checklist item: '- [ ] Task description'.
   - Ensure there is exactly one space between '-' and '[ ]', and exactly one space after '[ ]'.
   - Format: '- [ ] Eat healthy food'
   - Never output checked checkboxes like '- [x]' or '- [X]'. All generated tasks must start as unchecked: '- [ ]'.
   - Keep task descriptions concise, action-oriented, clear, and professional.
   - Output each checklist item on a completely new, separate line.
3. HEADER STRUCTURE: Group tasks or sections logically using standard markdown headers ('##', '###') to provide a clear, professional hierarchy.
4. CONCISE WRITING: Avoid wordiness. Keep the tone professional, objective, and direct.
5. EMOJI PURGE: Under no circumstances should you output emojis (e.g., no ✅, ✨, 📝, 🚀). Use clean, professional text formatting.
6. NO CHAT PREAMBLE: Output ONLY the final processed or modified text in markdown. Do NOT include any chatty preambles, intros, explanations, out-of-character remarks, or surrounding quotes. Start directly with the formatted markdown content.`;

  // Budget: 2048 total - 512 reserved for response - ~250 for system+user template = ~1286 tokens for input
  const MAX_INPUT_CHARS = 5000;
  const clampedContent = (typeof noteContent === "string" ? noteContent : "").slice(0, MAX_INPUT_CHARS);

  const prompt = `<|im_start|>system
${systemPrompt}
<|im_end|>
<|im_start|>user
Text to process:
${clampedContent}
<|im_end|>
<|im_start|>assistant
`;

  let fullText = "";

  try {
    await ctx.completion(
      {
        prompt,
        n_predict: 1024,
        temperature: 0.3,
        top_p: 0.9,
        stop: ["<|im_end|>", "<|im_start|>"],
      },
      (data) => {
        if (data.token) {
          fullText += data.token;
          if (onToken) onToken(data.token);
        }
      }
    );
  } catch (err) {
    // Release native memory via the lifecycle manager so next call re-initialises cleanly
    await unloadModel();
    const msg = err?.message || "Native inference error";
    if (msg === "Unknown error" || msg.includes("GGML") || msg.includes("llama")) {
      throw new Error("The AI model encountered an error. Please close and reopen the AI assistant, then try again.");
    }
    throw new Error(msg);
  }

  return fullText.trim();
};
