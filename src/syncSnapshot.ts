import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportVaultBackupToString, importVaultBackupFromString } from './backup';

const SNAPSHOT_KEY = 'nexus_pre_merge_snapshot';

export async function savePreMergeSnapshot(password: string): Promise<void> {
  // Use existing export logic to create an encrypted blob
  const encryptedSnapshot = await exportVaultBackupToString(password);
  await AsyncStorage.setItem(SNAPSHOT_KEY, encryptedSnapshot);
}

export async function restoreFromSnapshot(password: string): Promise<void> {
  const snapshotData = await AsyncStorage.getItem(SNAPSHOT_KEY);
  if (!snapshotData) throw new Error("No snapshot found");
  
  // Re-import the snapshot, skipping cloud push
  await importVaultBackupFromString(snapshotData, password);
}

export async function hasPreMergeSnapshot(): Promise<boolean> {
  const snapshotData = await AsyncStorage.getItem(SNAPSHOT_KEY);
  return !!snapshotData;
}

export async function clearPreMergeSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(SNAPSHOT_KEY);
}
