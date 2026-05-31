import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { createVault } from "./vaultService";

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
    console.error("❌ DocumentPicker error:", err);
    return null;
  }

  // User cancelled or no files selected
  if (result.canceled || !result.assets || result.assets.length === 0) {
    console.log("📄 Import cancelled or no files selected");
    return null;
  }

  // Filter to only files with .md or .txt extensions
  const mdFiles = result.assets.filter((asset) => {
    const name = (asset.name || "").toLowerCase();
    return name.endsWith(".md") || name.endsWith(".txt");
  });

  if (mdFiles.length === 0) {
    console.warn("⚠️ No .md or .txt files found in selection");
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

      console.log("📥 Imported file:", safeName, "→", destPath);
    } catch (fileErr) {
      console.error("❌ Failed to import file:", file.name, fileErr);
    }
  }

  console.log(`✅ Import complete — ${mdFiles.length} file(s) imported into vault "${vault.name}"`);
  return vault;
};
