import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptAESGCM, decryptAESGCM, deriveKeyFromPassword } from './security';
import { loadSettings, loadLogs } from './storage';
import { loadWorkoutSessions, loadTemplates, loadCustomExercises, loadExerciseDefaults } from './trainingStorage';
import { saveSettings, saveLogs } from './storage';
import { saveWorkoutSessions, saveTemplates, saveCustomExercises, saveExerciseDefaults } from './trainingStorage';
import { Tombstone, loadTombstones, saveTombstones, pruneTombstones } from './tombstones';

// ─── Finding #4: In-memory PBKDF2 key cache ───
let cachedDerivedKey: { password: string; key: string; salt: string } | null = null;

/**
 * Clear the in-memory PBKDF2 key cache. Call on logout or password change.
 */
export function clearDerivedKeyCache(): void {
  cachedDerivedKey = null;
}

function getCachedOrDeriveKey(password: string, existingSalt?: string): { key: string; salt: string } {
  // If we have an existing salt (import/decrypt), always derive fresh with that salt
  if (existingSalt) {
    return deriveKeyFromPassword(password, existingSalt);
  }
  // For export: reuse cached key if password matches
  if (cachedDerivedKey && cachedDerivedKey.password === password) {
    return { key: cachedDerivedKey.key, salt: cachedDerivedKey.salt };
  }
  const derived = deriveKeyFromPassword(password);
  cachedDerivedKey = { password, key: derived.key, salt: derived.salt };
  return derived;
}

// ─── Finding #2: Atomic merge staging key ───
const MERGE_STAGING_KEY = 'nexus_merge_staging';

/**
 * Replay a pending merge if the app was killed mid-save.
 * Call this on app startup before any sync operations.
 */
