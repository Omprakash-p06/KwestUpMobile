import { Platform } from "react-native";
import { APP_VERSION } from "./storage";

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

// GITHUB RELEASES VERSION CHECK
const cleanVersion = (ver) => {
  return ver.replace(/^v/, "").trim();
};

const isNewerVersion = (current, latest) => {
  const c = cleanVersion(current).split(".").map(Number);
  const l = cleanVersion(latest).split(".").map(Number);
  
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (cv > lv) return false;
  }
  return false;
};

export const checkForUpdates = async (onUpdateAvailable) => {
  console.log("🔄 Checking for updates via GitHub releases...");
  try {
    const response = await fetch("https://api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest", {
      method: "GET",
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "KwestUp-Mobile"
      }
    });

    if (response.ok) {
      const data = await response.json();
      const latestVersion = data.tag_name;
      const releaseUrl = data.html_url;
      const releaseNotes = data.body || "";

      console.log(`Latest release version found: ${latestVersion}`);
      console.log(`Current app version: ${APP_VERSION}`);

      if (latestVersion && isNewerVersion(APP_VERSION, latestVersion)) {
        console.log("✅ A new update is available!");
        if (onUpdateAvailable) {
          onUpdateAvailable({
            latestVersion,
            releaseUrl,
            releaseNotes
          });
        }
        return { hasUpdate: true, latestVersion, releaseUrl, releaseNotes };
      } else {
        console.log("ℹ️ App is up to date.");
      }
    } else {
      console.warn("⚠️ Failed to check GitHub releases:", response.status);
    }
  } catch (error) {
    console.error("❌ Failed to fetch GitHub updates:", error);
  }
  return { hasUpdate: false };
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
