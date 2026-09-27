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

// Automatically unload native context when app is backgrounded or inactive to free memory
if (typeof AppState !== "undefined" && typeof AppState.addEventListener === "function") {
  AppState.addEventListener("change", handleAppStateChange);
}

/**
 * Computes SHA-256 hash of a string or WordArray using crypto-js.
 * @param {string|CryptoJS.lib.WordArray} data
 * @returns {string} hex-encoded SHA-256 string
 */
export const computeSha256 = (data) => {
  if (typeof data !== "string" && !data?.sigBytes) {
    return "";
  }
  return CryptoJS.SHA256(data).toString(CryptoJS.enc.Hex);
};

/**
 * Verifies model presence and integrity against expected size and optional hash.
 * Automatically deletes corrupted or partial model files from the device filesystem.
 * 
 * @param {string} filePath - Path to the GGUF file
 * @param {function|null} customValidator - Optional custom validator callback for hash validation
 * @returns {Promise<boolean>}
 */
export const verifyModelIntegrity = async (filePath = MODEL_PATH, customValidator = null) => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      return false;
    }

    // 1. Exact byte size check
    if (fileInfo.size !== MODEL_EXPECTED_SIZE) {
      console.warn(
        `Model file size mismatch: expected ${MODEL_EXPECTED_SIZE} bytes, but got ${fileInfo.size} bytes. Deleting corrupted model.`
      );
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      return false;
    }

    // 2. Optional cryptographic checksum validator
    if (typeof customValidator === "function") {
      const isValidHash = await customValidator(filePath);
      if (!isValidHash) {
        console.warn(`Model checksum mismatch against ${MODEL_EXPECTED_SHA256}. Deleting corrupted model.`);
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        return false;
      }
    }

    return true;
  } catch (err) {
    console.error("Error verifying model integrity:", err);
    return false;
  }
};

/**
 * Returns true if the GGUF model file is cached on device and passes integrity verification.
 */
export const isModelDownloaded = async () => {
  return await verifyModelIntegrity(MODEL_PATH);
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
        downloadResumable = new FileSystem.DownloadResumable(
          parsedState.url,
          parsedState.fileUri,
          parsedState.options,
          progressCallback,
          parsedState.resumeData
        );
        console.log("🔄 Resuming AI model download...");
      } catch (e) {
        console.warn("Failed to parse saved download state, starting fresh:", e);
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
      console.warn("Download attempt %d failed:", attempt, errMsg);
      
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
    try {
      const isValid = await isModelDownloaded();
      if (!isValid) {
        throw new Error("Model not downloaded or corrupted. Please download the AI model first.");
      }

      _llamaContext = await initLlama({
        model: MODEL_PATH,
        use_mlock: false,
        n_ctx: 2048,          // stable 2048 prevents OOM native crashes on standard hardware
        n_threads: 2,         // reduced from 4 to 2 for better stability on mid-range Android devices
        n_gpu_layers: 0,      // CPU-only
        no_gpu_devices: true, // skip GPU device probing to avoid Unknown error on Android
      });
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
 */
export const unloadModel = async () => {
  if (_idleTimer) {
    clearTimeout(_idleTimer);
    _idleTimer = null;
  }
  if (_llamaContext) {
    try {
      await releaseAllLlama();
    } catch (e) {
      console.warn("Error releasing llama context:", e);
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

    // 4. Numbered list items: 1. Buy milk, 2. Call doctor
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (numberedMatch && numberedMatch[1]) {
      const itemText = numberedMatch[1].trim();
      if (actionVerbRegex.test(itemText) || itemText.length < 80) {
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
    _llamaContext = null;
    console.warn("LLM summarization failed or model unavailable, falling back to heuristics:", err?.message);
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
    _llamaContext = null;
    console.warn("LLM task extraction failed or model unavailable, falling back to heuristics:", err?.message);
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
    _llamaContext = null;
    // Fall through to keyword-based fallback below
    console.warn("LLM parsing failed or model unavailable, falling back to keyword extraction:", err?.message);
  }

  rawOutput = rawOutput.trim();
  if (!rawOutput.endsWith("}")) rawOutput += "}";

  try {
    const parsed = JSON.parse(rawOutput);
    if (parsed.type) {
      return parsed;
    }
  } catch (err) {
    console.error("Failed to parse AI command JSON:", rawOutput, err);
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
      tomorrow.setHours(9, 0, 0, 0); // default to 9 AM tomorrow
      dueDate = tomorrow.toISOString();
      title = title.replace(/tomorrow/gi, "").trim();
    } else if (lower.includes("today")) {
      const todayStr = getLocalDateString();
      const todayDate = parseLocalDate(todayStr);
      todayDate.setHours(17, 0, 0, 0); // default to 5 PM today
      dueDate = todayDate.toISOString();
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
  const clampedContent = noteContent.slice(0, MAX_INPUT_CHARS);

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
    // Reset stale context so next call re-initialises cleanly
    _llamaContext = null;
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
  const clampedContent = noteContent.slice(0, MAX_INPUT_CHARS);

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
    // Reset stale context so next call re-initialises cleanly
    _llamaContext = null;
    const msg = err?.message || "Native inference error";
    if (msg === "Unknown error" || msg.includes("GGML") || msg.includes("llama")) {
      throw new Error("The AI model encountered an error. Please close and reopen the AI assistant, then try again.");
    }
    throw new Error(msg);
  }

  return fullText.trim();
};
