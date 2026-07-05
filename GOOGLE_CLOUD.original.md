# Google Cloud Sync & Data Vault: API Guide & Guardrails

This document serves as the comprehensive manual for future AI agents working on the NEXUS application's Data Vault, Encryption, and Google Drive Cloud Sync functionalities. 

**CRITICAL:** Read this document entirely before modifying any code related to `src/security.ts`, `src/backup.ts`, `src/sync.ts`, `src/utils.ts`, or any `useEffect` hooks in `App.tsx` that deal with data loading or syncing.

---

## 1. The SecureStore Lock Mechanism (The "Wipe" Bug)

**The Concept:** NEXUS encrypts all data locally and on the cloud using AES-256-GCM. The encryption master key is stored in the iOS Keychain via `expo-secure-store` using the `WHEN_UNLOCKED_THIS_DEVICE_ONLY` policy.

**The Danger:** 
When the iOS device is locked (screen off, before FaceID/passcode), `SecureStore` is physically blocked from reading the key.
If iOS wakes the app up in the background (e.g., for a notification or background fetch) and the app attempts to read/write storage or perform a cloud push, `SecureStore` will throw an error.

**Guardrails:**
- **NEVER swallow cryptographic errors:** If `getOrGenerateMasterKey()` fails, it must explicitly `throw new Error('SECURE_STORE_LOCKED')`. It must NEVER generate a dummy/fallback key. Doing so will encrypt the database with the dummy key, resulting in permanent silent data erasure.
- **Fail-Fast Background Tasks:** Any background task (`handleCloudAutoPush`, `checkAndSync`) MUST catch the `SECURE_STORE_LOCKED` error and cleanly abort. Do not crash, do not retry indefinitely, and do not overwrite data.
- **Foreground Retry Loops:** In `App.tsx`'s `initApp()`, we use a `while(true)` 1-second retry loop to catch `SECURE_STORE_LOCKED`. This handles the edge case where the user launches the app in the split-second before FaceID fully unlocks the Keychain.

---

## 2. Google Drive Authentication Lifecycle

**The Concept:** The app uses a silent background token refresh to maintain the user's connection to Google Drive without requiring them to log in every time.

**The Danger:**
Because of the silent refresh, the `accessToken` starts as `null` on app bootup, and then transitions to a `string` a fraction of a second later. 
Previously, an agent wrote a `useEffect` in `SettingsModal.tsx` that watched for `!prev && accessToken` to automatically flip `googleDriveAutoSyncEnabled` to `true`. This inadvertently overwrote the user's settings on every single bootup.

**Guardrails:**
- **No Aggressive Auto-Enabling:** Do not use `useEffect` to watch `accessToken` transitions to change user settings like auto-sync. Trust the persisted `UserSettings`. 
- **Respect User Choice:** Auto-sync is default `true` for new users. If they manually toggle it to `false` and then restart the app, it must stay `false`.
- **Disconnect Flow:** The "Disconnect" button should only call `logout()`. It does not need to aggressively mutate settings. If `accessToken` is null, the app simply won't sync.

---

## 3. Tombstones & Data Merging (CRDT)

**The Concept:** NEXUS allows users to use multiple devices offline. To sync them, it uses a custom Last-Write-Wins (LWW) merge algorithm (`mergeById`) paired with Tombstones (`tombstones.ts`) to track deletions.

**The Danger:**
If tombstones are not included in the payload, a device that deleted a drink will have that drink constantly re-appear when syncing with a device that still has it. 
Conversely, if a user manually imports a `.nexus` backup file, local tombstones might accidentally delete the data they are trying to import.

**Guardrails:**
- **Always Sync Tombstones:** `exportVaultBackupToString` MUST include `tombstones: await loadTombstones()`.
- **Import-Aware Tombstones:** In `importVaultBackupFromString`, local tombstones that target items actively present in the imported file must be ignored (`importAwareTombstones`). If the user imports a file, the file's contents take precedence over past local deletions.
- **Clean up:** After a successful import or sync, `pruneTombstones(90)` must be called to prevent infinite growth of the deletion ledger.

---

## 4. The Dirty Flag & Push vs. Sync

**The Concept:** To save API calls, `handleCloudAutoPush` (which fires after every drink logged) only does a one-way *push* to Google Drive. 

**The Danger:**
If Device A is offline, logs a drink, and sets the `nexus_sync_dirty` flag. Meanwhile, Device B pushes new logs to the cloud. When Device A regains connection, if it just does a blind push, it will overwrite and destroy Device B's logs!

**Guardrails:**
- **Check the Dirty Flag:** Before running a background push, or on app bootup, the app must check `nexus_sync_dirty`. 
- **Dirty = Full Sync:** If the flag is `true`, the app MUST perform a full `performDriveSync` (pull-merge-push) instead of a blind push. 
- **Clear on Success:** `performDriveSync` and `performDrivePush` must only clear the dirty flag (`false`) *after* a successful upload. If the upload fails, set it to `true`.
- **Debounce Pushes:** Always use a `useRef` (e.g., `pushInFlight`) to prevent overlapping `handleCloudAutoPush` calls from causing race conditions.

---

## 5. Atomic File Operations

**The Concept:** Writing the entire database to `AsyncStorage` involves multiple asynchronous calls (`saveSettings`, `saveLogs`, `saveWorkoutSessions`, etc.).

**The Danger:**
If the app crashes or the user forces it closed in the middle of a `importVaultBackupFromString` loop, the database will be corrupted (e.g., settings imported, but logs not imported).

**Guardrails:**
- **Staging Keys:** All merge operations MUST write the combined JSON payload to `MERGE_STAGING_KEY` first.
- **Save and Clear:** Only after the staging key is written do we individually call `saveLogs`, `saveSettings`, etc. Once all individual saves succeed, delete the staging key.
- **Bootup Replay:** On app launch (`App.tsx`), `replayPendingMerge()` must be executed BEFORE any cloud syncs. If it finds data in the staging key, it knows a crash occurred and will finish saving the data.

---

## 6. Cryptography UI Freezes

**The Concept:** The app uses PBKDF2 with 10,000 iterations to derive a 256-bit AES key from the user's password. 

**The Danger:**
10,000 rounds of PBKDF2 in pure JavaScript (`crypto-js`) is computationally heavy and blocks the UI thread for ~100-300ms. If this is called multiple times during a sync loop, the app will freeze entirely.

**Guardrails:**
- **In-Memory Cache:** `getCachedOrDeriveKey` in `backup.ts` must be used. It stores the derived key in `cachedDerivedKey`. 
- **Clear on Logout:** Only clear this cache when the user actively changes their password or logs out. Do not re-derive the key on every single auto-push. 
