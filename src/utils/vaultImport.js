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

  // Create the vault
  const vault = await createVault(vaultName || "Imported");

  // Copy each file into the vault root
  for (const file of mdFiles) {
    try {
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Sanitize filename: remove path separators, keep original name
      const safeName = (file.name || `note_${Date.now()}.md`)
        .replace(/[/\\?%*:|"<>]/g, "_");

      const destPath = `${vault.path}${safeName}`;
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
