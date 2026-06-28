import AsyncStorage from "@react-native-async-storage/async-storage";

export const APP_VERSION = "v3.1.0";
export const STORAGE_VERSION = "v6.0";

// Checks if a key contains active user data or settings that should never be deleted on update
export const isUserDataKey = (key) => {
  return (
    key.startsWith("kwestup_data_") ||
    key.startsWith("kwestup_userName_") ||
    key.startsWith("kwestup_theme_mode_") ||
    key.startsWith("kwestup_theme_name_") ||
    key.startsWith("kwestup_timer_state_") ||
    key.startsWith("kwestup_activeVault_") ||
    key.startsWith("kwestup_vaults_") ||
    key.startsWith("kwestup_widget_")
  );
};

// COMPREHENSIVE CACHE CLEARING SYSTEM (Safely preserves user data)
export const clearAllCaches = async () => {
  console.log("🧹 STARTING COMPREHENSIVE CACHE CLEAR...");

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    console.log("📋 Found AsyncStorage keys:", allKeys);

    // Filter out active and legacy user data keys so they are protected from cache clear
    const kwestupKeys = allKeys.filter(
      (key) =>
        (key.includes("kwestup") ||
         key.includes("medical") ||
         key.includes("clean") ||
         key.includes("sidebar") ||
         key.includes("cache")) &&
        !isUserDataKey(key)
    );

    if (kwestupKeys.length > 0) {
      await AsyncStorage.multiRemove(kwestupKeys);
      console.log("✅ Cleared KwestUp storage keys:", kwestupKeys);
    }

    const specificKeys = [
      "kwestup_ui_cache",
      "kwestup_version_check",
      "sidebar:state",
    ];

    await AsyncStorage.multiRemove(specificKeys);
    console.log("✅ Cleared specific storage keys");

    await AsyncStorage.setItem("kwestup_last_version", APP_VERSION);
    await AsyncStorage.setItem("kwestup_last_clear", new Date().toISOString());

    console.log("✅ CACHE CLEAR COMPLETED SUCCESSFULLY");
    return true;
  } catch (error) {
    console.error("❌ CACHE CLEAR FAILED:", error);
    return false;
  }
};

// SCANS AND MIGRATES LEGACY USER DATA ACROSS STORAGE VERSIONS
export const migrateUserDataIfNeeded = async (currentStorageVersion) => {
  try {
    const currentDataKey = `kwestup_data_${currentStorageVersion}`;
    const currentData = await AsyncStorage.getItem(currentDataKey);

    // If current version already has data, no migration is needed!
    if (currentData) {
      console.log(`📦 Data exists for current storage version ${currentStorageVersion}, skipping migration.`);
      return false;
    }

    console.log(`🔍 No data found for ${currentStorageVersion}. Scanning for legacy user data to migrate...`);
    const allKeys = await AsyncStorage.getAllKeys();

    // Find all kwestup_data_v* keys
    const dataKeys = allKeys.filter((key) => key.startsWith("kwestup_data_"));
    if (dataKeys.length === 0) {
      console.log("ℹ️ No legacy user data keys found to migrate.");
      return false;
    }

    // Extract version numbers and sort to find the highest version
    const versionPattern = /^kwestup_data_v(\d+(?:\.\d+)*)$/;
    const versionedKeys = dataKeys
      .map((key) => {
        const match = key.match(versionPattern);
        return match ? { key, version: match[1] } : null;
      })
      .filter((item) => item !== null);

    if (versionedKeys.length === 0) {
      console.log("ℹ️ No valid versioned data keys found.");
      return false;
    }

    // Sort versions descending (highest version first)
    versionedKeys.sort((a, b) => {
      const partsA = a.version.split(".").map(Number);
      const partsB = b.version.split(".").map(Number);
      const maxLength = Math.max(partsA.length, partsB.length);
      for (let i = 0; i < maxLength; i++) {
        const valA = partsA[i] || 0;
        const valB = partsB[i] || 0;
        if (valA !== valB) return valB - valA; // Descending
      }
      return 0;
    });

    const sourceItem = versionedKeys[0];
    console.log(`✨ Found most recent legacy user data: ${sourceItem.key} (version ${sourceItem.version})`);

    const sourceVersion = sourceItem.version;
    const sourceDataRaw = await AsyncStorage.getItem(sourceItem.key);
    if (!sourceDataRaw) return false;

    // Load related settings for this source version if they exist
    const sourceUserName = await AsyncStorage.getItem(`kwestup_userName_v${sourceVersion}`);
    const sourceThemeMode = await AsyncStorage.getItem(`kwestup_theme_mode_v${sourceVersion}`);
    const sourceThemeName = await AsyncStorage.getItem(`kwestup_theme_name_v${sourceVersion}`);
    const sourceTimerState = await AsyncStorage.getItem(`kwestup_timer_state_v${sourceVersion}`);

    // Migrate to current version keys
    await Promise.all([
      AsyncStorage.setItem(currentDataKey, sourceDataRaw),
      sourceUserName ? AsyncStorage.setItem(`kwestup_userName_${currentStorageVersion}`, sourceUserName) : Promise.resolve(),
      sourceThemeMode ? AsyncStorage.setItem(`kwestup_theme_mode_${currentStorageVersion}`, sourceThemeMode) : Promise.resolve(),
      sourceThemeName ? AsyncStorage.setItem(`kwestup_theme_name_${currentStorageVersion}`, sourceThemeName) : Promise.resolve(),
      sourceTimerState ? AsyncStorage.setItem(`kwestup_timer_state_${currentStorageVersion}`, sourceTimerState) : Promise.resolve(),
    ]);

    // Also migrate active vault and vault list if they exist in older versions
    const activeVaultKeys = allKeys.filter((k) => k.startsWith("kwestup_activeVault_v"));
    if (activeVaultKeys.length > 0) {
      activeVaultKeys.sort();
      const highestActiveKey = activeVaultKeys[activeVaultKeys.length - 1];
      const activeVaultData = await AsyncStorage.getItem(highestActiveKey);
      if (activeVaultData) {
        await AsyncStorage.setItem("kwestup_activeVault_v5.0", activeVaultData);
      }
    }

    const vaultsKeys = allKeys.filter((k) => k.startsWith("kwestup_vaults_v"));
    if (vaultsKeys.length > 0) {
      vaultsKeys.sort();
      const highestVaultsKey = vaultsKeys[vaultsKeys.length - 1];
      const vaultsData = await AsyncStorage.getItem(highestVaultsKey);
      if (vaultsData) {
        await AsyncStorage.setItem("kwestup_vaults_v5.0", vaultsData);
      }
    }

    console.log(`🎉 Successfully migrated user data from v${sourceVersion} to ${currentStorageVersion}`);
    return true;
  } catch (err) {
    console.error("❌ Error during user data migration:", err);
    return false;
  }
};

