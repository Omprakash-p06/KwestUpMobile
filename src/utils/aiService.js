/**
 * KwestUp Mobile — On-Device AI Service
 * Manages llama.rn model lifecycle, context loading, and inference.
 * 
 * Uses: llama.rn (https://github.com/mybigday/llama.rn)
 * Model: Qwen3-0.6B Q4_K_M GGUF (~250MB, runs offline)
 */

import { initLlama, releaseAllLlama } from "llama.rn";
import * as FileSystem from "expo-file-system";

// === Model Configuration ===
const MODEL_FILENAME = "qwen3-0.6b-q4_k_m.gguf";
const MODEL_DOWNLOAD_URL =
  "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/main/qwen3-0.6b-q4_k_m.gguf";
const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
const MODEL_PATH = `${MODEL_DIR}${MODEL_FILENAME}`;

// === Module-level context handle ===
let _llamaContext = null;

/**
 * Returns true if the GGUF model file is cached on device.
 */
export const isModelDownloaded = async () => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(MODEL_PATH);
    return fileInfo.exists && fileInfo.size > 10_000_000; // at least 10MB
  } catch {
    return false;
  }
};

/**
 * Downloads the Qwen3-0.6B GGUF model file with progress callbacks.
 * @param {function} onProgress - called with { progress: 0–1, bytesReceived, totalBytes }
 */
export const downloadModel = async (onProgress) => {
  // Ensure models directory exists
  const dirInfo = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    MODEL_DOWNLOAD_URL,
    MODEL_PATH,
    {},
    (downloadProgress) => {
      const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
      if (totalBytesExpectedToWrite > 0 && onProgress) {
        onProgress({
          progress: totalBytesWritten / totalBytesExpectedToWrite,
          bytesReceived: totalBytesWritten,
          totalBytes: totalBytesExpectedToWrite,
        });
      }
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error("Model download failed — no URI returned.");
  }
  return result.uri;
};

/**
 * Loads the GGUF model into a llama.rn inference context.
 * Throws if model file is not downloaded.
 */
export const loadModel = async () => {
  if (_llamaContext) {
    return _llamaContext; // already loaded
  }

  const downloaded = await isModelDownloaded();
  if (!downloaded) {
    throw new Error("Model not downloaded. Please download the AI model first.");
  }

  _llamaContext = await initLlama({
    model: MODEL_PATH,
    use_mlock: false,
    n_ctx: 2048,        // context window (tokens)
    n_threads: 4,       // inference threads
    n_gpu_layers: 0,    // CPU-only; set to 99 for Metal/GPU on supported devices
  });

  return _llamaContext;
};

/**
 * Releases the loaded model context to free device memory.
 */
export const unloadModel = async () => {
  if (_llamaContext) {
    await releaseAllLlama();
    _llamaContext = null;
  }
};

/**
 * Summarizes the given markdown note text using the on-device LLM.
 * Returns a bulleted summary string.
 * 
 * @param {string} noteContent - raw markdown content of the note
 * @param {function} onToken - streaming callback for each generated token
 */
export const summarizeNote = async (noteContent, onToken) => {
  const ctx = await loadModel();

  const prompt = `<|im_start|>system
You are a concise note summarizer. Given a markdown note, output ONLY a bullet-point summary of the key ideas. No preamble, no explanation — just bullet points.
<|im_end|>
<|im_start|>user
Summarize this note:

${noteContent.slice(0, 3000)}
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

  return fullText.trim();
};

/**
 * Extracts actionable tasks from the given markdown note text.
 * Returns an array of task title strings.
 * 
 * @param {string} noteContent - raw markdown content of the note
 */
export const extractTasksFromNote = async (noteContent) => {
  const ctx = await loadModel();

  const prompt = `<|im_start|>system
You are a task extractor. Given a markdown note, identify ALL actionable items, to-dos, or things that need to be done. Return ONLY a JSON array of short task title strings. Example: ["Buy groceries", "Call the dentist"]. No explanation.
<|im_end|>
<|im_start|>user
Extract tasks from this note:

${noteContent.slice(0, 3000)}
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
    if (Array.isArray(parsed)) {
      return parsed.filter((t) => typeof t === "string" && t.trim().length > 0);
    }
  } catch {
    // Fallback: extract quoted strings
    const matches = rawOutput.match(/"([^"]+)"/g) || [];
    return matches.map((m) => m.replace(/"/g, "").trim()).filter(Boolean);
  }

  return [];
};
