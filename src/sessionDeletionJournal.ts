import { loadFromStorageResult, saveToStorageStrict } from './utils';
import { loadWorkoutSessionsResult, saveWorkoutSessions } from './trainingStorage';
import { SESSION_DELETION_JOURNAL_STORAGE_KEY } from './trainingStorageKeys';
import { loadTombstonesStrict, saveTombstonesStrict } from './tombstones';
import type { SessionDeletionJournal } from './sessionDeletionTransaction';
import {
  decodeSessionDeletionJournal,
  recoverSessionDeletionWithDependencies,
} from './sessionDeletionRecovery';
export type { SessionDeletionRecoveryResult } from './sessionDeletionRecovery';

const SESSION_DELETION_JOURNAL_DECODER_VERSION = 1;

export async function loadSessionDeletionJournalResult() {
  return loadFromStorageResult(SESSION_DELETION_JOURNAL_STORAGE_KEY, {
    decoderVersion: SESSION_DELETION_JOURNAL_DECODER_VERSION,
    absentValue: null,
    failureValue: null,
    decode: decodeSessionDeletionJournal,
  });
}

export function saveSessionDeletionJournalStrict(journal: SessionDeletionJournal): Promise<void> {
  return saveToStorageStrict(SESSION_DELETION_JOURNAL_STORAGE_KEY, journal);
}

export function clearSessionDeletionJournalStrict(): Promise<void> {
  return saveToStorageStrict(SESSION_DELETION_JOURNAL_STORAGE_KEY, null);
}

export async function recoverPendingSessionDeletion() {
  return recoverSessionDeletionWithDependencies({
    readJournal: async () => {
      const result = await loadSessionDeletionJournalResult();
      return { status: result.status, sourceFormat: result.sourceFormat, value: result.value };
    },
    readSessions: async () => {
      const result = await loadWorkoutSessionsResult();
      return { status: result.status, value: result.value };
    },
    readTombstones: loadTombstonesStrict,
    persistSessions: saveWorkoutSessions,
    persistTombstones: saveTombstonesStrict,
    clearJournal: clearSessionDeletionJournalStrict,
  });
}
