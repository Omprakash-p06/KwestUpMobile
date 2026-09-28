import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_VERSION } from "./storage";
import { logger } from "./logger";

export const DEBUG_MODE = false;

// WR-03: dev-only guard shared by the diagnostic probes below. Release builds
// must never phone third-party endpoints or pay probe latency at startup.
const isDiagnosticsEnabled = () =>
  typeof __DEV__ !== "undefined" ? Boolean(__DEV__) : process.env.NODE_ENV !== "production";

// NETWORK DIAGNOSTICS
export const runNetworkDiagnostics = async () => {
  // WR-03: skip the hardcoded httpbin probe outside dev — a privacy-first
  // release build must not contact a third-party endpoint on every launch.
  if (!isDiagnosticsEnabled()) {
    logger.debug("🌐 Network diagnostics skipped (dev-only probe).");
    return;
  }
  logger.debug("🌐 RUNNING NETWORK DIAGNOSTICS...");

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
      logger.debug("✅ Network connectivity: OK");
      logger.debug("📡 Response status:", response.status);
    } else {
      logger.debug("⚠️ Network response not OK:", response.status);
    }
  } catch (error) {
    logger.error("❌ Network connectivity failed:", error);
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
  logger.debug("🔄 Checking for updates via GitHub releases...");
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
      
      const apkAsset = data.assets?.find(asset => asset.name.endsWith('.apk'));
      const apkUrl = apkAsset ? apkAsset.browser_download_url : null;

      logger.debug(`Latest release version found: ${latestVersion}`);
      logger.debug(`Current app version: ${APP_VERSION}`);

      if (latestVersion && isNewerVersion(APP_VERSION, latestVersion)) {
        logger.info("✅ A new update is available!");
        if (onUpdateAvailable) {
          onUpdateAvailable({
            latestVersion,
            releaseUrl,
            releaseNotes,
            apkUrl
          });
        }
        return { hasUpdate: true, latestVersion, releaseUrl, releaseNotes, apkUrl };
      } else {
        logger.debug("ℹ️ App is up to date.");
      }
    } else {
      logger.warn("⚠️ Failed to check GitHub releases:", response.status);
    }
  } catch (error) {
    logger.error("❌ Failed to fetch GitHub updates:", error);
  }
  return { hasUpdate: false };
};

// DEVICE DIAGNOSTICS
export const runDeviceDiagnostics = () => {
  // WR-03: dev-only informational probe — never runs in release builds
  // (callers in App.js also gate on __DEV__; belt and suspenders).
  if (!isDiagnosticsEnabled()) {
    return;
  }
  logger.debug("📱 DEVICE DIAGNOSTICS:");
  logger.debug("🤖 Platform:", Platform.OS);
  logger.debug("📊 Platform Version:", Platform.Version);
  logger.debug("🏗️ Development Mode:", DEBUG_MODE);

  if (Platform.OS === "ios") {
    logger.debug("🍎 iOS Platform Constants:", Platform.constants);
  } else {
    logger.debug("🤖 Android Platform Constants:", Platform.constants);
  }
};

export const sendTelemetryEvent = async (event, payload = {}) => {
  try {
    const isOptIn = await AsyncStorage.getItem("kwestup_telemetry_optin");
    if (isOptIn !== "true") return;

    await fetch("https://api.kwestup.com/telemetry", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event,
        version: APP_VERSION,
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
    });
    logger.debug("📊 Telemetry event sent:", event);
  } catch (err) {
    logger.debug("⚠️ Telemetry send skipped (offline/disabled):", err.message);
  }
};

