/**
 * KwestUp Mobile — On-Device AI Service
 * Manages llama.rn model lifecycle, context loading, and inference.
 * 
 * Uses: llama.rn (https://github.com/mybigday/llama.rn)
 * Model: Qwen2.5-0.5B-Instruct Q4_K_M GGUF (~468MB, runs offline)
 */

import { initLlama, releaseAllLlama } from "llama.rn";
import * as FileSystem from "expo-file-system";

// === Model Configuration ===
const MODEL_FILENAME = "qwen2.5-0.5b-instruct-q4_k_m.gguf";
const MODEL_DOWNLOAD_URL =
  "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";
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
    // The qwen2.5-0.5b-instruct-q4_k_m.gguf model should be ~468MB (491,400,032 bytes).
    // If it exists but is smaller than 450MB, it's corrupted or incomplete!
    if (fileInfo.exists) {
      if (fileInfo.size < 450_000_000) {
        console.warn(`Model file found but is incomplete (${fileInfo.size} bytes). Deleting for safety.`);
        await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
        return false;
      }
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error checking model file status:", err);
    return false;
  }
};

/**
 * Downloads the Qwen2.5-0.5B-Instruct GGUF model file with progress callbacks.
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
    throw new Error("Model not downloaded or corrupted. Please download the AI model first.");
  }

  try {
    _llamaContext = await initLlama({
      model: MODEL_PATH,
      use_mlock: false,
      n_ctx: 2048,        // stable 2048 prevents OOM native crashes on standard hardware
      n_threads: 4,       // inference threads
      n_gpu_layers: 0,    // CPU-only
      no_gpu_devices: true, // skip GPU device probing to avoid Unknown error on Android
    });
    return _llamaContext;
  } catch (err) {
    _llamaContext = null;
    const msg = err?.message || "Failed to initialize native model context";
    throw new Error(`Model initialization failed: ${msg}`);
  }
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

  // ~4 chars per token; budget: 2048 context - 256 output - ~150 prompt = ~1642 tokens input (~6500 chars)
  const MAX_INPUT_CHARS = 6000;
  const clampedContent = noteContent.slice(0, MAX_INPUT_CHARS);

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

  try {
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
  } catch (err) {
    // Reset stale context so next call re-initialises cleanly
    _llamaContext = null;
    const msg = err?.message || "Unknown inference error";
    throw new Error(`Summarization failed on-device: ${msg}`);
  }

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

  // ~4 chars per token; budget: 2048 context - 192 output - ~150 prompt = ~1706 tokens input (~6800 chars)
  const MAX_INPUT_CHARS = 6000;
  const clampedContent = noteContent.slice(0, MAX_INPUT_CHARS);

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

  try {
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
  } catch (err) {
    _llamaContext = null;
    const msg = err?.message || "Unknown inference error";
    throw new Error(`Task extraction failed on-device: ${msg}`);
  }

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

/**
 * Parses a global natural language command (e.g. "Buy milk tomorrow") into a structured task or birthday.
 * Uses the local offline LLM and returns a parsed JSON object.
 * 
 * @param {string} command - the user's natural language request
 */
export const parseGlobalCommand = async (command) => {
  const ctx = await loadModel();
  const today = new Date().toISOString();
  
  const prompt = `<|im_start|>system
You are a command parser for KwestUp productivity app. You parse user natural language requests to create tasks or birthdays.
Today's date is ${today}.
You MUST output ONLY a valid JSON object matching one of these formats:
1. For tasks: {"type": "task", "title": "Task title", "description": "Optional description", "dueDate": "YYYY-MM-DDTHH:mm:ss.sssZ" (optional)}
2. For birthdays: {"type": "birthday", "name": "Person's name", "date": "YYYY-MM-DD" or "MM-DD"}

No explanation, no other text — only the JSON object.
<|im_end|>
<|im_start|>user
Parse this command: "${command}"
<|im_end|>
<|im_start|>assistant
{`;

  let rawOutput = "{";

  try {
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
    console.warn("LLM parsing failed, falling back to keyword extraction:", err?.message);
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
  if (lower.includes("birthday") || lower.includes("born") || lower.includes("bday")) {
    // Extract a name: e.g. "Mom's birthday on Oct 10" -> "Mom's birthday" or "Mom"
    let name = command;
    let dateStr = new Date().toISOString().slice(5, 10); // default Oct/Nov etc.

    // Try finding date like "Oct 10", "10-15", etc.
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    for (let i = 0; i < 12; i++) {
      if (lower.includes(monthNames[i])) {
        const monthNum = (i + 1).toString().padStart(2, "0");
        const match = lower.match(new RegExp(`${monthNames[i]}\\s*(\\d+)`));
        if (match) {
          dateStr = `${monthNum}-${match[1].padStart(2, "0")}`;
        }
        break;
      }
    }

    // Clean name: e.g. remove "add ", "create ", "birthday ", "bday "
    name = name.replace(/(add|create|birthday|bday|on|for|is)\s*/gi, "").trim();
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
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // default to 9 AM tomorrow
      dueDate = tomorrow.toISOString();
      title = title.replace(/tomorrow/gi, "").trim();
    } else if (lower.includes("today")) {
      const todayDate = new Date();
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
 * Notion-style Writing Assistant using on-device Qwen model.
 * Directly edits/improves the given markdown note content based on commandType.
 * 
 * @param {string} noteContent - raw note content
 * @param {string} commandType - "improve" | "grammar" | "longer" | "shorter" | "professional" | "casual"
 * @param {function} onToken - streaming callback
 */
export const assistWriting = async (noteContent, commandType, onToken) => {
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
