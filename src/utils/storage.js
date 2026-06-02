import AsyncStorage from "@react-native-async-storage/async-storage";

export const APP_VERSION = "v3.0.0";
export const STORAGE_VERSION = "v6.0";

// COMPREHENSIVE CACHE CLEARING SYSTEM
export const clearAllCaches = async () => {
  console.log("🧹 STARTING COMPREHENSIVE CACHE CLEAR...");

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    console.log("📋 Found AsyncStorage keys:", allKeys);

    const kwestupKeys = allKeys.filter(
      (key) =>
        key.includes("kwestup") ||
        key.includes("medical") ||
        key.includes("clean") ||
        key.includes("sidebar") ||
        key.includes("cache"),
    );

    if (kwestupKeys.length > 0) {
      await AsyncStorage.multiRemove(kwestupKeys);
      console.log("✅ Cleared KwestUp storage keys:", kwestupKeys);
    }

    const specificKeys = [
      "kwestup_medical_data",
      "kwestup_medical_data_v2",
      "kwestup_clean_data_v3",
      "kwestup_ui_cache",
      "kwestup_version_check",
      "@kwestup_data",
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
