import { findStateFileId, uploadStateToDrive, downloadStateFromDrive } from './googleDrive';
import { exportVaultBackupToString, importVaultBackupFromString } from './backup';

export async function performDriveSync(
  token: string, 
  passwordOrPrompt: string | (() => Promise<string>),
  onProgress?: (msg: string) => void
): Promise<boolean> {
  try {
    if (onProgress) onProgress('Checking Google Drive...');
    const remoteFile = await findStateFileId(token);

    // Let's assume we have a way to get the local last_saved time.
    // For now, if no remote file exists, we just upload.
    if (!remoteFile) {
      if (onProgress) onProgress('Creating backup on Google Drive...');
      // We need a password to encrypt. If it's a prompt, call it.
      const pwd = typeof passwordOrPrompt === 'function' ? await passwordOrPrompt() : passwordOrPrompt;
      if (!pwd) throw new Error('Password required for initial sync');
      
      const encryptedData = await exportVaultBackupToString(pwd);
      await uploadStateToDrive(token, null, encryptedData);
      if (onProgress) onProgress('Backup created successfully.');
      return true;
    }

    // A remote file exists. We should compare timestamps if we had them easily accessible,
    // but for simplicity and safety, if the user triggered this manually, we can prompt 
    // them whether to push or pull, OR we just do a simple pull if remote is newer.
    // Given the constraints, let's just do a pull if they hit sync, or perhaps 
    // we need to read the remote file and restore.

    if (onProgress) onProgress('Downloading backup from Google Drive...');
    const remoteData = await downloadStateFromDrive(token, remoteFile.id);
    
    if (onProgress) onProgress('Decrypting and importing...');
    const pwd = typeof passwordOrPrompt === 'function' ? await passwordOrPrompt() : passwordOrPrompt;
    if (!pwd) throw new Error('Password required to import sync');
    
    await importVaultBackupFromString(remoteData, pwd);
    
    if (onProgress) onProgress('Sync completed successfully!');
    return true;
  } catch (error: any) {
    console.error('Drive sync error:', error);
    if (onProgress) onProgress(`Sync failed: ${error.message}`);
    return false;
  }
}
