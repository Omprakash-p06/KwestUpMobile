import CryptoJS from "crypto-js";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isUserDataKey, APP_VERSION, STORAGE_VERSION } from "./storage";
import { getVaults, getVaultPath, ensureVaultsDir } from "./vaultService";
import { loadBillingData, saveBillingData } from "./billingStorage";
import { scheduleRecurringBillReminder, cancelRecurringBillReminders } from "./billingNotifications";

// ─── Encryption Helpers ───────────────────────────────────────────────────────

/**
 * Encrypts a payload object using AES-256 with a user passphrase.
 * @param {Object} payloadObj - Data to encrypt
 * @param {string} passphrase - User-defined passphrase
 * @returns {string} Encrypted ciphertext string
 */
export const encryptBackup = (payloadObj, passphrase) => {
  try {
    const rawText = JSON.stringify(payloadObj);
    const salt = CryptoJS.enc.Hex.parse("4b77657374557053616c745f7632"); // Hex string for "KwestUpSalt_v2"
    const key = CryptoJS.PBKDF2(passphrase, salt, { keySize: 256/32, iterations: 1000 });
    return CryptoJS.AES.encrypt(rawText, key, { iv: salt }).toString();
  } catch (error) {
    console.error("❌ Encryption failed:", error);
    throw new Error("Failed to encrypt data.");
  }
};

/**
 * Decrypts an AES-256 encrypted backup string.
 * @param {string} encryptedText - Ciphertext from encryptBackup
 * @param {string} passphrase - User-defined passphrase
 * @returns {Object} Decrypted and parsed payload
 */
export const decryptBackup = (encryptedText, passphrase) => {
  try {
    const salt = CryptoJS.enc.Hex.parse("4b77657374557053616c745f7632");
    const key = CryptoJS.PBKDF2(passphrase, salt, { keySize: 256/32, iterations: 1000 });
    const bytes = CryptoJS.AES.decrypt(encryptedText, key, { iv: salt });
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) {
      throw new Error("Invalid password or corrupted file.");
    }
    return JSON.parse(decryptedText);
  } catch (error) {
    console.error("❌ Decryption failed:", error);
    throw new Error("Unable to decrypt archive. Please verify the passphrase.");
  }
};

// ─── Vault Packager ───────────────────────────────────────────────────────────

/**
 * Recursively reads all vault folders and markdown notes from the filesystem.
 * @returns {Promise<Array>} Array of vault objects with notes array
 */
