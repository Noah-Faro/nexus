import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { encryptAESGCM, decryptAESGCM, deriveKeyFromPassword } from './security';
import { loadSettings, loadLogs } from './storage';
import { loadWorkoutSessions, loadTemplates, loadCustomExercises, loadExerciseDefaults } from './trainingStorage';
import { saveSettings, saveLogs } from './storage';
import { saveWorkoutSessions, saveTemplates, saveCustomExercises, saveExerciseDefaults } from './trainingStorage';

export async function exportVaultBackupToString(password: string): Promise<string> {
  // 1. Gather all state
  const state = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    hydration_history: await loadLogs(),
    settings: await loadSettings(),
    workout_sessions: await loadWorkoutSessions(),
    workout_templates: await loadTemplates(),
    custom_exercises: await loadCustomExercises(),
    exercise_defaults: await loadExerciseDefaults(),
  };

  const payloadJson = JSON.stringify(state);

  // 2. Encrypt payload using user password
  const { key, salt } = deriveKeyFromPassword(password);
  const encryptedPayload = encryptAESGCM(payloadJson, key);

  // 3. Construct .nexus file format
  return JSON.stringify({
    version: '1.0',
    exportedAt: state.exportedAt,
    encrypted: true,
    salt: salt,
    payload: encryptedPayload,
  });
}

export async function exportVaultBackup(password: string): Promise<void> {
  try {
    const fileContent = await exportVaultBackupToString(password);
    
    // 4. Save to temp directory and share
    const fileName = `Nexus_Backup_${new Date().toISOString().split('T')[0]}.nexus`;
    const tempUri = FileSystem.cacheDirectory + fileName;
    
    await FileSystem.writeAsStringAsync(tempUri, fileContent);
    
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(tempUri, {
        UTI: 'com.noahg.nexus.backup',
        mimeType: 'application/json',
        dialogTitle: 'Export NEXUS Vault',
      });
    } else {
      throw new Error('Sharing is not available on this device');
    }
  } catch (err) {
    console.error('Failed to export backup', err);
    throw err;
  }
}

export async function importVaultBackupFromString(fileStr: string, password: string): Promise<void> {
  const backupData = JSON.parse(fileStr);

  if (!backupData.encrypted || !backupData.salt || !backupData.payload) {
    throw new Error('Invalid or corrupt backup file format.');
  }

  // 2. Decrypt
  const { key } = deriveKeyFromPassword(password, backupData.salt);
  let decryptedStr = '';
  try {
    decryptedStr = decryptAESGCM(backupData.payload, key);
  } catch (e) {
    throw new Error('Incorrect password or corrupt payload.');
  }

  const state = JSON.parse(decryptedStr);

  // STATE MERGING GUARDRAILS: Schema validation
  if (!state.version || !state.hydration_history || !state.workout_templates) {
    throw new Error('Backup payload is missing critical top-level tracking keys.');
  }

  // 3. Restore state (Merge/Replace logic - currently Replace All for simplicity)
  await saveSettings(state.settings);
  await saveLogs(state.hydration_history);
  await saveWorkoutSessions(state.workout_sessions);
  await saveTemplates(state.workout_templates);
  if (state.custom_exercises) await saveCustomExercises(state.custom_exercises);
  if (state.exercise_defaults) await saveExerciseDefaults(state.exercise_defaults);
}

export async function importVaultBackup(fileUri: string, password: string): Promise<void> {
  try {
    // APP SANDBOX PATH COPYING:
    // Copy from external deep link / system temp to local document directory to ensure stable read permissions
    const localUri = FileSystem.documentDirectory + 'temp_import.nexus';
    await FileSystem.copyAsync({ from: fileUri, to: localUri });

    // 1. Read file
    const fileStr = await FileSystem.readAsStringAsync(localUri);
    await importVaultBackupFromString(fileStr, password);

    // Cleanup
    await FileSystem.deleteAsync(localUri, { idempotent: true });
    
  } catch (err) {
    console.error('Failed to import backup', err);
    throw err;
  }
}

export async function pickAndImportBackup(password: string): Promise<boolean> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['public.data', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return false;
  }

  const fileUri = result.assets[0].uri;
  await importVaultBackup(fileUri, password);
  return true;
}
