import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { createVault } from "./vaultService";
import { logger } from "./logger";

/**
 * Opens the system file picker, allows the user to select one or more
 * .md (or .txt) files, creates a new vault with the given name, and
 * copies all selected files into it.
 *
 * @param {string} [vaultName] - Optional name for the new vault. Defaults to "Imported".
 * @returns {Promise<VaultConfig|null>} The newly created vault config, or null if cancelled.
 */
export const importMDFilesAsVault = async (vaultName) => {
  const MAX_FILES = 50;
  const MAX_FILE_BYTES = 1024 * 1024; // 1 MB per file
  let nameCounter = 0;
  let result;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: ["text/markdown", "text/plain", "application/octet-stream"],
      multiple: true,
      copyToCacheDirectory: true,
    });
  } catch (err) {
    logger.error("DocumentPicker: picker failed to open", { error: err });
    return null;
  }

  // User cancelled or no files selected
  if (result.canceled || !result.assets || result.assets.length === 0) {
    logger.debug("DocumentPicker: import cancelled by user");
    return null;
  }

  // Filter to only files with .md or .txt extensions
  const mdFiles = result.assets.filter((asset) => {
    const name = (asset.name || "").toLowerCase();
    return name.endsWith(".md") || name.endsWith(".txt");
  });

  if (mdFiles.length === 0) {
    logger.warn("DocumentPicker: no markdown files in selection", {
      assetCount: result.assets?.length ?? 0,
    });
    return null;
  }

  if (mdFiles.length > MAX_FILES) {
    logger.warn("DocumentPicker: too many files selected", { assetCount: mdFiles.length, max: MAX_FILES });
    return null;
  }

  // Create the vault
  const vault = await createVault(vaultName || "Imported");
  const vaultBase = String(vault.path).replace(/\/?$/, '/');

  // Copy each file into the vault root
  for (const file of mdFiles) {
    try {
      if (typeof file.size === 'number' && file.size > MAX_FILE_BYTES) {
        logger.warn("DocumentPicker: file too large, skipped", { name: file.name, size: file.size });
        continue;
      }
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Sanitize filename: remove path separators, keep original name
      const rawName = file.name || `note_${Date.now()}_${(nameCounter += 1)}_${Math.floor(Math.random() * 1e6)}.md`;
      const safeName = rawName
        .replace(/[/\\?%*:|"<>]/g, "_")
        .replace(/[\x00-\x1f\x7f]/g, "_")
        .replace(/^\.+$/, "_")
        .slice(0, 128) || `note_${Date.now()}_${(nameCounter += 1)}.md`;

      let destPath = `${vaultBase}${safeName}`;
      // Never overwrite on collision — append (1), (2), ... suffix
      const info = await FileSystem.getInfoAsync(destPath);
      if (info.exists) {
        const dot = safeName.lastIndexOf('.');
        const stem = dot >= 0 ? safeName.slice(0, dot) : safeName;
        const ext = dot >= 0 ? safeName.slice(dot) : '.md';
        let n = 1;
        while (true) {
          const candidate = `${vaultBase}${stem} (${n})${ext}`;
          const cInfo = await FileSystem.getInfoAsync(candidate);
          if (!cInfo.exists) {
            destPath = candidate;
            break;
          }
          n += 1;
        }
      }
      await FileSystem.writeAsStringAsync(destPath, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      logger.debug("DocumentPicker: file written to vault");
    } catch (fileErr) {
      logger.error("DocumentPicker: failed to write file to vault", { error: fileErr });
    }
  }

  logger.info("DocumentPicker: import complete", { fileCount: mdFiles.length });
  return vault;
};