export const packVaults = async () => {
  const vaults = await getVaults();
  const packedVaults = [];

  for (const vault of vaults) {
    const notes = [];
    const vaultPath = getVaultPath(vault.id);
    const vaultInfo = await FileSystem.getInfoAsync(vaultPath);

    if (vaultInfo.exists) {
      const rootItems = await FileSystem.readDirectoryAsync(vaultPath);

      // Process root items — may be folders or loose .md files
      const folderProcessingPromises = [];
      const rootNotes = [];

      for (const item of rootItems) {
        const itemPath = `${vaultPath}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);

        if (itemInfo.isDirectory) {
          // Process folder contents in parallel for performance
          folderProcessingPromises.push(
            (async () => {
              const files = await FileSystem.readDirectoryAsync(`${itemPath}/`);
              const mdFiles = files.filter((f) => f.endsWith(".md"));
              const fileReads = await Promise.all(
                mdFiles.map(async (file) => {
                  const content = await FileSystem.readAsStringAsync(
                    `${itemPath}/${file}`
                  );
                  return {
                    folder: item,
                    title: file.replace(".md", ""),
                    content,
                  };
                })
              );
              return fileReads;
            })()
          );
        } else if (item.endsWith(".md")) {
          // Loose file at vault root
          rootNotes.push(
            (async () => {
              const content = await FileSystem.readAsStringAsync(itemPath);
              return {
                folder: "Uncategorized",
                title: item.replace(".md", ""),
                content,
              };
            })()
          );
        }
      }

      // Await all parallel reads
      const folderResults = await Promise.all(folderProcessingPromises);
      const rootNoteResults = await Promise.all(rootNotes);

      folderResults.forEach((folderNotes) => notes.push(...folderNotes));
      rootNoteResults.forEach((note) => notes.push(note));
    }

    packedVaults.push({
      id: vault.id,
      name: vault.name,
      createdAt: vault.createdAt,
      updatedAt: vault.updatedAt,
      notes,
    });
  }

  return packedVaults;
};

// ─── AsyncStorage Collector ───────────────────────────────────────────────────

/**
 * Collects all user data keys from AsyncStorage.
 * Filters using isUserDataKey to capture only user-relevant storage.
 * @returns {Promise<Object>} Key-value map of user storage
 */
export const collectAsyncStorageData = async () => {
  const allKeys = await AsyncStorage.getAllKeys();
  const userKeys = allKeys.filter(isUserDataKey);

  if (userKeys.length === 0) return {};

  const pairs = await AsyncStorage.multiGet(userKeys);
  const result = {};
  for (const [key, value] of pairs) {
    result[key] = value;
  }
  return result;
};

// ─── Export Pipeline ──────────────────────────────────────────────────────────

/**
 * Full export pipeline: collect → pack vaults → encrypt → write → share → cleanup.
 * @param {string} passphrase - User-defined passphrase for AES-256 encryption
 * @param {Function} onProgress - Progress callback (0.0 → 1.0)
 */
export const exportArchive = async (passphrase, onProgress) => {
  const tempFilePath = `${FileSystem.cacheDirectory}kwestup-backup.kwestup`;

  try {
    onProgress?.(0.1);

    // Step 1: Collect AsyncStorage user data
    const storageData = await collectAsyncStorageData();
    onProgress?.(0.3);

    // Step 2: Pack vaults from filesystem
    const vaultData = await packVaults();
    onProgress?.(0.6);

    // Step 3: Build archive payload
    const payload = {
      metadata: {
        version: "1.0",
        timestamp: new Date().toISOString(),
        appVersion: APP_VERSION,
        storageVersion: STORAGE_VERSION,
      },
      storage: storageData,
      vaults: vaultData,
      billing: await loadBillingData(),
    };

    // Step 4: Encrypt payload
    const encryptedContent = encryptBackup(payload, passphrase);
    onProgress?.(0.8);

    // Step 5: Write to cache directory
    await FileSystem.writeAsStringAsync(tempFilePath, encryptedContent);
    onProgress?.(0.9);

    // Step 6: Share via native share sheet
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Sharing is not available on this device.");
    }
    await Sharing.shareAsync(tempFilePath, {
      mimeType: "application/octet-stream",
      dialogTitle: "Export KwestUp Backup",
      UTI: "public.data",
    });

    onProgress?.(1.0);
    console.log("✅ Archive exported successfully");
  } finally {
    // Always clean up temp file
    try {
      const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
        console.log("🧹 Temp backup file cleaned up");
      }
    } catch (cleanupErr) {
      console.warn("⚠️ Failed to clean up temp file:", cleanupErr);
    }
  }
};

// ─── Import Pipeline ──────────────────────────────────────────────────────────

/**
 * Full import pipeline: read file → decrypt → clear storage → restore storage → restore vault files.
 * @param {string} filePath - URI of the .kwestup file from DocumentPicker
 * @param {string} passphrase - User-defined passphrase for AES-256 decryption
 * @param {Function} onProgress - Progress callback (0.0 → 1.0)
 */
export const importArchive = async (filePath, passphrase, onProgress) => {
  onProgress?.(0.05);

  // Step 1: Read the encrypted archive file
  let encryptedText;
  try {
    encryptedText = await FileSystem.readAsStringAsync(filePath);
  } catch (err) {
    console.error("❌ Failed to read archive file:", err);
    throw new Error("Unable to read archive file. It may be corrupted or inaccessible.");
  }

  onProgress?.(0.15);

  // Step 2: Decrypt and validate payload structure
  let payload;
  try {
    payload = decryptBackup(encryptedText, passphrase);
  } catch (err) {
    // Re-throw with standardized import error message for UI
    throw new Error("INVALID PASSPHRASE OR CORRUPTED ARCHIVE");
  }

  if (!payload?.metadata || !payload?.storage) {
    throw new Error("INVALID PASSPHRASE OR CORRUPTED ARCHIVE");
  }

  console.log("✅ Archive decrypted. Restoring from version:", payload.metadata.appVersion);
  onProgress?.(0.3);

  // Step 3: Clear existing AsyncStorage user data
  const allKeys = await AsyncStorage.getAllKeys();
  const userKeys = allKeys.filter(isUserDataKey);
  if (userKeys.length > 0) {
    await AsyncStorage.multiRemove(userKeys);
    console.log("🧹 Cleared existing AsyncStorage user data:", userKeys.length, "keys");
  }

  onProgress?.(0.45);

  // Step 4: Restore AsyncStorage from backup
  const storageEntries = Object.entries(payload.storage);
  if (storageEntries.length > 0) {
    await AsyncStorage.multiSet(storageEntries);
    console.log("✅ Restored AsyncStorage:", storageEntries.length, "keys");
  }

  onProgress?.(0.6);

  // Step 5: Restore vault files from backup
  if (payload.vaults && payload.vaults.length > 0) {
    await ensureVaultsDir();

    for (const vault of payload.vaults) {
      const vaultPath = getVaultPath(vault.id);

      // Ensure vault directory exists
      const vaultInfo = await FileSystem.getInfoAsync(vaultPath);
      if (!vaultInfo.exists) {
        await FileSystem.makeDirectoryAsync(vaultPath, { intermediates: true });
        console.log("📂 Created vault directory:", vault.id);
      }

      // Restore each note
      for (const note of vault.notes || []) {
        const { folder, title, content } = note;
        let notePath;

        if (folder && folder !== "Uncategorized") {
          const folderPath = `${vaultPath}${folder}/`;
          const folderInfo = await FileSystem.getInfoAsync(folderPath);
          if (!folderInfo.exists) {
            await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
          }
          notePath = `${folderPath}${title}.md`;
        } else {
          notePath = `${vaultPath}${title}.md`;
        }

        await FileSystem.writeAsStringAsync(notePath, content || "");
      }

      console.log(`✅ Vault '${vault.name}' restored: ${(vault.notes || []).length} notes`);
    }
  }

  onProgress?.(1.0);
  console.log("✅ Archive import complete");

  // Step 6: Restore billing data and reschedule bill reminders
  if (payload.billing) {
    const billingToRestore = payload.billing;
    // Cancel stale notification IDs from export device (they won't exist here)
    for (const bill of billingToRestore.recurringBills || []) {
      await cancelRecurringBillReminders(bill.notificationIds || []);
      // Reschedule fresh on this device
      const notifId = await scheduleRecurringBillReminder(bill, billingToRestore.currency || "₹");
      bill.notificationIds = notifId ? [notifId] : [];
    }
    await saveBillingData(billingToRestore);
    console.log("✅ Billing data restored and bill reminders rescheduled");
  }
};
