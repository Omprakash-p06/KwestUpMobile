import * as FileSystem from "expo-file-system";

const NOTES_ROOT = `${FileSystem.documentDirectory}Notes/`;

// Ensure root Notes folder exists
export const initNotesFolder = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(NOTES_ROOT);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(NOTES_ROOT, { intermediates: true });
      console.log("📂 Notes root folder initialized at:", NOTES_ROOT);
    }
  } catch (error) {
    console.error("❌ Failed to initialize notes folder:", error);
  }
};

// Write a note directly to the local filesystem
export const saveNoteFile = async (folder, title, content) => {
  try {
    await initNotesFolder();
    
    // Sanitize folder and title
    const sanitizedFolder = (folder || "Uncategorized").trim();
    const sanitizedTitle = (title || "Untitled Note").trim().replace(/[/\\?%*:|"<>. ]/g, "_");
    const folderPath = `${NOTES_ROOT}${sanitizedFolder}/`;
    
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

// Read a note file's content
export const readNoteFile = async (folder, title) => {
  try {
    const sanitizedFolder = (folder || "Uncategorized").trim();
    const sanitizedTitle = (title || "Untitled Note").trim().replace(/[/\\?%*:|"<>. ]/g, "_");
    const filePath = `${NOTES_ROOT}${sanitizedFolder}/${sanitizedTitle}.md`;
    
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      const content = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      return content;
    }
    return "";
  } catch (error) {
    console.error("❌ Failed to read note file:", error);
    return "";
  }
};

// Delete a note file
export const deleteNoteFile = async (folder, title) => {
  try {
    const sanitizedFolder = (folder || "Uncategorized").trim();
    const sanitizedTitle = (title || "Untitled Note").trim().replace(/[/\\?%*:|"<>. ]/g, "_");
    const filePath = `${NOTES_ROOT}${sanitizedFolder}/${sanitizedTitle}.md`;
    
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(filePath);
      console.log("🗑️ Deleted note file:", filePath);
    }
    
    // Clean up empty folder
    const folderPath = `${NOTES_ROOT}${sanitizedFolder}/`;
    const files = await FileSystem.readDirectoryAsync(folderPath);
    if (files.length === 0 && sanitizedFolder !== "Uncategorized") {
      await FileSystem.deleteAsync(folderPath);
      console.log("📂 Cleaned up empty folder:", folderPath);
    }
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to delete note file:", error);
    return { success: false, error };
  }
};

// Load all note files recursively from Document Directory (Obsidian vault-style explorer)
export const getAllNotesFromFilesystem = async () => {
  try {
    await initNotesFolder();
    const notesList = [];
    
    // Read the root directory
    const rootItems = await FileSystem.readDirectoryAsync(NOTES_ROOT);
    
    for (const item of rootItems) {
      const itemPath = `${NOTES_ROOT}${item}`;
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
            
            // Extract tag markers (#tag) from text content dynamically (Notion-style indexing)
            const tags = extractHashtags(content);

            notesList.push({
              id: filePath, // Use file path as unique ID
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
        // It's a markdown file in the root
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

// Utility to parse hashtags (#word) dynamically from markdown content
export const extractHashtags = (text) => {
  if (!text) return [];
  const matches = text.match(/#\w+/g);
  if (!matches) return [];
  // Strip the '#' symbol and return unique tags
  return Array.from(new Set(matches.map((m) => m.substring(1).toLowerCase())));
};

// Wipe all note files and folders on disk (for hard reset)
export const wipeNotesFilesystem = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(NOTES_ROOT);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(NOTES_ROOT, { idempotent: true });
      console.log("🗑️ Wiped entire Notes filesystem vault");
    }
    await initNotesFolder();
  } catch (error) {
    console.error("❌ Failed to wipe notes filesystem:", error);
  }
};

