import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getVaults, getActiveVaultId, setActiveVaultId as persistActiveVaultId } from "../utils/vaultService";
import { getAllNotesFromFilesystem } from "../utils/fileStorage";

const VaultContext = createContext(null);

const DEFAULT_VAULTS = [];
const DEFAULT_NOTES = [];

export const VaultProvider = ({
  children,
  initialVaults = DEFAULT_VAULTS,
  initialActiveVaultId = "default",
  initialNotes = DEFAULT_NOTES,
  initialActiveNote = null,
}) => {
  const [vaults, setVaults] = useState(initialVaults);
  const [activeVaultId, setActiveVaultId] = useState(initialActiveVaultId);
  const [notes, setNotes] = useState(initialNotes);
  const [activeNote, setActiveNote] = useState(initialActiveNote);

  useEffect(() => {
    if (initialVaults && initialVaults !== DEFAULT_VAULTS && initialVaults.length > 0) {
      setVaults(initialVaults);
    }
  }, [initialVaults]);

  useEffect(() => {
    if (initialActiveVaultId) {
      setActiveVaultId(initialActiveVaultId);
    }
  }, [initialActiveVaultId]);

  useEffect(() => {
    if (initialNotes && initialNotes.length > 0) {
      setNotes(initialNotes);
    }
  }, [initialNotes]);

  // Loads all notes from the filesystem for a given vault ID
  const loadVaultNotes = useCallback(async (vaultId) => {
    const id = vaultId || activeVaultId || "default";
    try {
      const fsNotes = await getAllNotesFromFilesystem(id);
      setNotes(fsNotes);
      return fsNotes;
    } catch (err) {
      console.error("❌ Failed to load vault notes:", err);
      return [];
    }
  }, [activeVaultId]);

  // Changes active vault, saves to storage, and reloads its notes
  const handleSetActiveVault = useCallback(async (newVaultId) => {
    try {
      await persistActiveVaultId(newVaultId);
      setActiveVaultId(newVaultId);
      setActiveNote(null);
      await loadVaultNotes(newVaultId);
      console.log("🗂️ Active vault switched to:", newVaultId);
    } catch (err) {
      console.error("❌ Failed to switch active vault:", err);
    }
  }, [loadVaultNotes]);

  const refreshVaults = useCallback(async () => {
    try {
      const loaded = await getVaults();
      setVaults(loaded);
      const activeId = await getActiveVaultId();
      if (activeId) setActiveVaultId(activeId);
    } catch (err) {
      console.error("❌ Failed to refresh vaults:", err);
    }
  }, []);

  const value = {
    vaults,
    setVaults,
    activeVaultId,
    setActiveVaultId,
    notes,
    setNotes,
    activeNote,
    setActiveNote,
    handleSetActiveVault,
    loadVaultNotes,
    refreshVaults,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
};

export const useVaults = () => {
  const context = useContext(VaultContext);
  return context;
};

export default VaultContext;
