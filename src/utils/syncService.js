/**
 * KwestUp Mobile Client Synchronization Service
 * Manages local network pings and bidrectional REST sync handshakes.
 */

// Helper to wrap fetches with timeouts
const fetchWithTimeout = async (url, options, timeoutMs = 4000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/**
 * Pings the desktop sync server to verify connectivity.
 */
export const pingSyncServer = async (config) => {
  const { ip, port } = config;
  const baseUrl = `http://${ip}:${port}`;
  
  try {
    const response = await fetchWithTimeout(`${baseUrl}/ping`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    }, 3000);
    
    if (!response.ok) {
      throw new Error(`Ping failed with status code: ${response.status}`);
    }
    
    const data = await response.json();
    return data && data.status === "online";
  } catch (error) {
    console.error("❌ Sync Server Ping Failed:", error);
    return false;
  }
};

/**
 * Performs full local network synchronization.
 * Exchanges notes, tasks, task lists, and birthdays with host PC.
 */
export const performSync = async (config, localData) => {
  const { ip, port, token } = config;
  const baseUrl = `http://${ip}:${port}`;

  console.log(`🌐 INITIALIZING LOCAL NETWORK SYNC -> ${baseUrl}`);

  // 1. Verify connection first
  const isOnline = await pingSyncServer(config);
  if (!isOnline) {
    throw new Error(
      "Unable to connect to the PC Sync Server.\n\n" +
      "1. Make sure your KwestUp PC Sync Server is running.\n" +
      "2. Verify both your mobile and PC are on the exact same Wi-Fi subnet."
    );
  }

  // 2. Prepare client JSON payload
  const payload = {
    notes: localData.notes || [],
    tasks: localData.tasks || [],
    taskLists: localData.taskLists || [],
    birthdays: localData.birthdays || [],
    themeMode: localData.themeMode || "light",
    selectedThemeName: localData.selectedThemeName || "dribbble",
    userName: localData.userName || "",
  };

  try {
    // 3. Issue the POST request to /sync
    const response = await fetchWithTimeout(`${baseUrl}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    }, 10000); // 10-second timeout for large vaults

    // 4. Handle authorization blocks
    if (response.status === 401 || response.status === 403) {
      throw new Error("Authorization Forbidden: The scanned security token is invalid or expired. Please re-scan.");
    }

    if (!response.ok) {
      throw new Error(`Sync API failed with response status code: ${response.status}`);
    }

    // 5. Return synced result
    const result = await response.json();
    console.log("✅ SYNC DATA EXCHANGED SUCCESSFULLY");
    return result;
  } catch (error) {
    console.error("❌ Sync Service Request Failed:", error);
    if (error.name === "AbortError") {
      throw new Error("Connection Timeout: The PC server took too long to resolve the sync. Please check server logs.");
    }
    throw error;
  }
};
