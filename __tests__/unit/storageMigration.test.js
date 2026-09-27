import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isUserDataKey,
  clearAllCaches,
  migrateUserDataIfNeeded,
  STORAGE_VERSION,
  APP_VERSION,
} from '../../src/utils/storage';
import {
  getVaults,
  getActiveVaultId,
  VAULTS_KEY,
  ACTIVE_KEY,
  LEGACY_VAULTS_KEY,
  LEGACY_ACTIVE_KEY,
} from '../../src/utils/vaultService';

describe('Storage Migration & Cache Hardening Unit Tests', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('isUserDataKey (Key Protection Filter)', () => {
    it('identifies core user data and settings keys as protected', () => {
      expect(isUserDataKey('kwestup_data_v7.0')).toBe(true);
      expect(isUserDataKey('kwestup_userName_v7.0')).toBe(true);
      expect(isUserDataKey('kwestup_theme_mode_v7.0')).toBe(true);
      expect(isUserDataKey('kwestup_theme_name_v7.0')).toBe(true);
      expect(isUserDataKey('kwestup_timer_state_v7.0')).toBe(true);
      expect(isUserDataKey('kwestup_activeVault_v7.0')).toBe(true);
      expect(isUserDataKey('kwestup_vaults_v7.0')).toBe(true);
      expect(isUserDataKey('kwestup_billing_v7.0')).toBe(true);
      expect(isUserDataKey('kwestup_widget_v7.0')).toBe(true);
    });

    it('identifies telemetry consent and AI model downloads as protected', () => {
      expect(isUserDataKey('kwestup_telemetry_optin')).toBe(true);
      expect(isUserDataKey('kwestup_telemetry_consent_date')).toBe(true);
      expect(isUserDataKey('kwestup_ai_model_meta')).toBe(true);
      expect(isUserDataKey('kwestup_ai_model_download_resumable')).toBe(true);
    });

    it('returns false for transient cache and UI state keys', () => {
      expect(isUserDataKey('kwestup_ui_cache')).toBe(false);
      expect(isUserDataKey('kwestup_version_check')).toBe(false);
      expect(isUserDataKey('sidebar:state')).toBe(false);
      expect(isUserDataKey('medical_cache_search')).toBe(false);
      expect(isUserDataKey('clean_old_thumbnails')).toBe(false);
    });
  });

  describe('clearAllCaches', () => {
    it('removes cache keys while preserving user data, telemetry consent, and AI models', async () => {
      // Seed user data keys
      await AsyncStorage.setItem('kwestup_data_v7.0', JSON.stringify({ notes: [{ title: 'Safe Note' }] }));
      await AsyncStorage.setItem('kwestup_telemetry_optin', 'false');
      await AsyncStorage.setItem('kwestup_ai_model_download_resumable', 'http://localhost/model.bin');

      // Seed transient cache keys
      await AsyncStorage.setItem('kwestup_ui_cache', 'cached-render-tree');
      await AsyncStorage.setItem('kwestup_version_check', '2026-09-01');
      await AsyncStorage.setItem('sidebar:state', 'collapsed');
      await AsyncStorage.setItem('kwestup_temp_cache', 'trash-data');

      const success = await clearAllCaches();
      expect(success).toBe(true);

      // Verify caches are cleared
      expect(await AsyncStorage.getItem('kwestup_ui_cache')).toBeNull();
      expect(await AsyncStorage.getItem('kwestup_version_check')).toBeNull();
      expect(await AsyncStorage.getItem('sidebar:state')).toBeNull();
      expect(await AsyncStorage.getItem('kwestup_temp_cache')).toBeNull();

      // Verify protected items are preserved
      expect(await AsyncStorage.getItem('kwestup_data_v7.0')).toBeTruthy();
      expect(await AsyncStorage.getItem('kwestup_telemetry_optin')).toBe('false');
      expect(await AsyncStorage.getItem('kwestup_ai_model_download_resumable')).toBe('http://localhost/model.bin');

      // Verify metadata keys set
      expect(await AsyncStorage.getItem('kwestup_last_version')).toBe(APP_VERSION);
      expect(await AsyncStorage.getItem('kwestup_last_clear')).toBeTruthy();
    });
  });

  describe('migrateUserDataIfNeeded', () => {
    it('skips migration when current storage version already has data', async () => {
      await AsyncStorage.setItem('kwestup_data_v7.0', JSON.stringify({ notes: [{ title: 'Existing' }] }));
      await AsyncStorage.setItem('kwestup_data_v6.0', JSON.stringify({ notes: [{ title: 'Old' }] }));

      const migrated = await migrateUserDataIfNeeded('v7.0');
      expect(migrated).toBe(false);

      const currentData = JSON.parse(await AsyncStorage.getItem('kwestup_data_v7.0'));
      expect(currentData.notes[0].title).toBe('Existing');
    });

    it('returns false when no legacy keys exist', async () => {
      const migrated = await migrateUserDataIfNeeded('v7.0');
      expect(migrated).toBe(false);
    });

    it('migrates highest legacy version data, settings, vaults, and billing to new version', async () => {
      // Seed legacy v5.0 and v6.0 data
      await AsyncStorage.setItem('kwestup_data_v5.0', JSON.stringify({ notes: [{ title: 'v5 Note' }] }));
      await AsyncStorage.setItem('kwestup_data_v6.0', JSON.stringify({ notes: [{ title: 'v6 Note' }] }));
      await AsyncStorage.setItem('kwestup_userName_v6.0', 'Alex Developer');
      await AsyncStorage.setItem('kwestup_theme_mode_v6.0', 'dark');
      await AsyncStorage.setItem('kwestup_theme_name_v6.0', 'industrial');
      await AsyncStorage.setItem('kwestup_timer_state_v6.0', JSON.stringify({ elapsed: 120 }));
      await AsyncStorage.setItem('kwestup_activeVault_v6.0', 'vault-alpha');
      await AsyncStorage.setItem('kwestup_vaults_v6.0', JSON.stringify([{ id: 'vault-alpha', name: 'Alpha' }]));
      await AsyncStorage.setItem('kwestup_billing_v6.0', JSON.stringify({ tier: 'pro', status: 'active' }));

      const migrated = await migrateUserDataIfNeeded('v8.0');
      expect(migrated).toBe(true);

      // Verify target v8.0 keys
      const v8Data = JSON.parse(await AsyncStorage.getItem('kwestup_data_v8.0'));
      expect(v8Data.notes[0].title).toBe('v6 Note');

      expect(await AsyncStorage.getItem('kwestup_userName_v8.0')).toBe('Alex Developer');
      expect(await AsyncStorage.getItem('kwestup_theme_mode_v8.0')).toBe('dark');
      expect(await AsyncStorage.getItem('kwestup_theme_name_v8.0')).toBe('industrial');
      expect(await AsyncStorage.getItem('kwestup_activeVault_v8.0')).toBe('vault-alpha');

      const v8Vaults = JSON.parse(await AsyncStorage.getItem('kwestup_vaults_v8.0'));
      expect(v8Vaults[0].name).toBe('Alpha');

      const v8Billing = JSON.parse(await AsyncStorage.getItem('kwestup_billing_v8.0'));
      expect(v8Billing.tier).toBe('pro');
    });
  });

  describe('vaultService Version Migration & Key Fallback', () => {
    it('transparently reads and migrates legacy v5.0 vaults to current storage version key', async () => {
      const legacyVaults = [{ id: 'legacy-vault-1', name: 'Legacy Vault' }];
      await AsyncStorage.setItem(LEGACY_VAULTS_KEY, JSON.stringify(legacyVaults));

      // Current key should be empty initially
      expect(await AsyncStorage.getItem(VAULTS_KEY)).toBeNull();

      // getVaults should auto-migrate
      const vaults = await getVaults();
      expect(vaults).toHaveLength(1);
      expect(vaults[0].name).toBe('Legacy Vault');

      // Now the current key must be populated
      const currentStored = JSON.parse(await AsyncStorage.getItem(VAULTS_KEY));
      expect(currentStored[0].name).toBe('Legacy Vault');
    });

    it('transparently reads and migrates legacy v5.0 active vault to current storage version key', async () => {
      await AsyncStorage.setItem(LEGACY_ACTIVE_KEY, 'vault-legacy-active');

      // Current key empty initially
      expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBeNull();

      // getActiveVaultId should auto-migrate
      const activeId = await getActiveVaultId();
      expect(activeId).toBe('vault-legacy-active');

      // Current key must now be populated
      expect(await AsyncStorage.getItem(ACTIVE_KEY)).toBe('vault-legacy-active');
    });
  });
});
