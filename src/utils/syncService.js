import { logger } from "./logger";

/**
 * KwestUp Mobile Client Synchronization Service
 * Manages local network pings, secure transport validation, and bidirectional REST sync handshakes.
 */

// Helper to wrap fetches with timeouts
const fetchWithTimeout = async (url, options, timeoutMs = 4000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/**
 * Validates the LAN sync configuration object.
 * Rejects invalid IP addresses, path injections, out-of-bounds ports, and empty tokens.
 *
 * @param {Object} config - { ip, port, token }
 * @returns {{ ip: string, port: number, token: string }}
 * @throws {Error} If config is invalid
 */
export const validateSyncConfig = (config) => {
  if (!config || typeof config !== "object") {
    throw new Error("Invalid sync configuration: config must be an object.");
  }

  const { ip, port, token } = config;

  if (!ip || typeof ip !== "string") {
    throw new Error("Invalid sync configuration: missing or invalid IP address.");
  }

  const trimmedIp = ip.trim();
  const ipv4Strict = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])$/;
  const isDottedNumeric = /^\d+(\.\d+){3}$/;
  const hostnameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const ipv6Regex = /^\[?[a-fA-F0-9:]+\]?$/;

  let isValid = false;
  if (isDottedNumeric.test(trimmedIp)) {
    isValid = ipv4Strict.test(trimmedIp);
  } else {
    isValid = hostnameRegex.test(trimmedIp) || ipv6Regex.test(trimmedIp);
  }

  if (!isValid) {
    throw new Error(`Invalid sync configuration: IP address or hostname "${ip}" is malformed.`);
  }

  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
    throw new Error(`Invalid sync configuration: port "${port}" is out of bounds (1-65535).`);
  }

  if (!token || typeof token !== "string" || token.trim().length < 6) {
    throw new Error("Invalid sync configuration: missing or insufficiently long security token.");
  }

  return { ip: trimmedIp, port: numericPort, token: token.trim() };
};

/**
 * Validates the structure of the incoming synchronization payload from the server.
 * Ensures notes, tasks, and birthdays arrays exist to prevent accidental note wipes.
 *
 * @param {Object} data - Synced result payload from server
 * @returns {Object} Validated payload
 * @throws {Error} If payload is malformed
 */
export const validateSyncPayload = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Sync API error: Malformed server response. Expected JSON object.");
  }

  if (!Array.isArray(data.notes)) {
    throw new Error("Sync API error: Server response missing required 'notes' array.");
  }
  if (!Array.isArray(data.tasks)) {
    throw new Error("Sync API error: Server response missing required 'tasks' array.");
  }
  if (!Array.isArray(data.birthdays)) {
    throw new Error("Sync API error: Server response missing required 'birthdays' array.");
  }

  if (!Array.isArray(data.taskLists)) {
    data.taskLists = [];
  }

  return data;
};

/**
 * Pings the desktop sync server to verify connectivity.
 */
export const pingSyncServer = async (config) => {
  try {
    const validConfig = validateSyncConfig({ ...config, token: config?.token || "ping-token-check" });
    const baseUrl = `http://${validConfig.ip}:${validConfig.port}`;

    const response = await fetchWithTimeout(`${baseUrl}/ping`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    }, 3000);

    if (!response.ok) {
      throw new Error(`Ping failed with status code: ${response.status}`);
    }

    const data = await response.json();
    return data && data.status === "online";
  } catch (error) {
    logger.error("❌ Sync Server Ping Failed:", error);
    return false;
  }
};

/**
 * Performs full local network synchronization.
 * Exchanges notes, tasks, task lists, and birthdays with host PC.
 */
export const performSync = async (config, localData) => {
  const validConfig = validateSyncConfig(config);
  const baseUrl = `http://${validConfig.ip}:${validConfig.port}`;

  logger.info(`🌐 INITIALIZING LOCAL NETWORK SYNC -> ${baseUrl}`);

  // 1. Verify connection first
  const isOnline = await pingSyncServer(validConfig);
  if (!isOnline) {
    throw new Error(
      "Unable to connect to the PC Sync Server.\n\n" +
      "1. Make sure your KwestUp PC Sync Server is running.\n" +
      "2. Verify both your mobile and PC are on the exact same Wi-Fi subnet."
    );
  }

  // 2. Prepare client JSON payload
  const payload = {
    notes: localData?.notes || [],
    tasks: localData?.tasks || [],
    taskLists: localData?.taskLists || [],
    birthdays: localData?.birthdays || [],
    themeMode: localData?.themeMode || "light",
    selectedThemeName: localData?.selectedThemeName || "dribbble",
    userName: localData?.userName || "",
  };

  try {
    // 3. Issue the POST request to /sync
    const response = await fetchWithTimeout(`${baseUrl}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${validConfig.token}`,
      },
      body: JSON.stringify(payload),
    }, 10000); // 10-second timeout for large vaults

    // 4. Handle authorization blocks
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authorization Forbidden: The scanned security token is invalid or expired. Please re-scan.");
    }

    if (!response.ok) {
      throw new Error(`Sync API failed with response status code: ${response.status}`);
    }

    // 5. Validate and return synced result
    const rawResult = await response.json();
    const validatedResult = validateSyncPayload(rawResult);
    logger.info("✅ SYNC DATA EXCHANGED SUCCESSFULLY");
    return validatedResult;
  } catch (error) {
    logger.error("❌ Sync Service Request Failed:", error);
    if (error.name === "AbortError") {
      throw new Error("Connection Timeout: The PC server took too long to resolve the sync. Please check server logs.");
    }
    throw error;
  }
};
