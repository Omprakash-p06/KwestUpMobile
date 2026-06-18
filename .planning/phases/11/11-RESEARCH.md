# Phase 11: Encrypted Data Export & Import - Research

**Researched:** 2026-06-17  
**Domain:** Encrypted Data Archiving, Local File Export/Import, AES-256 Passphrase Encryption  
**Confidence:** HIGH

---

## Summary

This phase implements a complete, secure data export and import pipeline for KwestUp Mobile. It allows users to pack all application state (including multi-vault markdown notes, folder directories, task lists, tasks, birthdays, and user preferences) into a single encrypted file with a `.kwestup` extension, protected by an AES-256 user-defined passphrase.

To maintain perfect compatibility with Expo Go and avoid complex native linking errors, we package the workspace contents into a unified JSON format, encrypt it with `crypto-js`, write it to the native filesystem, and export it using `expo-sharing`.

---

## Standard Stack

The following libraries form the standard implementation stack:

1. **`crypto-js`** (v4.2.0 or latest)  
   - *Purpose*: Pure JavaScript implementation of cryptographic standards. Used for AES-256 encryption and decryption of the serialized JSON backup string.  
   - *Advantage*: Completely platform-independent, requiring zero native dependencies or pod installations.  
   - *Command*: `npm install crypto-js`
2. **`expo-sharing`** (from Expo SDK)  
   - *Purpose*: Access the platform's native share dialog. Used to prompt the user to save the exported `.kwestup` file (e.g., Save to Files, Email, Drive).  
   - *Command*: `npx expo install expo-sharing`
3. **`expo-document-picker`** (already installed)  
   - *Purpose*: Allow users to select a `.kwestup` backup file from their device during import.

---

## Architecture Patterns

### 1. Unified JSON Archive Format (`.kwestup`)
Instead of introducing complex zip/compression native dependencies (such as `react-native-zip-archive` which are unstable under Expo Go), the entire workspace is packaged as a single JSON object before encryption:
```json
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2026-06-17T00:00:00.000Z",
    "appVersion": "v3.0.1"
  },
  "storage": {
    "kwestup_userName_v6.0": "User Name",
    "kwestup_theme_mode_v6.0": "dark",
    "kwestup_theme_name_v6.0": "dribbble",
    "kwestup_data_v6.0": "...",
    "kwestup_vaults_v5.0": "[...]"
  },
  "vaults": [
    {
      "id": "default",
      "name": "My Vault",
      "notes": [
        {
          "folder": "Work",
          "title": "Tasks",
          "content": "# Tasks\n- [ ] Fix bug"
        }
      ]
    }
  ]
}
```

### 2. Export Pipeline Flow
1. **Collect Data**: Query all active data keys from `AsyncStorage` (using `isUserDataKey` helper) and read their values.
2. **Traverse Vaults**: Read the vault definitions. For each vault, recursively scan its folders and files using `FileSystem` to extract note titles, folders, and markdown contents.
3. **Serialize & Encrypt**: Convert the payload to a JSON string. Encrypt the string using AES-256 with the user's password.
4. **Write & Share**: Save the encrypted string to a temporary file in the Expo cache directory and share it via `expo-sharing`. Clean up the temporary file immediately after sharing.

### 3. Import Pipeline Flow
1. **Document Selection**: Pick file using `expo-document-picker`.
2. **Decrypt & Validate**: Read the file, prompt the user for the passphrase, decrypt via `CryptoJS.AES.decrypt`, and parse the JSON string.
3. **Confirm Actions**: Show a warning prompt confirming that the import will overwrite all existing data.
4. **Clear Existing State**: Clear current AsyncStorage data keys and wipe notes folders.
5. **Restore State**:
   - Re-populate AsyncStorage with the backed-up keys.
   - For each vault in the backup, re-create directories and write markdown notes back to the local device storage.
   - Force reload the application state.

---

## Don't Hand-Roll

- **Do NOT hand-roll AES encryption**: Always use `CryptoJS.AES` which follows standard OpenSSL KDF parameters (PBKDF2 key derivation with random salt, PKCS#7 padding, and CBC mode).
- **Do NOT manually walk filesystem without safety checks**: Use `FileSystem.getInfoAsync` to confirm directories exist before writing.

---

## Common Pitfalls

- **Incorrect Password Decryption**: `crypto-js` returns empty bytes or a corrupted output string if decrypted with an incorrect password. Always wrap JSON parsing in a try-catch and handle errors gracefully.
- **Large Vault Performance**: Serializing and encrypting text takes minimal time, but reading large files sequentially can block the JS thread. Use `Promise.all` or process files in batches when scanning files.
- **Cache Directory Bloat**: Temporary backup files should be deleted from `FileSystem.cacheDirectory` after export completes or fails.

---

## Code Examples

### 1. Data Encryption Helper
```javascript
import CryptoJS from "crypto-js";

export const encryptBackup = (payloadObj, passphrase) => {
  try {
    const rawText = JSON.stringify(payloadObj);
    return CryptoJS.AES.encrypt(rawText, passphrase).toString();
  } catch (error) {
    console.error("❌ Encryption failed:", error);
    throw new Error("Failed to encrypt data.");
  }
};
```

### 2. Data Decryption Helper
```javascript
export const decryptBackup = (encryptedText, passphrase) => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, passphrase);
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
```

### 3. Vault & Filesystem Packager
```javascript
import * as FileSystem from "expo-file-system";
import { getVaults, getVaultPath } from "./vaultService";

export const packVaults = async () => {
  const vaults = await getVaults();
  const packedVaults = [];

  for (const vault of vaults) {
    const notes = [];
    const vaultPath = getVaultPath(vault.id);
    const vaultInfo = await FileSystem.getInfoAsync(vaultPath);

    if (vaultInfo.exists) {
      const rootItems = await FileSystem.readDirectoryAsync(vaultPath);
      for (const item of rootItems) {
        const itemPath = `${vaultPath}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);

        if (itemInfo.isDirectory) {
          const files = await FileSystem.readDirectoryAsync(`${itemPath}/`);
          for (const file of files) {
            if (file.endsWith(".md")) {
              const content = await FileSystem.readAsStringAsync(`${itemPath}/${file}`);
              notes.push({
                folder: item,
                title: file.replace(".md", ""),
                content,
              });
            }
          }
        } else if (item.endsWith(".md")) {
          const content = await FileSystem.readAsStringAsync(itemPath);
          notes.push({
            folder: "Uncategorized",
            title: item.replace(".md", ""),
            content,
          });
        }
      }
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
```
