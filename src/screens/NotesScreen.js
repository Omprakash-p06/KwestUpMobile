import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ImageBackground,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Modal from "react-native-modal";
import * as Haptics from "expo-haptics";
import {
  saveNoteFile,
  deleteNoteFile,
  getAllNotesFromFilesystem,
  extractHashtags,
} from "../utils/fileStorage";
import { createVault, deleteVault, renameVault, getVaults, getActiveVaultId } from "../utils/vaultService";
import { importMDFilesAsVault } from "../utils/vaultImport";
import { AIAssistant } from "../components/AIAssistant";
import { LiquidGlassCard } from "../components/LiquidGlassCard";

export const NotesScreen = ({
  currentTheme,
  notes = [],
  setNotes,
  showConfirmation,
  tasks = [],
  setTasks,
  vaults = [],
  setVaults,
  activeVaultId,
  handleSetActiveVault,
  activeNote,
  setActiveNote,
  onTaskCreated,
  onBirthdayCreated,
}) => {
  const [activeFolder, setActiveFolder] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("All");

  // Current active note state passed from App.js
  const selectedNote = activeNote;
  const setSelectedNote = setActiveNote;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editFolder, setEditFolder] = useState("Uncategorized");
  const [editTags, setEditTags] = useState("");

  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [editorTab, setEditorTab] = useState("edit"); // "edit" | "preview"

  // ─── Vault UI State ─────────────────────────────────────────────────────────
  const [isVaultSwitcherVisible, setIsVaultSwitcherVisible] = useState(false);
  const [isCreateVaultModalVisible, setIsCreateVaultModalVisible] = useState(false);
  const [isRenameVaultModalVisible, setIsRenameVaultModalVisible] = useState(false);
  const [renameVaultId, setRenameVaultId] = useState(null);
  const [renameVaultNameInput, setRenameVaultNameInput] = useState("");
  const [newVaultName, setNewVaultName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  // ────────────────────────────────────────────────────────────────────────────

  // 1. Folders extraction
  const folders = useMemo(() => {
    const list = new Set(["Uncategorized"]);
    notes.forEach((note) => {
      if (note.folder) list.add(note.folder);
    });
    return Array.from(list);
  }, [notes]);

  // 2. Tags extraction
  const tags = useMemo(() => {
    const list = new Set();
    notes.forEach((note) => {
      if (note.tags) {
        note.tags.split(",").forEach((tag) => {
          const trimmed = tag.trim().toLowerCase();
          if (trimmed) list.add(trimmed);
        });
      }
    });
    return Array.from(list);
  }, [notes]);

  // 3. Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesFolder = activeFolder === "All" || note.folder === activeFolder;
      const matchesSearch =
        searchQuery === "" ||
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesTag = true;
      if (selectedTag !== "All") {
        matchesTag =
          note.tags &&
          note.tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .includes(selectedTag);
      }

      return matchesFolder && matchesSearch && matchesTag;
    });
  }, [notes, activeFolder, searchQuery, selectedTag]);

  // 4. CRUD handlers
  const handleCreateNote = async () => {
    const defaultFolder = activeFolder === "All" ? "Uncategorized" : activeFolder;
    let title = "Untitled Note";
    let counter = 1;
    while (notes.some((n) => n.folder === defaultFolder && n.title === title)) {
      title = `Untitled Note ${counter}`;
      counter++;
    }

    const result = await saveNoteFile(activeVaultId, defaultFolder, title, "");
    if (result.success) {
      const freshNotes = await getAllNotesFromFilesystem(activeVaultId);
      setNotes(freshNotes);
      const newNote = freshNotes.find((n) => n.id === result.filePath) || {
        id: result.filePath,
        title,
        content: "",
        folder: defaultFolder,
        tags: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSelectedNote(newNote);
      setEditTitle(title);
      setEditContent("");
      setEditFolder(defaultFolder);
      setEditTags("");
      setIsEditing(true);
      setEditorTab("edit");
    } else {
      Alert.alert("Error", "Failed to create note file on local disk.");
    }
  };

  const handleSelectNote = (note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditFolder(note.folder || "Uncategorized");
    setEditTags(note.tags || "");
    setIsEditing(true);
    setEditorTab("preview"); // View mode by default
    setIsSidebarVisible(false); // Close sidebar for maximum note-taking space
  };

  const handleSaveNote = async () => {
    if (!editTitle.trim()) {
      Alert.alert("Title Required", "Please enter a title for your note.");
      return;
    }

    const oldFolder = (selectedNote.folder || "Uncategorized").trim();
    const oldTitle = (selectedNote.title || "Untitled Note").trim();
    const newFolder = (editFolder || "Uncategorized").trim();
    const newTitle = (editTitle || "Untitled Note").trim();

    const oldSanitizedTitle = oldTitle.replace(/[/\\?%*:|"<>. ]/g, "_");
    const newSanitizedTitle = newTitle.replace(/[/\\?%*:|"<>. ]/g, "_");

    const pathChanged = oldFolder !== newFolder || oldSanitizedTitle !== newSanitizedTitle;

    if (pathChanged && notes.some((n) => n.folder === newFolder && n.title.replace(/[/\\?%*:|"<>. ]/g, "_") === newSanitizedTitle && n.id !== selectedNote.id)) {
      Alert.alert("Conflict", "A note with this title already exists in the selected folder.");
      return;
    }

    if (pathChanged) {
      await deleteNoteFile(activeVaultId, selectedNote.folder, selectedNote.title);
    }

    const result = await saveNoteFile(activeVaultId, editFolder, editTitle, editContent);
    if (result.success) {
      const freshNotes = await getAllNotesFromFilesystem(activeVaultId);
      setNotes(freshNotes);
      const savedNote = freshNotes.find((n) => n.id === result.filePath) || {
        id: result.filePath,
        title: editTitle,
        content: editContent,
        folder: editFolder,
        tags: extractHashtags(editContent).join(", "),
        createdAt: selectedNote.createdAt,
        updatedAt: new Date().toISOString(),
      };
      setSelectedNote(savedNote);
      setIsEditing(false);
    } else {
      Alert.alert("Error", "Failed to save the note to local disk.");
    }
  };

  const handleDeleteNote = (id) => {
    showConfirmation("Are you sure you want to delete this note?", async () => {
      if (selectedNote) {
        await deleteNoteFile(activeVaultId, selectedNote.folder, selectedNote.title);
      }
      const freshNotes = await getAllNotesFromFilesystem(activeVaultId);
      setNotes(freshNotes);
      setSelectedNote(null);
      setIsEditing(false);
    });
  };

  // auto-save auto-save with 1s debounce
  useEffect(() => {
    if (!selectedNote || !isEditing || editorTab !== "edit") return;
    if (editContent === selectedNote.content) return;

    const delayDebounceFn = setTimeout(async () => {
      const currentSanitizedTitle = (selectedNote.title || "Untitled Note").trim().replace(/[/\\?%*:|"<>. ]/g, "_");
      const editingSanitizedTitle = (editTitle || "Untitled Note").trim().replace(/[/\\?%*:|"<>. ]/g, "_");

      if (
        (editFolder || "Uncategorized").trim() === (selectedNote.folder || "Uncategorized").trim() &&
        editingSanitizedTitle === currentSanitizedTitle
      ) {
        console.log("⏱️ Debounced Auto-saving note to local disk...");
        const result = await saveNoteFile(activeVaultId, selectedNote.folder, selectedNote.title, editContent);
        if (result.success) {
          setNotes((prevNotes) =>
            prevNotes.map((n) =>
              n.id === selectedNote.id
                ? {
                    ...n,
                    content: editContent,
                    tags: extractHashtags(editContent).join(", "),
                    updatedAt: new Date().toISOString(),
                  }
                : n
            )
          );
        }
      }
    }, 1000);

    return () => clearTimeout(delayDebounceFn);
  }, [editContent]);

  // Tab toggling with auto-save
  const handleToggleTab = async (tab) => {
    if (tab === "preview" && editorTab === "edit") {
      await handleSaveNote();
    }
    setEditorTab(tab);
  };

  // Back navigation with auto-save
  const handleBack = async () => {
    if (isEditing && editorTab === "edit") {
      await handleSaveNote();
    }
    setSelectedNote(null);
    setIsEditing(false);
    setIsSidebarVisible(true); // Restore sidebar on returning to list
  };

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    setActiveFolder(newFolderName.trim());
    setIsFolderModalVisible(false);
    setNewFolderName("");
  };

  // 5. Markdown Helper shortcuts
  const insertMarkdown = (syntax) => {
    setEditContent((prev) => prev + syntax);
  };

  const toggleMarkdownCheckbox = async (lineIndex) => {
    const lines = (editContent || selectedNote.content || "").split("\n");
    const targetLine = lines[lineIndex];
    if (!targetLine) return;
    
    const uncheckedRegex = /^(\s*[-*]\s*)\[\s*\]\s*(.*)$/;
    const checkedRegex = /^(\s*[-*]\s*)\[[xX]\]\s*(.*)$/;
    
    if (uncheckedRegex.test(targetLine)) {
      lines[lineIndex] = targetLine.replace(uncheckedRegex, "$1[x] $2");
    } else if (checkedRegex.test(targetLine)) {
      lines[lineIndex] = targetLine.replace(checkedRegex, "$1[ ] $2");
    } else {
      return;
    }
    
    const newContent = lines.join("\n");
    setEditContent(newContent);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const result = await saveNoteFile(activeVaultId, editFolder || selectedNote.folder, editTitle || selectedNote.title, newContent);
    if (result.success) {
      const freshNotes = await getAllNotesFromFilesystem(activeVaultId);
      setNotes(freshNotes);
      const savedNote = freshNotes.find((n) => n.id === result.filePath) || {
        id: result.filePath,
        title: editTitle || selectedNote.title,
        content: newContent,
        folder: editFolder || selectedNote.folder,
        tags: extractHashtags(newContent).join(", "),
        createdAt: selectedNote.createdAt,
        updatedAt: new Date().toISOString(),
      };
      setSelectedNote(savedNote);
    }
  };

  // 6. Local Markdown parser
  const renderMarkdown = (text) => {
    if (!text) {
      return (
        <Text style={[styles.emptyContentText, { color: currentTheme.secondaryText }]}>
          {'No content yet. Click "Edit" to write something!'}
        </Text>
      );
    }

    const lines = text.split("\n");
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith("# ")) {
        return (
          <Text key={index} style={[styles.h1, { color: currentTheme.text }]}>
            {line.substring(2)}
          </Text>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <Text key={index} style={[styles.h2, { color: currentTheme.text }]}>
            {line.substring(3)}
          </Text>
        );
      }
      if (line.startsWith("### ")) {
        return (
          <Text key={index} style={[styles.h3, { color: currentTheme.text }]}>
            {line.substring(4)}
          </Text>
        );
      }

      // Checkboxes / Tasks (with support for indentation and * or - bullets)
      const uncheckedMatch = line.match(/^(\s*[-*]\s*)\[\s*\]\s*(.*)$/);
      if (uncheckedMatch) {
        const indent = uncheckedMatch[1];
        const taskText = uncheckedMatch[2];
        const indentWidth = (indent.match(/ /g) || []).length * 4;
        return (
          <View key={index} style={[styles.mdTodoRow, { paddingLeft: Math.max(0, indentWidth) }]}>
            <TouchableOpacity
              onPress={() => toggleMarkdownCheckbox(index)}
              activeOpacity={0.7}
              style={[styles.industrialUncheckedBox, { borderColor: currentTheme.primary }]}
            />
            <Text style={[styles.mdTodoText, { color: currentTheme.text }]}>
              {taskText}
            </Text>
          </View>
        );
      }

      const checkedMatch = line.match(/^(\s*[-*]\s*)\[[xX]\]\s*(.*)$/);
      if (checkedMatch) {
        const indent = checkedMatch[1];
        const taskText = checkedMatch[2];
        const indentWidth = (indent.match(/ /g) || []).length * 4;
        const xColor = currentTheme.onPrimary;
        return (
          <View key={index} style={[styles.mdTodoRow, { paddingLeft: Math.max(0, indentWidth) }]}>
            <TouchableOpacity
              onPress={() => toggleMarkdownCheckbox(index)}
              activeOpacity={0.7}
              style={[styles.industrialCheckedBox, { backgroundColor: currentTheme.primary, borderColor: currentTheme.primary }]}
            >
              <MaterialCommunityIcons name="close" size={12} color={xColor} style={{ fontWeight: "bold" }} />
            </TouchableOpacity>
            <Text style={[styles.mdTodoText, styles.mdTodoDone, { color: currentTheme.secondaryText }]}>
              {taskText}
            </Text>
          </View>
        );
      }

      // Bullet points
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <View key={index} style={styles.mdBulletRow}>
            <Text style={[styles.bullet, { color: currentTheme.primary }]}>•</Text>
            <Text style={[styles.mdBulletText, { color: currentTheme.text }]}>
              {line.substring(2)}
            </Text>
          </View>
        );
      }

      // Regular Paragraph with Bold/Italic formatting
      return (
        <Text key={index} style={[styles.paragraph, { color: currentTheme.text }]}>
          {parseInlineMarkdown(line)}
        </Text>
      );
    });
  };

  const parseInlineMarkdown = (text) => {
    const parts = [];
    let currentIdx = 0;

    // Simple regex parser for bold (**) and italic (*)
    const regex = /(\*\*|__)(.*?)\1|(\*)(.*?)\3/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchIdx = match.index;
      
      // Add plain text before match
      if (matchIdx > currentIdx) {
        parts.push(text.substring(currentIdx, matchIdx));
      }

      if (match[1]) {
        // Bold
        parts.push(
          <Text key={matchIdx} style={styles.boldText}>
            {match[2]}
          </Text>
        );
      } else if (match[3]) {
        // Italic
        parts.push(
          <Text key={matchIdx} style={styles.italicText}>
            {match[4]}
          </Text>
        );
      }

      currentIdx = regex.lastIndex;
    }

    if (currentIdx < text.length) {
      parts.push(text.substring(currentIdx));
    }

    return parts.length > 0 ? parts : text;
  };

  const renderTactileSheet = (contentChildren) => {
    const isDark = currentTheme.background === "#131313";
    const isAmoled = currentTheme.background === "#000000";
    const isLightNotePaper = !isDark && !isAmoled;

    let cardTextureUrl = null;
    if (isLightNotePaper) {
      cardTextureUrl = "https://www.transparenttextures.com/patterns/lined-paper.png";
    } else if (isDark) {
      cardTextureUrl = "https://www.transparenttextures.com/patterns/brushed-alum-dark.png";
    }

    const cardStyles = {
      flex: 1,
      backgroundColor: currentTheme.cardBackground,
      borderRadius: 0,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderTopColor: isLightNotePaper ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.18)",
      borderLeftColor: isLightNotePaper ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.18)",
      borderBottomColor: isLightNotePaper ? "rgba(0, 0, 0, 0.22)" : "rgba(0, 0, 0, 0.75)",
      borderRightColor: isLightNotePaper ? "rgba(0, 0, 0, 0.22)" : "rgba(0, 0, 0, 0.75)",
      margin: 10,
      overflow: "hidden",
    };

    if (isAmoled) {
      cardStyles.borderWidth = 1;
      cardStyles.borderColor = currentTheme.primary + "33";
    }

    const renderScrewRivets = () => (
      <>
        <View style={[styles.screwOuter, { top: 8, left: 8 }]} pointerEvents="none">
          <View style={styles.screwInner}><View style={styles.screwThread} /></View>
        </View>
        <View style={[styles.screwOuter, { top: 8, right: 8 }]} pointerEvents="none">
          <View style={styles.screwInner}><View style={[styles.screwThread, { transform: [{ rotate: "135deg" }] }]} /></View>
        </View>
        <View style={[styles.screwOuter, { bottom: 8, left: 8 }]} pointerEvents="none">
          <View style={styles.screwInner}><View style={[styles.screwThread, { transform: [{ rotate: "90deg" }] }]} /></View>
        </View>
        <View style={[styles.screwOuter, { bottom: 8, right: 8 }]} pointerEvents="none">
          <View style={styles.screwInner}><View style={[styles.screwThread, { transform: [{ rotate: "45deg" }] }]} /></View>
        </View>
      </>
    );

    const sheetContent = (
      <View style={[styles.content, { flex: 1, padding: 18 }, isLightNotePaper && { paddingLeft: 46 }]}>
        {isLightNotePaper && <View style={styles.redMarginLine} />}
        {isDark && renderScrewRivets()}
        {isLightNotePaper && (
          <View style={styles.binderSpirals}>
            <View style={styles.spiralRing} />
            <View style={styles.spiralRing} />
            <View style={sheetStylesHelper.spiralRing} />
            <View style={sheetStylesHelper.spiralRing} />
            <View style={sheetStylesHelper.spiralRing} />
            <View style={sheetStylesHelper.spiralRing} />
            <View style={sheetStylesHelper.spiralRing} />
            <View style={sheetStylesHelper.spiralRing} />
          </View>
        )}
        {contentChildren}
      </View>
    );

    if (cardTextureUrl) {
      return (
        <ImageBackground
          source={{ uri: cardTextureUrl }}
          style={cardStyles}
          imageStyle={{ opacity: isLightNotePaper ? 0.35 : 0.08, borderRadius: 0 }}
        >
          {sheetContent}
        </ImageBackground>
      );
    }

    return (
      <View style={cardStyles}>
        {sheetContent}
      </View>
    );
  };

  // Helper styles that don't need font injection
  const sheetStylesHelper = {
    spiralRing: {
      width: 6,
      height: 14,
      borderRadius: 3,
      backgroundColor: "#CCCCCC",
      borderWidth: 1,
      borderColor: "#999999",
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: "transparent" }]}
    >
      <View style={styles.rowContainer}>
        {/* SIDEBAR EXPLORER */}
        {isSidebarVisible && (
          <View style={[styles.sidebar, { borderRightColor: currentTheme.border, backgroundColor: "rgba(255, 255, 255, 0.06)" }]}>
            <View style={styles.sidebarHeader}>
              <Text style={[styles.sidebarTitle, { color: currentTheme.text }]}>Explorer</Text>
              <TouchableOpacity onPress={() => setIsFolderModalVisible(true)}>
                <MaterialCommunityIcons name="folder-plus" size={22} color={currentTheme.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sidebarScroll}>
              {/* ── VAULTS SECTION ── */}
              <Text style={[styles.sectionHeader, { color: currentTheme.secondaryText }]}>VAULTS</Text>

              {/* Active vault display / toggle inside a LiquidGlassCard */}
              <TouchableOpacity
                onPress={() => setIsVaultSwitcherVisible(!isVaultSwitcherVisible)}
                style={{ marginHorizontal: 8, marginVertical: 4 }}
              >
                <LiquidGlassCard
                  theme={currentTheme}
                  style={{ width: 204, marginVertical: 0 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MaterialCommunityIcons name="safe" size={20} color={currentTheme.primary} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: currentTheme.text }} numberOfLines={1}>
                        {vaults.find((v) => v.id === activeVaultId)?.name || "My Vault"}
                      </Text>
                      <Text style={{ fontSize: 9, color: currentTheme.secondaryText, marginTop: 2 }}>ACTIVE VAULT</Text>
                    </View>
                    <MaterialCommunityIcons
                      name={isVaultSwitcherVisible ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={currentTheme.secondaryText}
                    />
                  </View>
                </LiquidGlassCard>
              </TouchableOpacity>

              {/* Expandable vault list */}
              {isVaultSwitcherVisible && (
                <View style={{ marginLeft: 8 }}>
                  {vaults.map((vault) => (
                    <TouchableOpacity
                      key={vault.id}
                      style={[
                        styles.sidebarItem,
                        activeVaultId === vault.id && styles.activeItem,
                      ]}
                      onPress={async () => {
                        if (isEditing) await handleSaveNote();
                        setIsVaultSwitcherVisible(false);
                        if (handleSetActiveVault) await handleSetActiveVault(vault.id);
                        const vaultNotes = await getAllNotesFromFilesystem(vault.id);
                        setNotes(vaultNotes);
                      }}
                    >
                      <MaterialCommunityIcons
                        name={activeVaultId === vault.id ? "safe-square" : "safe-outline"}
                        size={18}
                        color={activeVaultId === vault.id ? currentTheme.primary : currentTheme.secondaryText}
                      />
                      <Text
                        style={[
                          styles.sidebarText,
                          { flex: 1 },
                          activeVaultId === vault.id && { color: currentTheme.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {vault.name}
                      </Text>

                      {/* Rename button (any vault) */}
                      <TouchableOpacity
                        onPress={() => {
                          setRenameVaultId(vault.id);
                          setRenameVaultNameInput(vault.name);
                          setIsRenameVaultModalVisible(true);
                        }}
                        style={{ padding: 4, marginRight: 2 }}
                      >
                        <MaterialCommunityIcons name="pencil" size={15} color={currentTheme.secondaryText} />
                      </TouchableOpacity>

                      {/* Delete button (only when >1 vault) */}
                      {vaults.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            if (!showConfirmation) return;
                            showConfirmation(
                              `Delete vault "${vault.name}"? All notes inside will be permanently deleted.`,
                              async () => {
                                await deleteVault(vault.id);
                                const remaining = await getVaults();
                                if (setVaults) setVaults(remaining);
                                const newActive = await getActiveVaultId();
                                if (newActive && newActive !== activeVaultId && handleSetActiveVault) {
                                  await handleSetActiveVault(newActive);
                                  const vaultNotes = await getAllNotesFromFilesystem(newActive);
                                  setNotes(vaultNotes);
                                }
                              }
                            );
                          }}
                          style={{ padding: 4 }}
                        >
                          <MaterialCommunityIcons name="delete-outline" size={15} color="#FF5252" />
                        </TouchableOpacity>
                      )}
                    </TouchableOpacity>
                  ))}

                  {/* Create Vault button */}
                  <TouchableOpacity
                    style={[styles.sidebarItem, { opacity: 0.8 }]}
                    onPress={() => setIsCreateVaultModalVisible(true)}
                  >
                    <MaterialCommunityIcons name="plus-circle-outline" size={17} color={currentTheme.primary} />
                    <Text style={[styles.sidebarText, { color: currentTheme.primary }]}>New Vault</Text>
                  </TouchableOpacity>

                  {/* Import .md files button */}
                  <TouchableOpacity
                    style={[styles.sidebarItem, { opacity: 0.8 }]}
                    onPress={async () => {
                      setIsImporting(true);
                      try {
                        const vault = await importMDFilesAsVault();
                        if (vault) {
                          const updatedVaults = await getVaults();
                          if (setVaults) setVaults(updatedVaults);
                          if (handleSetActiveVault) await handleSetActiveVault(vault.id);
                          const vaultNotes = await getAllNotesFromFilesystem(vault.id);
                          setNotes(vaultNotes);
                          if (showConfirmation) showConfirmation(`Imported "${vault.name}" with markdown files.`, () => {});
                        }
                      } catch (err) {
                        console.error("Import failed:", err);
                        if (showConfirmation) showConfirmation("Import failed. Please try again.", () => {});
                      } finally {
                        setIsImporting(false);
                      }
                    }}
                  >
                    <MaterialCommunityIcons name="file-import-outline" size={17} color={currentTheme.primary} />
                    <Text style={[styles.sidebarText, { color: currentTheme.primary }]}>
                      {isImporting ? "Importing..." : "Import .md Files"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── FOLDERS SECTION ── */}
              <Text style={[styles.sectionHeader, { color: currentTheme.secondaryText, marginTop: 16 }]}>FOLDERS</Text>
              <TouchableOpacity
                style={[styles.sidebarItem, activeFolder === "All" && styles.activeItem]}
                onPress={() => setActiveFolder("All")}
              >
                <MaterialCommunityIcons
                  name="folder-outline"
                  size={20}
                  color={activeFolder === "All" ? currentTheme.primary : currentTheme.secondaryText}
                />
                <Text style={[styles.sidebarText, activeFolder === "All" && { color: currentTheme.primary }]}>
                  All Notes
                </Text>
              </TouchableOpacity>

              <View style={styles.folderContainer}>
                {folders.map((folder, index) => {
                  const isDark = currentTheme.background === "#131313";
                  const isAmoled = currentTheme.background === "#000000";
                  const isLight = !isDark && !isAmoled;
                  const isActive = activeFolder === folder;

                  let textureUri = null;
                  let bgCardColor = currentTheme.cardBackground;

                  if (isDark) {
                    textureUri = "https://www.transparenttextures.com/patterns/brushed-alum-dark.png";
                    bgCardColor = "#20201F";
                  } else if (isLight) {
                    textureUri = "https://www.transparenttextures.com/patterns/lined-paper.png";
                    bgCardColor = "#FFFFFF";
                  } else if (isAmoled) {
                    bgCardColor = "#0E0E0E";
                  }

                  const folderCardStyle = [
                    styles.folderCard,
                    {
                      backgroundColor: bgCardColor,
                      borderColor: isActive ? currentTheme.primary : currentTheme.border,
                      borderWidth: isActive ? 2.5 : 1.5,
                      shadowOpacity: isActive ? 0.25 : 0.08,
                    }
                  ];

                  const fileCount = notes.filter((n) => n.folder === folder).length;

                  const folderContent = (
                    <View style={styles.folderCardInner}>
                      <View style={styles.folderCardTop}>
                        <MaterialCommunityIcons
                          name="folder"
                          size={24}
                          color={isActive ? currentTheme.primary : currentTheme.secondaryText}
                        />
                        <Text style={[styles.folderFileCount, { color: currentTheme.secondaryText }]}>
                          {fileCount < 10 ? `0${fileCount}` : fileCount}_FILES
                        </Text>
                      </View>
                      <Text style={[styles.folderLabel, { color: currentTheme.text }]}>
                        {folder.toUpperCase()}
                      </Text>
                      <View style={[styles.folderActiveLine, { backgroundColor: isActive ? currentTheme.primary : "transparent" }]} />
                    </View>
                  );

                  return (
                    <TouchableOpacity
                      key={folder}
                      onPress={() => setActiveFolder(folder)}
                      activeOpacity={0.8}
                    >
                      {textureUri ? (
                        <ImageBackground
                          source={{ uri: textureUri }}
                          style={folderCardStyle}
                          imageStyle={{ opacity: isLight ? 0.3 : 0.12, borderRadius: 0 }}
                        >
                          {folderContent}
                        </ImageBackground>
                      ) : (
                        <View style={folderCardStyle}>
                          {folderContent}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tags Filter Section */}
              {tags.length > 0 && (
                <>
                  <Text style={[styles.sectionHeader, { color: currentTheme.secondaryText, marginTop: 20 }]}>TAGS</Text>
                  <TouchableOpacity
                    style={[styles.sidebarItem, selectedTag === "All" && styles.activeItem]}
                    onPress={() => setSelectedTag("All")}
                  >
                    <MaterialCommunityIcons
                      name="tag-outline"
                      size={20}
                      color={selectedTag === "All" ? currentTheme.primary : currentTheme.secondaryText}
                    />
                    <Text style={[styles.sidebarText, selectedTag === "All" && { color: currentTheme.primary }]}>
                      All Tags
                    </Text>
                  </TouchableOpacity>
                  {tags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.sidebarItem, selectedTag === tag && styles.activeItem]}
                      onPress={() => setSelectedTag(tag)}
                    >
                      <MaterialCommunityIcons
                        name="tag"
                        size={20}
                        color={selectedTag === tag ? currentTheme.primary : currentTheme.secondaryText}
                      />
                      <Text style={[styles.sidebarText, selectedTag === tag && { color: currentTheme.primary }]}>
                        #{tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        )}

        {/* MAIN PANEL */}
        <View style={styles.mainPanel}>
          {!selectedNote ? (
            // NOTES LIST
            <View style={styles.flexOne}>
              {/* Toolbar */}
              <View style={styles.listHeader}>
                <TouchableOpacity
                  onPress={() => setIsSidebarVisible(!isSidebarVisible)}
                  style={{ marginRight: 10, padding: 5 }}
                >
                  <MaterialCommunityIcons
                    name={isSidebarVisible ? "menu-open" : "menu"}
                    size={24}
                    color={currentTheme.text}
                  />
                </TouchableOpacity>
                <View style={styles.searchBarContainer}>
                  <MaterialCommunityIcons name="magnify" size={20} color={currentTheme.secondaryText} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: currentTheme.text, backgroundColor: currentTheme.cardBackground, borderColor: currentTheme.border, borderWidth: 1.5 }]}
                    placeholder="Search notes..."
                    placeholderTextColor={currentTheme.secondaryText}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: currentTheme.primary }]}
                  onPress={handleCreateNote}
                >
                  <MaterialCommunityIcons 
                    name="plus" 
                    size={20} 
                    color={currentTheme.onPrimary} 
                  />
                  <Text style={[styles.createButtonText, { color: currentTheme.onPrimary }]}>Note</Text>
                </TouchableOpacity>
              </View>

              {/* Selected path display — shows Vault / Folder */}
              <View style={styles.pathHeader}>
                <MaterialCommunityIcons name="safe" size={16} color={currentTheme.secondaryText} />
                <Text style={[styles.pathText, { color: currentTheme.secondaryText }]}>
                  {vaults.find((v) => v.id === activeVaultId)?.name || "My Vault"} / {activeFolder}{selectedTag !== "All" ? ` > #${selectedTag}` : ""}
                </Text>
              </View>

              {/* Notes Grid/List */}
              <FlatList
                data={filteredNotes}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listScroll}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectNote(item)}
                  >
                    <LiquidGlassCard theme={currentTheme} style={{ marginVertical: 4 }}>
                    <View style={styles.noteCardHeader}>
                      <Text style={[styles.noteCardTitle, { color: currentTheme.text }]} numberOfLines={1}>
                        {item.title || "Untitled Note"}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={currentTheme.secondaryText} />
                    </View>
                    <Text style={[styles.noteCardSnippet, { color: currentTheme.secondaryText }]} numberOfLines={2}>
                      {item.content || "Empty content"}
                    </Text>
                    <View style={styles.noteCardFooter}>
                      <View style={styles.noteTagsContainer}>
                        {item.tags ? (
                          item.tags.split(",").map((t, idx) => (
                            <View key={idx} style={[styles.badge, { backgroundColor: currentTheme.primary + "15" }]}>
                              <Text style={[styles.badgeText, { color: currentTheme.primary }]}>#{t.trim()}</Text>
                            </View>
                          ))
                        ) : (
                          <View style={[styles.badge, { backgroundColor: currentTheme.primary + "10" }]}>
                            <Text style={[styles.badgeText, { color: currentTheme.secondaryText }]}>note</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.noteCardTime, { color: currentTheme.secondaryText }]}>
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </LiquidGlassCard>
                </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyStateContainer}>
                    <MaterialCommunityIcons name="note-text-outline" size={64} color={currentTheme.secondaryText} />
                    <Text style={[styles.emptyStateText, { color: currentTheme.secondaryText }]}>
                      No notes found in this folder.
                    </Text>
                  </View>
                }
              />
            </View>
          ) : (
            // NOTE EDITOR / RENDERER
            renderTactileSheet(
              <View style={styles.flexOne}>
                {/* Editor Header */}
              <View style={[styles.editorHeader, { borderBottomColor: currentTheme.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                  >
                    <MaterialCommunityIcons name="arrow-left" size={24} color={currentTheme.text} />
                    <Text style={[styles.backText, { color: currentTheme.text }]}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setIsSidebarVisible(!isSidebarVisible)}
                    style={{ marginLeft: 15, padding: 5 }}
                  >
                    <MaterialCommunityIcons
                      name={isSidebarVisible ? "menu-open" : "menu"}
                      size={24}
                      color={currentTheme.text}
                    />
                  </TouchableOpacity>
                </View>

                {/* Edit vs Preview Toggle Switch Key-Deck */}
                <View style={[
                  styles.editorToggle, 
                  { 
                    backgroundColor: currentTheme.cardBackground === "#FFFFFF" ? "#DCDAD9" : "#0E0E0E",
                    borderColor: currentTheme.border
                  }
                ]}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn, 
                      editorTab === "preview" && [
                        styles.toggleActive, 
                        { 
                          backgroundColor: currentTheme.primary,
                          borderColor: currentTheme.onPrimary
                        }
                      ]
                    ]}
                    onPress={() => handleToggleTab("preview")}
                  >
                    <Text 
                      style={[
                        styles.toggleText, 
                        { 
                          color: editorTab === "preview" 
                            ? (currentTheme.onPrimary) 
                            : currentTheme.secondaryText,
                          fontFamily: "JetBrainsMono-Bold"
                        }
                      ]}
                    >
                      PREVIEW
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn, 
                      editorTab === "edit" && [
                        styles.toggleActive, 
                        { 
                          backgroundColor: currentTheme.primary,
                          borderColor: currentTheme.onPrimary
                        }
                      ]
                    ]}
                    onPress={() => handleToggleTab("edit")}
                  >
                    <Text 
                      style={[
                        styles.toggleText, 
                        { 
                          color: editorTab === "edit" 
                            ? (currentTheme.onPrimary) 
                            : currentTheme.secondaryText,
                          fontFamily: "JetBrainsMono-Bold"
                        }
                      ]}
                    >
                      EDIT
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Editor Action buttons */}
                <View style={styles.editorActions}>
                  {editorTab === "edit" ? (
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNote}>
                      <MaterialCommunityIcons name="content-save" size={24} color={currentTheme.primary} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.saveBtn} onPress={() => handleToggleTab("edit")}>
                      <MaterialCommunityIcons name="pencil" size={24} color={currentTheme.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteNote(selectedNote.id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={24} color="#FF5252" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* EDITOR VIEW */}
              {editorTab === "edit" ? (
                <View style={styles.flexOne}>
                  {/* Meta inputs */}
                  <View style={styles.metaContainer}>
                    <TextInput
                      style={[styles.titleInput, { color: currentTheme.text }]}
                      placeholder="Note Title"
                      placeholderTextColor={currentTheme.secondaryText}
                      value={editTitle}
                      onChangeText={setEditTitle}
                    />

                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="folder-outline" size={18} color={currentTheme.secondaryText} />
                      <Text style={[styles.metaLabel, { color: currentTheme.secondaryText }]}>Folder:</Text>
                      <TextInput
                        style={[styles.folderInput, { color: currentTheme.text, backgroundColor: currentTheme.primary + "10" }]}
                        value={editFolder}
                        onChangeText={setEditFolder}
                        placeholder="Folder Name"
                        placeholderTextColor={currentTheme.secondaryText}
                      />
                    </View>

                    <View style={styles.metaRow}>
                      <MaterialCommunityIcons name="tag-outline" size={18} color={currentTheme.secondaryText} />
                      <Text style={[styles.metaLabel, { color: currentTheme.secondaryText }]}>Tags:</Text>
                      <TextInput
                        style={[styles.tagsInput, { color: currentTheme.text }]}
                        value={editTags}
                        onChangeText={setEditTags}
                        placeholder="work, idea, draft (comma separated)"
                        placeholderTextColor={currentTheme.secondaryText}
                      />
                    </View>
                  </View>

                  {/* Body Input */}
                  <TextInput
                    style={[styles.contentInput, { color: currentTheme.text }]}
                    placeholder="Start writing markdown..."
                    placeholderTextColor={currentTheme.secondaryText}
                    multiline
                    value={editContent}
                    onChangeText={setEditContent}
                    textAlignVertical="top"
                  />

                  {/* Markdown keyboard accessory toolbar */}
                  <View style={[styles.mdToolbar, { backgroundColor: currentTheme.cardBackground, borderTopColor: currentTheme.border }]}>
                    <TouchableOpacity onPress={() => insertMarkdown("# ")} style={styles.mdTool}>
                      <Text style={[styles.mdToolText, { color: currentTheme.text }]}>H1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => insertMarkdown("## ")} style={styles.mdTool}>
                      <Text style={[styles.mdToolText, { color: currentTheme.text }]}>H2</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => insertMarkdown("**bold**")} style={styles.mdTool}>
                      <MaterialCommunityIcons name="format-bold" size={20} color={currentTheme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => insertMarkdown("*italic*")} style={styles.mdTool}>
                      <MaterialCommunityIcons name="format-italic" size={20} color={currentTheme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => insertMarkdown("- [ ] ")} style={styles.mdTool}>
                      <MaterialCommunityIcons name="checkbox-blank-outline" size={20} color={currentTheme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => insertMarkdown("- ")} style={styles.mdTool}>
                      <MaterialCommunityIcons name="format-list-bulleted" size={20} color={currentTheme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                // PREVIEW VIEW
                <ScrollView style={styles.previewContainer} contentContainerStyle={styles.previewContent}>
                  <Text style={[styles.previewTitle, { color: currentTheme.text }]}>{selectedNote.title}</Text>
                  
                  {/* Metadata labels */}
                  <View style={styles.previewMeta}>
                    <View style={[styles.metaBadge, { backgroundColor: currentTheme.primary + "15" }]}>
                      <MaterialCommunityIcons name="folder" size={14} color={currentTheme.primary} />
                      <Text style={[styles.metaBadgeText, { color: currentTheme.primary }]}>{selectedNote.folder}</Text>
                    </View>
                    
                    {selectedNote.tags &&
                      selectedNote.tags.split(",").map((t, idx) => (
                        <View key={idx} style={[styles.metaBadge, { backgroundColor: "rgba(0,0,0,0.05)" }]}>
                          <Text style={[styles.metaBadgeText, { color: currentTheme.secondaryText }]}>#{t.trim()}</Text>
                        </View>
                      ))}
                  </View>

                  <View style={[styles.divider, { backgroundColor: currentTheme.border }]} />

                  {/* Rendered content */}
                  {renderMarkdown(selectedNote.content)}
                </ScrollView>
              )}
            </View>
          )
        )}
        </View>
      </View>

      {/* AI Assistant — shown when a note is open */}
      {selectedNote && (
        <AIAssistant
          currentTheme={currentTheme}
          noteContent={editContent || selectedNote.content}
          noteTitle={editTitle || selectedNote.title}
          onTasksExtracted={(extractedTaskTitles) => {
            if (!setTasks) return;
            const newTasks = extractedTaskTitles.map((title) => ({
              id: Date.now().toString() + Math.random().toString(36).slice(2),
              title,
              listId: "default_inbox",
              completed: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }));
            setTasks((prev) => [...prev, ...newTasks]);
          }}
          onUpdateNoteContent={async (newContent) => {
            setEditContent(newContent);
            const result = await saveNoteFile(activeVaultId, editFolder || selectedNote.folder, editTitle || selectedNote.title, newContent);
            if (result.success) {
              const freshNotes = await getAllNotesFromFilesystem(activeVaultId);
              setNotes(freshNotes);
              const savedNote = freshNotes.find((n) => n.id === result.filePath) || {
                id: result.filePath,
                title: editTitle || selectedNote.title,
                content: newContent,
                folder: editFolder || selectedNote.folder,
                tags: extractHashtags(newContent).join(", "),
                createdAt: selectedNote.createdAt,
                updatedAt: new Date().toISOString(),
              };
              setSelectedNote(savedNote);
            }
          }}
          onTaskCreated={onTaskCreated}
          onBirthdayCreated={onBirthdayCreated}
        />
      )}

      {/* Folder Creation Modal */}
      <Modal
        isVisible={isFolderModalVisible}
        onBackdropPress={() => setIsFolderModalVisible(false)}
        style={styles.modalOverlay}
      >
        <View style={[styles.dialogContent, { backgroundColor: currentTheme.cardBackground }]}>
          <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>New Folder</Text>
          <Text style={[styles.dialogMessage, { color: currentTheme.secondaryText }]}>
            Enter folder name to create and select it.
          </Text>
          <TextInput
            style={[styles.nameInput, { color: currentTheme.text, borderBottomColor: currentTheme.primary }]}
            value={newFolderName}
            onChangeText={setNewFolderName}
            placeholder="Folder Name"
            placeholderTextColor={currentTheme.secondaryText}
            autoFocus
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setIsFolderModalVisible(false)}>
              <Text style={{ color: currentTheme.secondaryText, fontWeight: "500" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: currentTheme.primary }]}
              onPress={handleAddFolder}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Vault Modal */}
      <Modal
        isVisible={isCreateVaultModalVisible}
        onBackdropPress={() => setIsCreateVaultModalVisible(false)}
        style={styles.modalOverlay}
      >
        <View style={[styles.dialogContent, { backgroundColor: currentTheme.cardBackground }]}>
          <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>New Vault</Text>
          <Text style={[styles.dialogMessage, { color: currentTheme.secondaryText }]}>
            Vaults are isolated note directories — like separate vault vaults.
          </Text>
          <TextInput
            style={[styles.nameInput, { color: currentTheme.text, borderBottomColor: currentTheme.primary }]}
            value={newVaultName}
            onChangeText={setNewVaultName}
            placeholder="Vault Name"
            placeholderTextColor={currentTheme.secondaryText}
            autoFocus
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setIsCreateVaultModalVisible(false); setNewVaultName(""); }}
            >
              <Text style={{ color: currentTheme.secondaryText, fontWeight: "500" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: currentTheme.primary }]}
              onPress={async () => {
                if (!newVaultName.trim()) return;
                const vault = await createVault(newVaultName.trim());
                const updatedVaults = await getVaults();
                if (setVaults) setVaults(updatedVaults);
                if (handleSetActiveVault) await handleSetActiveVault(vault.id);
                const vaultNotes = await getAllNotesFromFilesystem(vault.id);
                setNotes(vaultNotes);
                setIsCreateVaultModalVisible(false);
                setNewVaultName("");
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rename Vault Modal */}
      <Modal
        isVisible={isRenameVaultModalVisible}
        onBackdropPress={() => setIsRenameVaultModalVisible(false)}
        style={styles.modalOverlay}
      >
        <View style={[styles.dialogContent, { backgroundColor: currentTheme.cardBackground }]}>
          <Text style={[styles.dialogTitle, { color: currentTheme.text }]}>Rename Vault</Text>
          <TextInput
            style={[styles.nameInput, { color: currentTheme.text, borderBottomColor: currentTheme.primary }]}
            value={renameVaultNameInput}
            onChangeText={setRenameVaultNameInput}
            placeholder="Vault Name"
            placeholderTextColor={currentTheme.secondaryText}
            autoFocus
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => { setIsRenameVaultModalVisible(false); setRenameVaultId(null); }}
            >
              <Text style={{ color: currentTheme.secondaryText, fontWeight: "500" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: currentTheme.primary }]}
              onPress={async () => {
                if (!renameVaultNameInput.trim() || !renameVaultId) return;
                await renameVault(renameVaultId, renameVaultNameInput.trim());
                const updatedVaults = await getVaults();
                if (setVaults) setVaults(updatedVaults);
                setIsRenameVaultModalVisible(false);
                setRenameVaultId(null);
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>Rename</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const rawStyles = {
  container: {
    flex: 1,
  },
  rowContainer: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 220,
    borderRightWidth: 1,
    paddingTop: 15,
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sidebarScroll: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 15,
    marginTop: 10,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sidebarItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 0,
    marginHorizontal: 8,
    marginBottom: 2,
  },
  activeItem: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
  },
  sidebarText: {
    fontSize: 14,
    marginLeft: 10,
    fontWeight: "500",
  },
  mainPanel: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  listHeader: {
    flexDirection: "row",
    padding: 15,
    alignItems: "center",
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 10,
  },
  searchIcon: {
    position: "absolute",
    left: 10,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderRadius: 0,
    paddingLeft: 38,
    paddingRight: 15,
    fontSize: 14,
  },
  createButton: {
    flexDirection: "row",
    height: 40,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  createButtonText: {
    color: "#FFF",
    fontWeight: "600",
    marginLeft: 5,
    fontSize: 14,
  },
  pathHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  pathText: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: "600",
  },
  listScroll: {
    paddingHorizontal: 15,
    paddingBottom: 40,
  },
  noteCard: {
    borderRadius: 0,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  noteCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  noteCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },
  noteCardSnippet: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  noteCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  noteTagsContainer: {
    flexDirection: "row",
    flex: 1,
    flexWrap: "wrap",
  },
  noteCardTime: {
    fontSize: 11,
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 15,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    height: 56,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 5,
  },
  editorToggle: {
    flexDirection: "row",
    borderRadius: 0,
    borderWidth: 2,
    padding: 3,
    alignSelf: "center",
    marginVertical: 5,
  },
  toggleBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    borderWidth: 1.5,
    elevation: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  editorActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  saveBtn: {
    marginRight: 15,
  },
  deleteBtn: {
    padding: 2,
  },
  metaContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    padding: 0,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 13,
    width: 60,
    marginLeft: 8,
    fontWeight: "500",
  },
  folderInput: {
    fontSize: 13,
    fontWeight: "600",
    borderRadius: 0,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 100,
  },
  tagsInput: {
    fontSize: 13,
    flex: 1,
    padding: 0,
    fontWeight: "500",
  },
  contentInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  mdToolbar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
  },
  mdTool: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  mdToolText: {
    fontSize: 14,
    fontWeight: "700",
  },
  previewContainer: {
    flex: 1,
    padding: 20,
  },
  previewContent: {
    paddingBottom: 60,
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 10,
  },
  previewMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 15,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 0,
    marginRight: 8,
    marginBottom: 6,
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  divider: {
    height: 1,
    marginVertical: 15,
  },
  h1: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 15,
    marginBottom: 8,
  },
  h2: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  h3: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  boldText: {
    fontWeight: "700",
  },
  italicText: {
    fontStyle: "italic",
  },
  mdTodoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 4,
  },
  industrialUncheckedBox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "#8E9192",
    borderRadius: 0,
    marginRight: 2,
    backgroundColor: "transparent",
  },
  industrialCheckedBox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 0,
    marginRight: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  mdTodoText: {
    fontSize: 15,
    marginLeft: 8,
  },
  mdTodoDone: {
    textDecorationLine: "line-through",
  },
  mdBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 4,
  },
  bullet: {
    fontSize: 18,
    lineHeight: 18,
    marginRight: 8,
  },
  mdBulletText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  emptyContentText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 30,
  },
  modalOverlay: {
    justifyContent: "center",
    margin: 20,
  },
  dialogContent: {
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  nameInput: {
    borderBottomWidth: 1,
    height: 40,
    fontSize: 16,
    marginBottom: 20,
    paddingHorizontal: 5,
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginRight: 10,
  },
  confirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 0,
  },
  // Tactile Note details sheet styles
  screwOuter: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4E5067",
    borderWidth: 1,
    borderColor: "#2E303D",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
  screwInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#777A99",
    alignItems: "center",
    justifyContent: "center",
  },
  screwThread: {
    width: 6,
    height: 1,
    backgroundColor: "#2E303D",
  },
  redMarginLine: {
    position: "absolute",
    left: 36,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: "rgba(255, 99, 71, 0.45)",
  },
  binderSpirals: {
    flexDirection: "row",
    justifyContent: "space-around",
    position: "absolute",
    top: -6,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  spiralRing: {
    width: 6,
    height: 14,
    borderRadius: 3,
    backgroundColor: "#CCCCCC",
    borderWidth: 1,
    borderColor: "#999999",
  },
  folderContainer: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 12,
  },
  folderCard: {
    borderRadius: 0,
    borderWidth: 1.5,
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 3, height: 3 },
    shadowRadius: 0,
  },
  folderCardInner: {
    padding: 12,
    position: "relative",
  },
  folderCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  folderFileCount: {
    fontSize: 10,
    fontWeight: "700",
  },
  folderLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  folderActiveLine: {
    height: 3,
    marginTop: 8,
    width: "100%",
  },
};

