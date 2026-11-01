import AsyncStorage from '@react-native-async-storage/async-storage';
import { recoverPendingSessionDeletion } from './sessionDeletionJournal';
import { runSessionDeletionSyncGate } from './sessionDeletionSyncGate';
import { runTombstoneTransaction } from './tombstoneTransactionQueue';

export function runWithSessionDeletionRecovery<T>(operation: () => Promise<T>): Promise<T> {
  return runSessionDeletionSyncGate(operation, {
    recover: recoverPendingSessionDeletion,
    markDirty: () => AsyncStorage.setItem('nexus_sync_dirty', 'true'),
    runExclusive: runTombstoneTransaction,
  });
}
