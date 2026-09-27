import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { initLlama, releaseAllLlama } from 'llama.rn';
import { requestWidgetUpdate } from 'react-native-android-widget';

describe('Jest Setup & Native Mocks Smoke Test', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    if (FileSystem.__resetFS) {
      FileSystem.__resetFS();
    }
  });

  describe('AsyncStorage Mock', () => {
    it('persists and retrieves values cleanly', async () => {
      await AsyncStorage.setItem('kwestup_test_key', 'test_value_123');
      const retrieved = await AsyncStorage.getItem('kwestup_test_key');
      expect(retrieved).toBe('test_value_123');

      await AsyncStorage.removeItem('kwestup_test_key');
      const afterRemove = await AsyncStorage.getItem('kwestup_test_key');
      expect(afterRemove).toBeNull();
    });

    it('handles multiple keys in allKeys', async () => {
      await AsyncStorage.setItem('kwestup_tasks', '[]');
      await AsyncStorage.setItem('kwestup_vaults', '[]');
      const keys = await AsyncStorage.getAllKeys();
      expect(keys).toContain('kwestup_tasks');
      expect(keys).toContain('kwestup_vaults');
    });
  });

  describe('Expo FileSystem Mock', () => {
    it('handles directory creation, file write, file read, and deletion', async () => {
      const testDir = `${FileSystem.documentDirectory}test-vault/`;
      await FileSystem.makeDirectoryAsync(testDir, { intermediates: true });

      const dirInfo = await FileSystem.getInfoAsync(testDir);
      expect(dirInfo.exists).toBe(true);
      expect(dirInfo.isDirectory).toBe(true);

      const testFile = `${testDir}Note.md`;
      const noteContent = '# Test Note\nHello world!';
      await FileSystem.writeAsStringAsync(testFile, noteContent);

      const fileInfo = await FileSystem.getInfoAsync(testFile);
      expect(fileInfo.exists).toBe(true);
      expect(fileInfo.isDirectory).toBe(false);

      const readBack = await FileSystem.readAsStringAsync(testFile);
      expect(readBack).toBe(noteContent);

      const dirContents = await FileSystem.readDirectoryAsync(testDir);
      expect(dirContents).toContain('Note.md');

      await FileSystem.deleteAsync(testFile);
      const afterDelete = await FileSystem.getInfoAsync(testFile);
      expect(afterDelete.exists).toBe(false);
    });
  });

  describe('llama.rn Native LLM Mock', () => {
    it('initializes llama context without native crash and provides mock completion', async () => {
      const llamaContext = await initLlama({ model: 'mock-path.gguf' });
      expect(llamaContext).toBeDefined();
      expect(typeof llamaContext.completion).toBe('function');

      const response = await llamaContext.completion({ prompt: 'Summarize' });
      expect(response.text).toBe('Mock LLM completion response');

      const releaseResult = await llamaContext.release();
      expect(releaseResult).toBe(true);

      const globalRelease = await releaseAllLlama();
      expect(globalRelease).toBe(true);
    });
  });

  describe('react-native-android-widget Mock', () => {
    it('executes requestWidgetUpdate without errors', async () => {
      const result = await requestWidgetUpdate({ widgetName: 'TasksListWidget' });
      expect(result).toBe(true);
      expect(requestWidgetUpdate).toHaveBeenCalledWith({ widgetName: 'TasksListWidget' });
    });
  });
});
