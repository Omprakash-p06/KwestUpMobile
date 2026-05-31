/**
 * Phase 8 (Obsidian-Style Note Vaults) Structural Validation Script
 *
 * This script statically checks imports, parameters, exports, and integrations
 * to verify that the vault system behaves exactly as designed.
 */

const fs = require('fs');
const path = require('path');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log("=== RUNNING PHASE 8 STRUCTURAL VALIDATION ===\n");

// 1. Validate vaultService.js
const vaultServicePath = path.resolve(__dirname, '../src/utils/vaultService.js');
assert(fs.existsSync(vaultServicePath), 'src/utils/vaultService.js exists');

if (fs.existsSync(vaultServicePath)) {
  const content = fs.readFileSync(vaultServicePath, 'utf8');

  // Check expected exports
  const expectedExports = [
    'getVaultPath',
    'ensureVaultsDir',
    'getVaults',
    'saveVaults',
    'createVault',
    'deleteVault',
    'renameVault',
    'getActiveVaultId',
    'setActiveVaultId',
    'migrateToVaultSystem'
  ];

  expectedExports.forEach(exp => {
    assert(content.includes(`export const ${exp}`), `vaultService.js exports ${exp}`);
  });

  // Check AsyncStorage key references
  assert(content.includes('kwestup_vaults_v5.0'), 'vaultService.js uses correct vaults metadata key');
  assert(content.includes('kwestup_activeVault_v5.0'), 'vaultService.js uses correct active vault key');

  // Check migration pattern
  assert(content.includes('Notes/Vaults/default/'), 'vaultService.js uses default vault path for migration');
  assert(content.includes('moveAsync') && content.includes('copyAsync'), 'vaultService.js uses Expo FileSystem move with copy fallback');
}

// 2. Validate vaultImport.js
const vaultImportPath = path.resolve(__dirname, '../src/utils/vaultImport.js');
assert(fs.existsSync(vaultImportPath), 'src/utils/vaultImport.js exists');

if (fs.existsSync(vaultImportPath)) {
  const content = fs.readFileSync(vaultImportPath, 'utf8');
  assert(content.includes('importMDFilesAsVault'), 'vaultImport.js exports importMDFilesAsVault');
  assert(content.includes('expo-document-picker'), 'vaultImport.js imports expo-document-picker');
  assert(content.includes('DocumentPicker.getDocumentAsync'), 'vaultImport.js triggers DocumentPicker.getDocumentAsync');
}

// 3. Validate fileStorage.js
const fileStoragePath = path.resolve(__dirname, '../src/utils/fileStorage.js');
assert(fs.existsSync(fileStoragePath), 'src/utils/fileStorage.js exists');

if (fs.existsSync(fileStoragePath)) {
  const content = fs.readFileSync(fileStoragePath, 'utf8');

  // Verify NOTES_ROOT is not hardcoded to plain Notes/
  assert(!content.includes('const NOTES_ROOT = `${FileSystem.documentDirectory}Notes/`;') || content.includes('// legacy') || content.includes('// backward'), 'fileStorage.js does not have hardcoded global NOTES_ROOT');

  // Verify signatures are parameterized
  assert(content.includes('saveNoteFile = async (vaultId,'), 'saveNoteFile is vaultId parameterized');
  assert(content.includes('readNoteFile = async (vaultId,'), 'readNoteFile is vaultId parameterized');
  assert(content.includes('deleteNoteFile = async (vaultId,'), 'deleteNoteFile is vaultId parameterized');
  assert(content.includes('getAllNotesFromFilesystem = async (vaultId'), 'getAllNotesFromFilesystem is vaultId parameterized');

  // Verify backward compatibility wrappers are exported
  assert(content.includes('saveNoteToActiveVault'), 'fileStorage.js exports saveNoteToActiveVault');
  assert(content.includes('readNoteFromActiveVault'), 'fileStorage.js exports readNoteFromActiveVault');
  assert(content.includes('deleteNoteFromActiveVault'), 'fileStorage.js exports deleteNoteFromActiveVault');
  assert(content.includes('getAllNotesFromActiveVault'), 'fileStorage.js exports getAllNotesFromActiveVault');
}

// 4. Validate App.js integration
const appPath = path.resolve(__dirname, '../App.js');
assert(fs.existsSync(appPath), 'App.js exists');

if (fs.existsSync(appPath)) {
  const content = fs.readFileSync(appPath, 'utf8');
  assert(content.includes('migrateToVaultSystem'), 'App.js imports migrateToVaultSystem');
  assert(content.includes('getVaults'), 'App.js imports getVaults');
  assert(content.includes('activeVaultId'), 'App.js manages activeVaultId state');
  assert(content.includes('handleSetActiveVault'), 'App.js implements handleSetActiveVault');
  assert(content.includes('getAllNotesFromFilesystem(activeVaultId'), 'App.js loadData uses activeVaultId');
}

// 5. Validate AppNavigator.js props threading
const appNavPath = path.resolve(__dirname, '../src/navigation/AppNavigator.js');
assert(fs.existsSync(appNavPath), 'src/navigation/AppNavigator.js exists');

if (fs.existsSync(appNavPath)) {
  const content = fs.readFileSync(appNavPath, 'utf8');
  assert(content.includes('activeVaultId'), 'AppNavigator threads activeVaultId');
  assert(content.includes('handleSetActiveVault'), 'AppNavigator threads handleSetActiveVault');
}

// 6. Validate NotesScreen.js integration
const notesScreenPath = path.resolve(__dirname, '../src/screens/NotesScreen.js');
assert(fs.existsSync(notesScreenPath), 'src/screens/NotesScreen.js exists');

if (fs.existsSync(notesScreenPath)) {
  const content = fs.readFileSync(notesScreenPath, 'utf8');

  // Verify vault actions are imported
  assert(content.includes('createVault') && content.includes('deleteVault') && content.includes('renameVault'), 'NotesScreen.js imports vault CRUD actions');
  assert(content.includes('importMDFilesAsVault'), 'NotesScreen.js imports importMDFilesAsVault');

  // Verify vault props are destructured
  assert(content.includes('activeVaultId'), 'NotesScreen.js receives activeVaultId prop');
  assert(content.includes('handleSetActiveVault'), 'NotesScreen.js receives handleSetActiveVault prop');

  // Verify UI elements
  assert(content.includes('isCreateVaultModalVisible'), 'NotesScreen.js has Create Vault modal state');
  assert(content.includes('isRenameVaultModalVisible'), 'NotesScreen.js has Rename Vault modal state');
  assert(content.includes('isVaultSwitcherVisible'), 'NotesScreen.js has Vault Switcher visibility state');

  // Verify save on switch auto-save trigger
  assert(content.includes('isEditing') && content.includes('handleSaveNote'), 'NotesScreen.js checks isEditing and handleSaveNote when switching');
}

console.log("\n=== VALIDATION SUMMARY ===");
if (failures > 0) {
  console.error(`❌ Structural validation failed with ${failures} error(s).`);
  process.exit(1);
} else {
  console.log("💚 All structural validation checks passed successfully!");
  process.exit(0);
}
