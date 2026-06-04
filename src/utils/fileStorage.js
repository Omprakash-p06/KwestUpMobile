import * as FileSystem from "expo-file-system";
import { getVaultPath } from "./vaultService";

// ─── Folder Initialization ────────────────────────────────────────────────────

/**
 * Ensures the given vault's directory exists on disk.
 * @param {string} vaultId
 */
export const initNotesFolder = async (vaultId) => {
  try {
    const vaultPath = getVaultPath(vaultId || "default");
    const dirInfo = await FileSystem.getInfoAsync(vaultPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(vaultPath, { intermediates: true });
      console.log("📂 Vault folder initialized at:", vaultPath);
    }
  } catch (error) {
    console.error("❌ Failed to initialize vault folder:", error);
  }
};

// ─── Core Vault-Parameterized File Operations ─────────────────────────────────

/**
 * Write a note markdown file into a specific vault.
 * @param {string} vaultId
 * @param {string} folder  - Subfolder within the vault (e.g. "Work")
 * @param {string} title   - Note title (will be sanitized into a filename)
 * @param {string} content - Markdown content
 */
export const saveNoteFile = async (vaultId, folder, title, content) => {
  try {
    const vaultPath = getVaultPath(vaultId || "default");

    // Sanitize folder and title
    const sanitizedFolder = (folder || "Uncategorized").trim();
    const sanitizedTitle = (title || "Untitled Note")
      .trim()
      .replace(/[/\\?%*:|"<>. ]/g, "_");

    const folderPath = `${vaultPath}${sanitizedFolder}/`;

    // Ensure subfolder directory exists
    const folderInfo = await FileSystem.getInfoAsync(folderPath);
    if (!folderInfo.exists) {
      await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
    }

    const filePath = `${folderPath}${sanitizedTitle}.md`;
    await FileSystem.writeAsStringAsync(filePath, content || "", {
      encoding: FileSystem.EncodingType.UTF8,
    });
    console.log("💾 Saved note file to:", filePath);
    return { success: true, filePath };
  } catch (error) {
    console.error("❌ Failed to save note file:", error);
    return { success: false, error };
  }
};

/**
 * Read a note file's content from a specific vault.
 * @param {string} vaultId
 * @param {string} folder
 * @param {string} title
 * @returns {Promise<string>}
 */
export const readNoteFile = async (vaultId, folder, title) => {
  try {
    const vaultPath = getVaultPath(vaultId || "default");
    const sanitizedFolder = (folder || "Uncategorized").trim();
    const sanitizedTitle = (title || "Untitled Note")
      .trim()
      .replace(/[/\\?%*:|"<>. ]/g, "_");

    const filePath = `${vaultPath}${sanitizedFolder}/${sanitizedTitle}.md`;

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      return await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
    return "";
  } catch (error) {
    console.error("❌ Failed to read note file:", error);
    return "";
  }
};

/**
 * Delete a note file from a specific vault. Cleans up empty sub-folders.
 * @param {string} vaultId
 * @param {string} folder
 * @param {string} title
 */
export const deleteNoteFile = async (vaultId, folder, title) => {
  try {
    const vaultPath = getVaultPath(vaultId || "default");
    const sanitizedFolder = (folder || "Uncategorized").trim();
    const sanitizedTitle = (title || "Untitled Note")
      .trim()
      .replace(/[/\\?%*:|"<>. ]/g, "_");

    const filePath = `${vaultPath}${sanitizedFolder}/${sanitizedTitle}.md`;

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
      console.log("🗑️ Deleted note file:", filePath);
    }

    // Clean up empty folder
    const folderPath = `${vaultPath}${sanitizedFolder}/`;
    const folderInfo = await FileSystem.getInfoAsync(folderPath);
    if (folderInfo.exists) {
      const files = await FileSystem.readDirectoryAsync(folderPath);
      if (files.length === 0 && sanitizedFolder !== "Uncategorized") {
        await FileSystem.deleteAsync(folderPath);
        console.log("📂 Cleaned up empty folder:", folderPath);
      }
    }
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to delete note file:", error);
    return { success: false, error };
  }
};

/**
 * Scan all note files in the given vault (vault vault-style explorer).
 * Returns only files/folders directly inside the vault path — does NOT
 * recurse into nested Vaults/ subdirectories.
 * @param {string} vaultId
 * @returns {Promise<Array>}
 */
export const getAllNotesFromFilesystem = async (vaultId) => {
  try {
    const vaultPath = getVaultPath(vaultId || "default");

    // Ensure the vault directory exists
    const vaultInfo = await FileSystem.getInfoAsync(vaultPath);
    if (!vaultInfo.exists) {
      await FileSystem.makeDirectoryAsync(vaultPath, { intermediates: true });
      return [];
    }

    const notesList = [];
    const rootItems = await FileSystem.readDirectoryAsync(vaultPath);

    for (const item of rootItems) {
      const itemPath = `${vaultPath}${item}`;
      const itemInfo = await FileSystem.getInfoAsync(itemPath);

      if (itemInfo.isDirectory) {
        // It's a folder (e.g. Work, Personal)
        const folderFiles = await FileSystem.readDirectoryAsync(`${itemPath}/`);
        for (const file of folderFiles) {
          if (file.endsWith(".md")) {
            const filePath = `${itemPath}/${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            const content = await FileSystem.readAsStringAsync(filePath, {
              encoding: FileSystem.EncodingType.UTF8,
            });

            const tags = extractHashtags(content);

            notesList.push({
              id: filePath,
              title: file.replace(".md", "").replace(/_/g, " "),
              content,
              folder: item,
              tags: tags.join(", "),
              createdAt: new Date(fileInfo.modificationTime * 1000).toISOString(),
              updatedAt: new Date(fileInfo.modificationTime * 1000).toISOString(),
            });
          }
        }
      } else if (item.endsWith(".md")) {
        // It's a markdown file in the vault root
        const content = await FileSystem.readAsStringAsync(itemPath, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const tags = extractHashtags(content);

        notesList.push({
          id: itemPath,
          title: item.replace(".md", "").replace(/_/g, " "),
          content,
          folder: "Uncategorized",
          tags: tags.join(", "),
          createdAt: new Date(itemInfo.modificationTime * 1000).toISOString(),
          updatedAt: new Date(itemInfo.modificationTime * 1000).toISOString(),
        });
      }
    }

    return notesList;
  } catch (error) {
    console.error("❌ Failed to scan notes filesystem:", error);
    return [];
  }
};

/**
 * Wipe all note files in the specified vault directory (for hard reset / sync).
 * Only deletes the vault's own content — does NOT delete other vaults.
 * @param {string} vaultId
 */
export const wipeNotesFilesystem = async (vaultId) => {
  try {
    const vaultPath = getVaultPath(vaultId || "default");
    const dirInfo = await FileSystem.getInfoAsync(vaultPath);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(vaultPath, { idempotent: true });
      console.log("🗑️ Wiped vault filesystem:", vaultPath);
    }
    // Re-create the empty vault directory
    await FileSystem.makeDirectoryAsync(vaultPath, { intermediates: true });
  } catch (error) {
    console.error("❌ Failed to wipe vault filesystem:", error);
  }
};

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Parse hashtags (#word) dynamically from markdown content.
 * @param {string} text
 * @returns {string[]}
 */
export const extractHashtags = (text) => {
  if (!text) return [];
  const matches = text.match(/#\w+/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.substring(1).toLowerCase())));
};

// ─── Backward-Compatible Active-Vault Wrappers ────────────────────────────────
// These wrappers resolve the active vault dynamically, so callers that haven't
// been updated to pass an explicit vaultId still work correctly.

export const saveNoteToActiveVault = async (folder, title, content) => {
  const { getActiveVaultId: fetchActiveId } = await import("./vaultService");
  const activeId = (await fetchActiveId()) || "default";
  return saveNoteFile(activeId, folder, title, content);
};

export const readNoteFromActiveVault = async (folder, title) => {
  const { getActiveVaultId: fetchActiveId } = await import("./vaultService");
  const activeId = (await fetchActiveId()) || "default";
  return readNoteFile(activeId, folder, title);
};

export const deleteNoteFromActiveVault = async (folder, title) => {
  const { getActiveVaultId: fetchActiveId } = await import("./vaultService");
  const activeId = (await fetchActiveId()) || "default";
  return deleteNoteFile(activeId, folder, title);
};

export const getAllNotesFromActiveVault = async () => {
  const { getActiveVaultId: fetchActiveId } = await import("./vaultService");
  const activeId = (await fetchActiveId()) || "default";
  return getAllNotesFromFilesystem(activeId);
};

export const wipeActiveVault = async () => {
  const { getActiveVaultId: fetchActiveId } = await import("./vaultService");
  const activeId = (await fetchActiveId()) || "default";
  return wipeNotesFilesystem(activeId);
};
