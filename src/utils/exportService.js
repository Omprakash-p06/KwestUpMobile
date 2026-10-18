import CryptoJS from "crypto-js";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isUserDataKey, APP_VERSION, STORAGE_VERSION } from "./storage";
import { getVaults, getVaultPath, ensureVaultsDir } from "./vaultService";
import { loadBillingData, saveBillingData } from "./billingStorage";
import { scheduleBillReminder, cancelNotifications } from "../services/notificationService";
import { logger } from "./logger";

// ─── Encryption Helpers ───────────────────────────────────────────────────────

/**
 * Encrypts a payload object using AES-256 with per-archive random salt and IV
 * and PBKDF2-HMAC-SHA256 with 100,000 iterations (v2 envelope format).
 *
 * @param {Object} payloadObj - Data to encrypt
 * @param {string} passphrase - User-defined passphrase
 * @returns {string} Encrypted JSON envelope string
 */
export const encryptBackup = (payloadObj, passphrase) => {
  try {
    const rawText = JSON.stringify(payloadObj);
    const salt = CryptoJS.lib.WordArray.random(16);
    const iv = CryptoJS.lib.WordArray.random(16);
    const iterations = 100000;
    const key = CryptoJS.PBKDF2(passphrase, salt, {
      keySize: 256 / 32,
      iterations,
      hasher: CryptoJS.algo.SHA256,
    });
    const encrypted = CryptoJS.AES.encrypt(rawText, key, { iv });
    const envelope = {
      v: 2,
      kdf: "PBKDF2",
      hasher: "SHA256",
      iterations,
      salt: CryptoJS.enc.Hex.stringify(salt),
      iv: CryptoJS.enc.Hex.stringify(iv),
      ciphertext: encrypted.toString(),
    };
    return JSON.stringify(envelope);
  } catch (error) {
    logger.error("❌ Encryption failed:", error);
    throw new Error("Failed to encrypt data.");
  }
};

/**
 * Decrypts an AES-256 encrypted backup string.
 * Auto-detects modern v2 envelope format and transparently falls back to
 * legacy v1 decryption (static salt, 1,000 iterations) for older archives.
 *
 * @param {string} encryptedText - Ciphertext envelope or raw v1 string
 * @param {string} passphrase - User-defined passphrase
 * @returns {Object} Decrypted and parsed payload
 */
