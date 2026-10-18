// SDK 57: expo-file-system's default export is now the Paths/File/Directory API. This module uses
// the classic documentDirectory/async-function surface, which SDK 54+ relocated to
// 'expo-file-system/legacy' (still fully supported and shipped by expo-file-system@57).
import * as FileSystem from "expo-file-system/legacy";
import { getVaultPath } from "./vaultService";
import { logger } from "./logger";

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
      logger.debug("📂 Vault folder initialized at:", vaultPath);
    }
  } catch (error) {
    logger.error("❌ Failed to initialize vault folder:", error);
  }
};

// ─── Sanitization & Path Helpers ─────────────────────────────────────────────

/**
 * Sanitizes a subfolder name to prevent directory traversal and illegal characters.
 * @param {string} folder
 * @returns {string}
 */
export const sanitizeFolder = (folder) => {
  return (
    (folder || "Uncategorized")
      .trim()
      .replace(/[/\\?%*:|"<>. ]/g, "_")
      .replace(/[\x00-\x1f\x7f]/g, "_")
      .replace(/^\.+$/, "_") || "Uncategorized"
  );
};

/**
 * Sanitizes a note title to form a safe, consistent filename stem.
 * @param {string} title
 * @returns {string}
 */
export const sanitizeTitle = (title) => {
  return (
    (title || "Untitled Note")
      .trim()
      .replace(/[/\\?%*:|"<>. ]/g, "_")
      .replace(/[\x00-\x1f\x7f]/g, "_")
      .replace(/^\.+$/, "_") || "Untitled Note"
  );
};

/**
 * Resolves a collision-free destination path inside folderPath by appending (1), (2), etc.
 * @param {string} folderPath
 * @param {string} filenameWithExt
 * @returns {Promise<string>}
 */
export const resolveUniquePath = async (folderPath, filenameWithExt) => {
  const normalizedFolder = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
  let destPath = `${normalizedFolder}${filenameWithExt}`;
  const info = await FileSystem.getInfoAsync(destPath);
  if (!info.exists) {
    return destPath;
  }

  const dot = filenameWithExt.lastIndexOf(".");
  const stem = dot >= 0 ? filenameWithExt.slice(0, dot) : filenameWithExt;
  const ext = dot >= 0 ? filenameWithExt.slice(dot) : ".md";
  let n = 1;
  while (true) {
    const candidate = `${normalizedFolder}${stem} (${n})${ext}`;
    const cInfo = await FileSystem.getInfoAsync(candidate);
    if (!cInfo.exists) {
      return candidate;
    }
    n += 1;
  }
};

// ─── Core Vault-Parameterized File Operations ─────────────────────────────────

/**
 * Write a note markdown file into a specific vault.
 * @param {string} vaultId
 * @param {string} folder  - Subfolder within the vault (e.g. "Work")
 * @param {string} title   - Note title (will be sanitized into a filename)
 * @param {string} content - Markdown content
 * @param {Object} [options] - Optional settings ({ avoidCollision?: boolean })
 */
export const saveNoteFile = async (vaultId, folder, title, content, options = {}) => {
  try {
    const vaultPath = getVaultPath(vaultId || "default");

    const sanitizedFolder = sanitizeFolder(folder);
    const sanitizedTitle = sanitizeTitle(title);

    const folderPath = `${vaultPath}${sanitizedFolder}/`;

    // Ensure subfolder directory exists
    const folderInfo = await FileSystem.getInfoAsync(folderPath);
    if (!folderInfo.exists) {
      await FileSystem.makeDirectoryAsync(folderPath, { intermediates: true });
    }

    let filePath = `${folderPath}${sanitizedTitle}.md`;
    if (options && options.avoidCollision) {
      filePath = await resolveUniquePath(folderPath, `${sanitizedTitle}.md`);
    }

    await FileSystem.writeAsStringAsync(filePath, content || "", {
      encoding: FileSystem.EncodingType.UTF8,
    });
    logger.debug("💾 Saved note file to:", filePath);
    return { success: true, filePath };
  } catch (error) {
    logger.error("❌ Failed to save note file:", error);
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
    const sanitizedFolder = sanitizeFolder(folder);
    const sanitizedTitle = sanitizeTitle(title);

    const filePath = `${vaultPath}${sanitizedFolder}/${sanitizedTitle}.md`;

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      return await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }
    return "";
  } catch (error) {
    logger.error("❌ Failed to read note file:", error);
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
    const sanitizedFolder = sanitizeFolder(folder);
    const sanitizedTitle = sanitizeTitle(title);

    const filePath = `${vaultPath}${sanitizedFolder}/${sanitizedTitle}.md`;

    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
      logger.debug("🗑️ Deleted note file:", filePath);
    }

    // Clean up empty folder
    const folderPath = `${vaultPath}${sanitizedFolder}/`;
    const folderInfo = await FileSystem.getInfoAsync(folderPath);
    if (folderInfo.exists) {
      const files = await FileSystem.readDirectoryAsync(folderPath);
      if (files.length === 0 && sanitizedFolder !== "Uncategorized") {
        await FileSystem.deleteAsync(folderPath);
        logger.debug("📂 Cleaned up empty folder:", folderPath);
      }
    }
    return { success: true };
  } catch (error) {
    logger.error("❌ Failed to delete note file:", error);
    return { success: false, error };
  }
};

/**
 * Delete an entire folder and all notes inside it from a specific vault.
 * @param {string} vaultId
 * @param {string} folder
 */
export const deleteFolderFile = async (vaultId, folder) => {
  try {
    const vaultPath = getVaultPath(vaultId || "default");
    const sanitizedFolder = sanitizeFolder(folder);
    if (sanitizedFolder === "Uncategorized") {
      return { success: false, error: "Cannot delete Uncategorized folder" };
    }

    const folderPath = `${vaultPath}${sanitizedFolder}/`;
    const folderInfo = await FileSystem.getInfoAsync(folderPath);
    if (folderInfo.exists) {
      await FileSystem.deleteAsync(folderPath, { idempotent: true });
      logger.debug("🗑️ Deleted folder from disk:", folderPath);
    }
    return { success: true };
  } catch (error) {
    logger.error("❌ Failed to delete folder:", error);
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
    logger.error("❌ Failed to scan notes filesystem:", error);
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
      logger.debug("🗑️ Wiped vault filesystem:", vaultPath);
    }
    // Re-create the empty vault directory
    await FileSystem.makeDirectoryAsync(vaultPath, { intermediates: true });
  } catch (error) {
    logger.error("❌ Failed to wipe vault filesystem:", error);
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
