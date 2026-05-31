import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

// ─── AsyncStorage Keys ───────────────────────────────────────────────────────
const VAULTS_KEY = "kwestup_vaults_v5.0";
const ACTIVE_KEY = "kwestup_activeVault_v5.0";

// ─── Path Helpers ────────────────────────────────────────────────────────────

/**
 * Returns the absolute filesystem path for a given vault ID.
 * Structure: <documentDirectory>/Notes/Vaults/<vaultId>/
 */
export const getVaultPath = (vaultId) => {
  return `${FileSystem.documentDirectory}Notes/Vaults/${vaultId}/`;
};

/**
 * Ensures the top-level Notes/Vaults/ directory exists.
 */
export const ensureVaultsDir = async () => {
  const vaultsDir = `${FileSystem.documentDirectory}Notes/Vaults/`;
  const info = await FileSystem.getInfoAsync(vaultsDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(vaultsDir, { intermediates: true });
    console.log("📂 Notes/Vaults/ directory initialized");
  }
};

// ─── Vault CRUD ───────────────────────────────────────────────────────────────

/**
 * Reads all vault configs from AsyncStorage.
 * @returns {Promise<VaultConfig[]>}
 */
export const getVaults = async () => {
  try {
    const raw = await AsyncStorage.getItem(VAULTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error("❌ Failed to read vaults from AsyncStorage:", error);
    return [];
  }
};

/**
 * Writes vault configs array to AsyncStorage.
 * @param {VaultConfig[]} vaults
 */
export const saveVaults = async (vaults) => {
  try {
    await AsyncStorage.setItem(VAULTS_KEY, JSON.stringify(vaults));
  } catch (error) {
    console.error("❌ Failed to save vaults to AsyncStorage:", error);
  }
};

/**
 * Creates a new vault with the given name. Creates the vault directory,
 * adds it to the persisted vaults list, and returns the new VaultConfig.
 * @param {string} name
 * @returns {Promise<VaultConfig>}
 */
export const createVault = async (name) => {
  await ensureVaultsDir();
  const id = Date.now().toString();
  const now = new Date().toISOString();
  const path = getVaultPath(id);

  // Create the vault directory on disk
  await FileSystem.makeDirectoryAsync(path, { intermediates: true });

  const vault = { id, name: name || "New Vault", path, createdAt: now, updatedAt: now };

  const vaults = await getVaults();
  vaults.push(vault);
  await saveVaults(vaults);

  console.log("🗃️ Vault created:", vault.name, "at", path);
  return vault;
};

/**
 * Deletes a vault and its entire directory from disk. If the deleted vault
 * was the active vault, switches to the first remaining vault.
 * @param {string} vaultId
 */
export const deleteVault = async (vaultId) => {
  const vaultPath = getVaultPath(vaultId);
  try {
    const info = await FileSystem.getInfoAsync(vaultPath);
    if (info.exists) {
      await FileSystem.deleteAsync(vaultPath, { idempotent: true });
    }
  } catch (error) {
    console.error("❌ Failed to delete vault directory:", error);
  }

  const vaults = await getVaults();
  const remaining = vaults.filter((v) => v.id !== vaultId);
  await saveVaults(remaining);

  // If the deleted vault was active, switch to the first remaining vault
  const activeId = await getActiveVaultId();
  if (activeId === vaultId && remaining.length > 0) {
    await setActiveVaultId(remaining[0].id);
  }

  console.log("🗑️ Vault deleted:", vaultId);
};

/**
 * Renames an existing vault (updates name + updatedAt in AsyncStorage).
 * @param {string} vaultId
 * @param {string} newName
 */
export const renameVault = async (vaultId, newName) => {
  const vaults = await getVaults();
  const updated = vaults.map((v) =>
    v.id === vaultId ? { ...v, name: newName, updatedAt: new Date().toISOString() } : v
  );
  await saveVaults(updated);
  console.log("✏️ Vault renamed:", vaultId, "→", newName);
};

// ─── Active Vault Tracking ────────────────────────────────────────────────────

/**
 * Reads the active vault ID from AsyncStorage.
 * @returns {Promise<string|null>}
 */
export const getActiveVaultId = async () => {
  try {
    return await AsyncStorage.getItem(ACTIVE_KEY);
  } catch (error) {
    console.error("❌ Failed to read active vault ID:", error);
    return null;
  }
};

/**
 * Persists the active vault ID to AsyncStorage.
 * @param {string} id
 */
export const setActiveVaultId = async (id) => {
  try {
    await AsyncStorage.setItem(ACTIVE_KEY, id);
  } catch (error) {
    console.error("❌ Failed to set active vault ID:", error);
  }
};

// ─── One-Time Migration ───────────────────────────────────────────────────────

/**
 * Migrates an existing flat Notes/ directory structure to the multi-vault
 * Notes/Vaults/default/ structure. Safe to call on every app start — it
 * skips migration if Notes/Vaults/ already exists.
 */
export const migrateToVaultSystem = async () => {
  const notesRoot = `${FileSystem.documentDirectory}Notes/`;
  const vaultsDir = `${FileSystem.documentDirectory}Notes/Vaults/`;

  // Check if already migrated
  const vaultsDirInfo = await FileSystem.getInfoAsync(vaultsDir);
  if (vaultsDirInfo.exists) {
    console.log("✅ Vault system already initialized — skipping migration");
    return;
  }

  console.log("🔄 Migrating Notes/ to multi-vault structure...");

  // Create the Vaults/ directory and default vault directory
  const defaultVaultPath = `${vaultsDir}default/`;
  await FileSystem.makeDirectoryAsync(defaultVaultPath, { intermediates: true });

  // Read all existing items in Notes/ (excluding any future Vaults/ dir)
  let rootItems = [];
  const notesRootInfo = await FileSystem.getInfoAsync(notesRoot);
  if (notesRootInfo.exists) {
    rootItems = await FileSystem.readDirectoryAsync(notesRoot);
  }

  for (const item of rootItems) {
    if (item === "Vaults") continue; // Skip the just-created Vaults/ dir

    const srcPath = `${notesRoot}${item}`;
    const destPath = `${defaultVaultPath}${item}`;

    try {
      await FileSystem.moveAsync({ from: srcPath, to: destPath });
      console.log("📦 Migrated:", item);
    } catch (moveErr) {
      console.warn("⚠️ Move failed for", item, "— attempting copy:", moveErr.message);
      try {
        await FileSystem.copyAsync({ from: srcPath, to: destPath });
        await FileSystem.deleteAsync(srcPath, { idempotent: true });
      } catch (copyErr) {
        console.error("❌ Copy fallback failed for", item, ":", copyErr.message);
      }
    }
  }

  // Create and persist the default vault config
  const now = new Date().toISOString();
  const defaultVault = {
    id: "default",
    name: "My Vault",
    path: defaultVaultPath,
    createdAt: now,
    updatedAt: now,
  };
  await saveVaults([defaultVault]);
  await setActiveVaultId("default");

  console.log("✅ Migration complete — default vault created at", defaultVaultPath);
};