export async function replayPendingMerge(): Promise<void> {
  try {
    const stagingData = await AsyncStorage.getItem(MERGE_STAGING_KEY);
    if (!stagingData) return;

    console.log('Replaying interrupted merge from staging key...');
    const staged = JSON.parse(stagingData);

    await saveSettings(staged.settings);
    await saveLogs(staged.logs);
    await saveWorkoutSessions(staged.sessions);
    await saveTemplates(staged.templates);
    await saveCustomExercises(staged.customExercises);
    await saveExerciseDefaults(staged.defaults);
    if (staged.tombstones) {
      await saveTombstones(staged.tombstones);
    }

    await AsyncStorage.removeItem(MERGE_STAGING_KEY);
    console.log('Interrupted merge replay completed successfully.');
  } catch (e) {
    console.error('Failed to replay pending merge:', e);
    // Clear corrupted staging data so we don't loop on it
    await AsyncStorage.removeItem(MERGE_STAGING_KEY).catch(() => {});
  }
}

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
    tombstones: await loadTombstones(), // Finding #1: Include tombstones in backup
  };

  const payloadJson = JSON.stringify(state);

  // 2. Encrypt payload using user password (Finding #4: use cached key)
  const { key, salt } = getCachedOrDeriveKey(password);
  const encryptedPayload = encryptAESGCM(payloadJson, key);

  // 3. Construct .nexus file format (Finding #5: no exportedAt in outer wrapper)
  return JSON.stringify({
    version: '1.0',
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

// ─── Finding #1: Tombstone-aware merge ───
function mergeById<T>(
  localItems: T[],
  remoteItems: T[],
  idKey: keyof T,
  tombstones: Tombstone[],
  timestampKey?: keyof T
): T[] {
  const mergedMap = new Map<any, T>();
  const tombstoneMap = new Map<string, number>();
  
  // Build a fast lookup for tombstones
  for (const t of tombstones) {
    tombstoneMap.set(t.id, t.deletedAt);
  }
  
  const localList = Array.isArray(localItems) ? localItems : [];
  const remoteList = Array.isArray(remoteItems) ? remoteItems : [];
  
  for (const item of localList) {
    if (item && item[idKey] !== undefined) {
      mergedMap.set(item[idKey], item);
    }
  }
  
  for (const item of remoteList) {
    if (!item || item[idKey] === undefined) continue;
    const id = item[idKey];
    
    if (mergedMap.has(id)) {
      const existing = mergedMap.get(id)!;
      if (timestampKey) {
        const localTs = (existing[timestampKey] as unknown as number) || 0;
        const remoteTs = (item[timestampKey] as unknown as number) || 0;
        if (remoteTs > localTs) {
          mergedMap.set(id, item);
        }
      } else {
        // Prefer remote for templates/custom exercises to ensure edits sync
        mergedMap.set(id, item);
      }
    } else {
      mergedMap.set(id, item);
    }
  }
  
  // Remove tombstoned entries: if an item was deleted more recently than it was last modified, exclude it
  for (const [id, item] of mergedMap) {
    const deletedAt = tombstoneMap.get(String(id));
    if (deletedAt !== undefined) {
      const itemTs = timestampKey ? ((item[timestampKey] as unknown as number) || 0) : 0;
      if (deletedAt > itemTs) {
        mergedMap.delete(id);
      }
    }
  }
  
  return Array.from(mergedMap.values());
}

/**
 * Merge two tombstone arrays. For duplicate IDs, keep the more recent deletedAt.
 */
function mergeTombstones(local: Tombstone[], remote: Tombstone[]): Tombstone[] {
  const map = new Map<string, number>();
  for (const t of local) {
    map.set(t.id, t.deletedAt);
  }
  for (const t of remote) {
    const existing = map.get(t.id);
    if (existing === undefined || t.deletedAt > existing) {
      map.set(t.id, t.deletedAt);
    }
  }
  return Array.from(map.entries()).map(([id, deletedAt]) => ({ id, deletedAt }));
}

export async function importVaultBackupFromString(fileStr: string, password: string): Promise<void> {
  const backupData = JSON.parse(fileStr);

  if (!backupData.encrypted || !backupData.salt || !backupData.payload) {
    throw new Error('Invalid or corrupt backup file format.');
  }

  // 2. Decrypt (Finding #4: use cached key for matching salt)
  const { key } = getCachedOrDeriveKey(password, backupData.salt);
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

  // 3. Load current local state
  const localSettings = await loadSettings();
  const localLogs = await loadLogs();
  const localSessions = await loadWorkoutSessions();
  const localTemplates = await loadTemplates();
  const localCustomExercises = await loadCustomExercises();
  const localDefaults = await loadExerciseDefaults();

  // Finding #1: Load and merge tombstones
  const localTombstones = await loadTombstones();
  const remoteTombstones: Tombstone[] = state.tombstones || [];
  const mergedTombstones = mergeTombstones(localTombstones, remoteTombstones);

  // 4. Merge hydration logs and workouts (Finding #1: tombstone-aware)
  const mergedLogs = mergeById(localLogs, state.hydration_history, 'id', mergedTombstones, 'timestamp');
  const mergedSessions = mergeById(localSessions, state.workout_sessions || [], 'id', mergedTombstones, 'startTime');
  const mergedTemplates = mergeById(localTemplates, state.workout_templates || [], 'id', mergedTombstones);
  const mergedCustomExercises = mergeById(localCustomExercises, state.custom_exercises || [], 'id', mergedTombstones);

  // 5. Merge settings (prefer remote if remote is newer, but preserve customLiquids and decafPrefs)
  const remoteSettings = state.settings || {};
  const remoteTimestamp = remoteSettings.updatedAt || state.exportedAt || '';
  const localTimestamp = localSettings.updatedAt || '';

  let finalSettings = { ...localSettings };
  if (remoteTimestamp > localTimestamp) {
    finalSettings = { ...remoteSettings };
  }

  // Ensure custom liquids and decaf preferences are merged from both sides
  finalSettings.customLiquids = {
    ...localSettings.customLiquids,
    ...remoteSettings.customLiquids
  };
  finalSettings.decafPrefs = {
    ...localSettings.decafPrefs,
    ...remoteSettings.decafPrefs
  };

  // 6. Merge exercise defaults
  const mergedDefaults = {
    ...localDefaults,
    ...(state.exercise_defaults || {})
  };

  // Finding #2: Atomic save via staging key
  // Write all merged data to a staging key first, then save individually, then clear staging
  const stagingPayload = JSON.stringify({
    settings: finalSettings,
    logs: mergedLogs,
    sessions: mergedSessions,
    templates: mergedTemplates,
    customExercises: mergedCustomExercises,
    defaults: mergedDefaults,
    tombstones: mergedTombstones,
  });
  await AsyncStorage.setItem(MERGE_STAGING_KEY, stagingPayload);

  // 7. Save merged state
  await saveSettings(finalSettings);
  await saveLogs(mergedLogs);
  await saveWorkoutSessions(mergedSessions);
  await saveTemplates(mergedTemplates);
  await saveCustomExercises(mergedCustomExercises);
  await saveExerciseDefaults(mergedDefaults);
  await saveTombstones(mergedTombstones);

  // Clear staging key — save completed successfully
  await AsyncStorage.removeItem(MERGE_STAGING_KEY);

  // Prune old tombstones (90 days)
  await pruneTombstones(90);
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