const injectFontFamily = (obj) => {
  const fontRegular = "JetBrainsMono-Regular";
  const fontMedium = "JetBrainsMono-Medium";
  const fontSemiBold = "JetBrainsMono-Bold";
  const fontBold = "JetBrainsMono-Bold";
  const fontMono = "JetBrainsMono-Medium";

  for (const key in obj) {
    if (obj[key] && typeof obj[key] === "object") {
      const style = obj[key];
      const hasTextProp =
        style.fontSize !== undefined ||
        style.color !== undefined ||
        style.lineHeight !== undefined ||
        style.textAlign !== undefined ||
        style.fontStyle !== undefined ||
        style.fontWeight !== undefined;

      if (hasTextProp) {
        if (
          key.toLowerCase().includes("mono") ||
          key.toLowerCase().includes("code") ||
          key.toLowerCase().includes("time") ||
          key.toLowerCase().includes("tag") ||
          key.toLowerCase().includes("meta") ||
          key.toLowerCase().includes("path") ||
          (style.fontFamily && (style.fontFamily === "monospace" || style.fontFamily === "Menlo"))
        ) {
          style.fontFamily = fontMono;
          continue;
        }

        if (style.fontWeight) {
          const weight = String(style.fontWeight);
          if (weight === "bold" || weight === "700" || weight === "800" || weight === "900") {
            style.fontFamily = fontBold;
          } else if (weight === "600") {
            style.fontFamily = fontSemiBold;
          } else if (weight === "500") {
            style.fontFamily = fontMedium;
          } else {
            style.fontFamily = fontRegular;
          }
        } else {
          style.fontFamily = fontRegular;
        }
      }
    }
  }
};

injectFontFamily(rawStyles);

const styles = StyleSheet.create(rawStyles);
