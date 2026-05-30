import AsyncStorage from '@react-native-async-storage/async-storage';
import { findStateFileId, uploadStateToDrive, downloadStateFromDrive } from './googleDrive';
import { exportVaultBackupToString, importVaultBackupFromString } from './backup';

function mapSyncError(error: any): string {
  const msg = error?.message || '';
  if (msg.includes('Incorrect password') || msg.includes('Incorrect password or corrupt payload.')) {
    return 'Wrong password. Enter the same password you used when first syncing.';
  }
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch') || msg.includes('fetch')) {
    return 'Could not connect to Google Drive. Check your internet connection.';
  }
  return msg || 'An unknown error occurred during sync.';
}

export async function performDriveSync(
  token: string, 
  passwordOrPrompt: string | (() => Promise<string>),
  onProgress?: (msg: string) => void
): Promise<boolean> {
  try {
    if (onProgress) onProgress('Checking Google Drive...');
    const remoteFile = await findStateFileId(token);

    // If no remote file exists, we just upload local state as the initial backup.
    if (!remoteFile) {
      if (onProgress) onProgress('Creating backup on Google Drive...');
      const pwd = typeof passwordOrPrompt === 'function' ? await passwordOrPrompt() : passwordOrPrompt;
      if (!pwd) throw new Error('Password required for initial sync');
      
      const encryptedData = await exportVaultBackupToString(pwd);
      await uploadStateToDrive(token, null, encryptedData);
      
      // Success: clear dirty flag
      await AsyncStorage.setItem('nexus_sync_dirty', 'false').catch(console.error);
      
      if (onProgress) onProgress('Backup created successfully.');
      return true;
    }

    // A remote file exists, download and import it.
    if (onProgress) onProgress('Downloading backup from Google Drive...');
    const remoteData = await downloadStateFromDrive(token, remoteFile.id);
    
    if (onProgress) onProgress('Decrypting and merging...');
    const pwd = typeof passwordOrPrompt === 'function' ? await passwordOrPrompt() : passwordOrPrompt;
    if (!pwd) throw new Error('Password required to import sync');
    
    // Perform merge-import
    await importVaultBackupFromString(remoteData, pwd);
    
    // Push-After-Pull: Upload merged state back to drive immediately
    try {
      if (onProgress) onProgress('Syncing merged state back to cloud...');
      const encryptedData = await exportVaultBackupToString(pwd);
      await uploadStateToDrive(token, remoteFile.id, encryptedData);
      
      // Success: clear dirty flag
      await AsyncStorage.setItem('nexus_sync_dirty', 'false').catch(console.error);
    } catch (pushErr) {
      console.warn('Pull-merge succeeded but failed pushing merged state back. Flagging as dirty.', pushErr);
      await AsyncStorage.setItem('nexus_sync_dirty', 'true').catch(console.error);
      throw pushErr;
    }
    
    if (onProgress) onProgress('Sync completed successfully!');
    return true;
  } catch (error: any) {
    console.error('Drive sync error:', error);
    const friendlyMsg = mapSyncError(error);
    if (onProgress) onProgress(`Sync failed: ${friendlyMsg}`);
    throw new Error(friendlyMsg);
  }
}

export async function performDrivePush(
  token: string,
  password: string,
  onProgress?: (msg: string) => void
): Promise<boolean> {
  try {
    if (onProgress) onProgress('Checking Google Drive...');
    const remoteFile = await findStateFileId(token);
    
    if (onProgress) onProgress('Encrypting local database...');
    const encryptedData = await exportVaultBackupToString(password);
    
    if (onProgress) onProgress('Uploading encrypted backup to Google Drive...');
    await uploadStateToDrive(token, remoteFile ? remoteFile.id : null, encryptedData);
    
    // Success: clear dirty flag
    await AsyncStorage.setItem('nexus_sync_dirty', 'false').catch(console.error);
    
    if (onProgress) onProgress('Cloud push completed successfully.');
    return true;
  } catch (error: any) {
    console.error('Drive push error:', error);
    
    // Failure: set dirty flag so we retry on next startup/network recovery
    await AsyncStorage.setItem('nexus_sync_dirty', 'true').catch(console.error);
    
    const friendlyMsg = mapSyncError(error);
    if (onProgress) onProgress(`Push failed: ${friendlyMsg}`);
    throw new Error(friendlyMsg);
  }
}