export const decryptBackup = (encryptedText, passphrase) => {
  try {
    let envelope = null;
    try {
      envelope = JSON.parse(encryptedText);
    } catch {
      envelope = null;
    }

    if (envelope && envelope.v === 2 && envelope.ciphertext && envelope.salt && envelope.iv) {
      const salt = CryptoJS.enc.Hex.parse(envelope.salt);
      const iv = CryptoJS.enc.Hex.parse(envelope.iv);
      // Clamp iterations to safe boundaries [50,000, 600,000] to prevent DoS or trivial work factor
      const rawIterations = Number(envelope.iterations);
      const iterations = Number.isFinite(rawIterations)
        ? Math.min(Math.max(rawIterations, 50000), 600000)
        : 100000;
      const key = CryptoJS.PBKDF2(passphrase, salt, {
        keySize: 256 / 32,
        iterations,
        hasher: CryptoJS.algo.SHA256,
      });
      const bytes = CryptoJS.AES.decrypt(envelope.ciphertext, key, { iv });
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedText) {
        throw new Error("Invalid password or corrupted file.");
      }
      return JSON.parse(decryptedText);
    }

    // Fallback to legacy v1 format
    const salt = CryptoJS.enc.Hex.parse("4b77657374557053616c745f7632");
    const key = CryptoJS.PBKDF2(passphrase, salt, { keySize: 256 / 32, iterations: 1000 });
    const bytes = CryptoJS.AES.decrypt(encryptedText, key, { iv: salt });
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedText) {
      throw new Error("Invalid password or corrupted file.");
    }
    return JSON.parse(decryptedText);
  } catch (error) {
    logger.error("❌ Decryption failed:", error);
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
    logger.info("✅ Archive exported successfully");
  } finally {
    // Always clean up temp file
    try {
      const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
        logger.debug("🧹 Temp backup file cleaned up");
      }
    } catch (cleanupErr) {
      logger.warn("⚠️ Failed to clean up temp file:", cleanupErr);
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
    logger.error("❌ Failed to read archive file:", err);
    throw new Error("Unable to read archive file. It may be corrupted or inaccessible.");
  }

  onProgress?.(0.15);

  // Step 2: Decrypt and validate payload structure
  let payload;
  try {
    payload = decryptBackup(encryptedText, passphrase);
  } catch {
    // Re-throw with standardized import error message for UI
    throw new Error("INVALID PASSPHRASE OR CORRUPTED ARCHIVE");
  }

  if (!payload?.metadata || !payload?.storage) {
    throw new Error("INVALID PASSPHRASE OR CORRUPTED ARCHIVE");
  }

  logger.info("✅ Archive decrypted. Restoring from version:", payload.metadata.appVersion);
  onProgress?.(0.3);

  // Step 3: Stage the storage swap (recoverable).
  //
  // The previous implementation cleared every existing user key *before*
  // writing the backup, so a crash/OOM between the two steps left the user
  // with neither the old nor the new data (see CONCERNS.md -> "wipe-then-restore
  // import"). We now snapshot the current user data, write the backup over it,
  // verify the write, and only then drop keys the backup no longer contains.
  // Any failure rolls the snapshot back so the device is never left empty.
  const storageEntries = Object.entries(payload.storage);
  const existingKeys = await AsyncStorage.getAllKeys();
  const existingUserKeys = existingKeys.filter(isUserDataKey);
  const snapshotPairs = existingUserKeys.length
    ? await AsyncStorage.multiGet(existingUserKeys)
    : [];
  const snapshot = {};
  for (const [snapKey, snapValue] of snapshotPairs) {
    snapshot[snapKey] = snapValue;
  }

  const rollbackStorage = async (reason) => {
    try {
      const addedKeys = storageEntries.map(([k]) => k).filter((k) => !(k in snapshot));
      if (addedKeys.length > 0) {
        await AsyncStorage.multiRemove(addedKeys);
      }
      if (snapshotPairs.length > 0) {
        await AsyncStorage.multiSet(snapshotPairs);
      }
      logger.warn("↩️ Rolled back AsyncStorage to pre-import snapshot:", reason);
    } catch (rollbackErr) {
      logger.error("❌ AsyncStorage rollback failed:", rollbackErr);
    }
  };

  try {
    // 3a. Write the backup over existing keys — non-destructive until verified.
    if (storageEntries.length > 0) {
      await AsyncStorage.multiSet(storageEntries);
    }

    // 3b. Verify every restored key round-trips before trusting the swap.
    if (storageEntries.length > 0) {
      const verified = await AsyncStorage.multiGet(storageEntries.map(([k]) => k));
      const mismatched = verified.filter(([, value], i) => value !== storageEntries[i][1]);
      if (mismatched.length > 0) {
        throw new Error("Storage verification failed for " + mismatched.length + " key(s)");
      }
    }

    // 3c. Only now remove stale keys that the backup does not contain.
    const nextKeys = new Set(storageEntries.map(([k]) => k));
    const staleKeys = existingUserKeys.filter((k) => !nextKeys.has(k));
    if (staleKeys.length > 0) {
      await AsyncStorage.multiRemove(staleKeys);
      logger.info("🧹 Removed stale AsyncStorage keys:", staleKeys.length);
    }

    logger.info("✅ Restored AsyncStorage:", storageEntries.length, "keys (verified)");
    onProgress?.(0.6);

    // Step 4: Restore vault files from backup
    if (payload.vaults && payload.vaults.length > 0) {
      await ensureVaultsDir();

      for (const vault of payload.vaults) {
        const vaultPath = getVaultPath(vault.id);

        // Ensure vault directory exists
        const vaultInfo = await FileSystem.getInfoAsync(vaultPath);
        if (!vaultInfo.exists) {
          await FileSystem.makeDirectoryAsync(vaultPath, { intermediates: true });
          logger.debug("📂 Created vault directory:", vault.id);
        }

        // Restore each note
        for (const note of vault.notes || []) {
          const { folder, title, content } = note;
          let notePath;

          if (folder && folder !== "Uncategorized") {
            const folderPath = vaultPath + folder + "/";
            const folderInfo = await FileSystem.getInfoAsync(folderPath);
            if (!folderInfo.exists) {
              await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
            }
            notePath = folderPath + title + ".md";
          } else {
            notePath = vaultPath + title + ".md";
          }

          await FileSystem.writeAsStringAsync(notePath, content || "");
        }

        logger.info(
          "✅ Vault '" + vault.name + "' restored: " + (vault.notes || []).length + " notes"
        );
      }
    }
  } catch (importErr) {
    // Recoverable failure: return the device to its pre-import state.
    await rollbackStorage(importErr && importErr.message);
    throw importErr;
  }

  onProgress?.(1.0);
  logger.info("✅ Archive import complete");

  // Step 6: Restore billing data and reschedule bill reminders
  if (payload.billing) {
    const billingToRestore = payload.billing;
    // Cancel stale notification IDs from export device (they won't exist here)
    for (const bill of billingToRestore.recurringBills || []) {
      try {
        await cancelNotifications(bill.notificationIds || []);
      } catch {
        // Safe ignore for foreign notification IDs
      }
      // Reschedule fresh on this device
      const notifId = await scheduleBillReminder(bill, billingToRestore.currency || "₹");
      bill.notificationIds = notifId ? [notifId] : [];
    }
    await saveBillingData(billingToRestore);
    logger.info("✅ Billing data restored and bill reminders rescheduled");
  }
};
