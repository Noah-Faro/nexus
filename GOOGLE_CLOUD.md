# Google Cloud Sync & Data Vault: API Guide & Guardrails

Manual for AI agents working on NEXUS Data Vault, Encryption, and Google Drive Cloud Sync.

**CRITICAL:** Read document before modifying code related to `src/security.ts`, `src/backup.ts`, `src/sync.ts`, `src/utils.ts`, or `useEffect` hooks in `App.tsx` dealing with data loading or syncing.

Also adjust this document in case the implementation of the cloud save changes.

---

## 1. The SecureStore Lock Mechanism (The "Wipe" Bug)

**The Concept:** NEXUS encrypt all data locally and on cloud using AES-256-GCM. Encryption master key stored in iOS Keychain via `expo-secure-store` using `WHEN_UNLOCKED_THIS_DEVICE_ONLY` policy.

**The Danger:** 
When iOS device locked (screen off, before FaceID/passcode), `SecureStore` physically blocked from reading key.
If iOS wake app in background (e.g. notification or background fetch) and app attempt read/write storage or perform cloud push, `SecureStore` throw error.

**Guardrails:**
- **NEVER swallow cryptographic errors:** If `getOrGenerateMasterKey()` fail, must explicitly `throw new Error('SECURE_STORE_LOCKED')`. NEVER generate dummy/fallback key. Doing so encrypt database with dummy key, resulting in permanent silent data erasure.
- **Fail-Fast Background Tasks:** Any background task (`handleCloudAutoPush`, `checkAndSync`) MUST catch `SECURE_STORE_LOCKED` error and cleanly abort. Do not crash, do not retry indefinitely, do not overwrite data.
- **Foreground Retry Loops:** In `App.tsx`'s `initApp()`, use `while(true)` 1-second retry loop to catch `SECURE_STORE_LOCKED`. Handle edge case where user launch app split-second before FaceID unlock Keychain.

---

## 2. Google Drive Authentication Lifecycle

**The Concept:** App use silent background token refresh to maintain user connection to Google Drive without requiring login every time.

**The Danger:**
Because of silent refresh, `accessToken` start as `null` on app bootup, then transition to `string` fraction of second later. 
Previously agent wrote `useEffect` in `SettingsModal.tsx` watching for `!prev && accessToken` to automatically flip `googleDriveAutoSyncEnabled` to `true`. Inadvertently overwrite user settings on every bootup.

**Guardrails:**
- **No Aggressive Auto-Enabling:** Do not use `useEffect` to watch `accessToken` transitions to change user settings like auto-sync. Trust persisted `UserSettings`. 
- **Respect User Choice:** Auto-sync default `true` for new users. If manually toggle `false` and restart app, must stay `false`.
- **Disconnect Flow:** "Disconnect" button should only call `logout()`. Do not aggressively mutate settings. If `accessToken` null, app won't sync.

---

## 3. Tombstones & Data Merging (CRDT)

**The Concept:** NEXUS allow users use multiple devices offline. To sync, use custom Last-Write-Wins (LWW) merge algorithm (`mergeById`) paired with Tombstones (`tombstones.ts`) to track deletions.

**The Danger:**
If tombstones not included in payload, device that deleted drink will have drink constantly re-appear when syncing with device that still has it. 
Conversely, if user manually import `.nexus` backup file, local tombstones might accidentally delete data trying to import.

**Guardrails:**
- **Always Sync Tombstones:** `exportVaultBackupToString` MUST include `tombstones: await loadTombstones()`.
- **Import-Aware Tombstones:** In `importVaultBackupFromString`, local tombstones targeting items actively present in imported file must be ignored (`importAwareTombstones`). If user import file, file contents take precedence over past local deletions.
- **Clean up:** After successful import or sync, `pruneTombstones(90)` must be called to prevent infinite growth of deletion ledger.

---

## 4. The Dirty Flag & Push vs. Sync

**The Concept:** To save API calls, `handleCloudAutoPush` (fires after every drink logged) only do one-way *push* to Google Drive. 

**The Danger:**
If Device A offline, log drink, set `nexus_sync_dirty` flag. Meanwhile, Device B push new logs to cloud. When Device A regain connection, if do blind push, will overwrite and destroy Device B logs!

**Guardrails:**
- **Check the Dirty Flag:** Before running background push, or on app bootup, app must check `nexus_sync_dirty`. 
- **Dirty = Full Sync:** If flag `true`, app MUST perform full `performDriveSync` (pull-merge-push) instead of blind push. 
- **Clear on Success:** `performDriveSync` and `performDrivePush` must only clear dirty flag (`false`) *after* successful upload. If upload fail, set to `true`.
- **Debounce Pushes:** Always use `useRef` (e.g. `pushInFlight`) to prevent overlapping `handleCloudAutoPush` calls causing race conditions.

---

## 5. Atomic File Operations

**The Concept:** Writing entire database to `AsyncStorage` involves multiple asynchronous calls (`saveSettings`, `saveLogs`, `saveWorkoutSessions`, etc.).

**The Danger:**
If app crash or user force close in middle of `importVaultBackupFromString` loop, database will be corrupted (e.g. settings imported, but logs not imported).

**Guardrails:**
- **Staging Keys:** All merge operations MUST write combined JSON payload to `MERGE_STAGING_KEY` first.
- **Save and Clear:** Only after staging key written do individually call `saveLogs`, `saveSettings`, etc. Once all individual saves succeed, delete staging key.
- **Bootup Replay:** On app launch (`App.tsx`), `replayPendingMerge()` must be executed BEFORE any cloud syncs. If find data in staging key, know crash occurred and will finish saving data.

---

## 6. Cryptography UI Freezes

**The Concept:** App use PBKDF2 with 10,000 iterations to derive 256-bit AES key from user password. 

**The Danger:**
10,000 rounds of PBKDF2 in pure JavaScript (`crypto-js`) computationally heavy and blocks UI thread for ~100-300ms. If called multiple times during sync loop, app freeze entirely.

**Guardrails:**
- **In-Memory Cache:** `getCachedOrDeriveKey` in `backup.ts` must be used. Store derived key in `cachedDerivedKey`. 
- **Clear on Logout:** Only clear cache when user actively change password or log out. Do not re-derive key on every auto-push. 
