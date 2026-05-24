import { Platform } from "react-native";

export const DEBUG_MODE = false;

// NETWORK DIAGNOSTICS
export const runNetworkDiagnostics = async () => {
  console.log("🌐 RUNNING NETWORK DIAGNOSTICS...");

  try {
    const response = await fetch("https://httpbin.org/json", {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });

    if (response.ok) {
      console.log("✅ Network connectivity: OK");
      console.log("📡 Response status:", response.status);
    } else {
      console.log("⚠️ Network response not OK:", response.status);
    }
  } catch (error) {
    console.error("❌ Network connectivity failed:", error);
  }
};

// EXPO UPDATES CHECK (DISABLED FOR DEVELOPMENT)
export const checkForUpdates = async () => {
  console.log("🔄 UPDATE CHECK DISABLED - Development mode");
};

// DEVICE DIAGNOSTICS
export const runDeviceDiagnostics = () => {
  console.log("📱 DEVICE DIAGNOSTICS:");
  console.log("🤖 Platform:", Platform.OS);
  console.log("📊 Platform Version:", Platform.Version);
  console.log("🏗️ Development Mode:", DEBUG_MODE);

  if (Platform.OS === "ios") {
    console.log("🍎 iOS Platform Constants:", Platform.constants);
  } else {
    console.log("🤖 Android Platform Constants:", Platform.constants);
  }
};
