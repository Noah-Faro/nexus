import {
  loadStructuredStorageValue,
  saveStructuredStorageValue,
  type StructuredStorageLoadOptions,
  type StructuredStorageReadDependencies,
} from './structuredStorage';
import {
  decodeWorkoutSessions,
  recoveryHistoryCompletenessForStatus,
  TRAINING_STORAGE_DECODER_VERSION,
  type TrainingDecodeIssue,
} from './trainingDecoders';
import type { WorkoutSession } from './trainingTypes';
import { replayStagedMerge } from './mergeReplay';
import {
  SESSION_DELETION_JOURNAL_STORAGE_KEY,
  TRAINING_SESSIONS_STORAGE_KEY,
} from './trainingStorageKeys';
import { finishSessionTransaction } from './finishSessionTransaction';
import { deleteSessionTransaction } from './sessionDeletionTransaction';
import type { Tombstone } from './tombstones';
import {
  decodeSessionDeletionJournal,
  recoverSessionDeletionWithDependencies,
  type SessionDeletionJournalRead,
} from './sessionDeletionRecovery';
import {
  runSessionDeletionSyncGate,
  SessionDeletionRecoveryBlockedError,
} from './sessionDeletionSyncGate';
import { createTombstoneTransactionRunner } from './tombstoneTransactionQueue';
import { buildVaultBackupState } from './backupPayload';
import {
  SerializedAsyncQueue,
  shouldEnqueueActiveSessionAutosave,
} from './serializedAsyncQueue';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Training storage assertion failed: ${message}`);
}

async function captureRejection(action: () => Promise<void>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Training storage assertion failed: expected write to reject.');
}

const validLegacySession = {
  id: 'legacy-session',
  templateId: 'template-push-a',
  templateName: 'Push A',
  startTime: 1,
  endTime: 2,
  sets: [{
    id: 'legacy-set',
    exerciseId: 'bench-press',
    exerciseName: 'Bench Press',
    setNumber: 1,
    weight: 80,
    reps: 8,
    timestamp: 2,
    estimated1RM: 101,
  }],
  totalVolume: 640,
  sessionNumber: 1,
};

const options: StructuredStorageLoadOptions<WorkoutSession[], TrainingDecodeIssue> = {
  decoderVersion: TRAINING_STORAGE_DECODER_VERSION,
  absentValue: [],
  failureValue: [],
  decode: decodeWorkoutSessions,
};

export async function runTrainingStorageAssertions(): Promise<void> {
  assert(
    TRAINING_SESSIONS_STORAGE_KEY === '@nexus_training_sessions',
    'session persistence retains its canonical storage key',
  );
  assert(
    String(SESSION_DELETION_JOURNAL_STORAGE_KEY) !== String(TRAINING_SESSIONS_STORAGE_KEY),
    'deletion recovery uses a separate key without changing legacy session persistence',
  );
  let raw: string | null = null;
  let readError: Error | null = null;
  let decryptError: Error | null = null;
  let writeCount = 0;
  let readCount = 0;
  let decryptCount = 0;

  const fakeStorage = {
    getItem: async (): Promise<string | null> => {
      readCount += 1;
      if (readError) throw readError;
      return raw;
    },
    setItem: async (): Promise<void> => {
      writeCount += 1;
    },
  };
  const dependencies: StructuredStorageReadDependencies = {
    read: fakeStorage.getItem,
    decrypt: async () => {
      decryptCount += 1;
      if (decryptError) throw decryptError;
      return JSON.stringify([validLegacySession]);
    },
  };

  let result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(result.status === 'absent' && result.sourceFormat === 'none', 'absent value is distinguished');

  raw = JSON.stringify([validLegacySession]);
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(
    result.status === 'valid' &&
      result.sourceFormat === 'legacy_plaintext' &&
      result.value[0].sets[0].weightUnit === 'kg',
    'legacy plaintext is decoded and normalized',
  );

  raw = ` \n${JSON.stringify([validLegacySession])}\t `;
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(
    result.status === 'valid' && result.sourceFormat === 'legacy_plaintext',
    'whitespace-prefixed valid JSON remains legacy plaintext',
  );

  raw = ' \n{"looks":"like:three:parts"}\t ';
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(
    result.status === 'invalid' && result.sourceFormat === 'legacy_plaintext',
    'whitespace-prefixed schema-invalid JSON remains plaintext rather than encrypted or unreadable',
  );

  raw = '0123456789abcdef0123456789abcdef:YWJjZA==:ZWZnaA==';
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(
    result.status === 'valid' && result.sourceFormat === 'encrypted' && decryptCount === 1,
    'encrypted payload is classified and decoded through the injected decryptor',
  );

  raw = JSON.stringify([
    validLegacySession,
    { ...validLegacySession, id: 'invalid-session', sets: 'invalid' },
  ]);
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(
    result.status === 'invalid' && result.value.length === 1 && result.issues.length > 0,
    'invalid schema retains only its validated recoverable value',
  );

  raw = 'not-json';
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(result.status === 'unreadable', 'invalid JSON is unreadable rather than absent or invalid schema');

  raw = '0123456789abcdef0123456789abcdef:YWJjZA==:ZWZnaA==';
  decryptError = new Error('decrypt failed');
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(result.status === 'unreadable', 'ordinary decrypt failure is unreadable');

  decryptError = new Error('SECURE_STORE_LOCKED');
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(result.status === 'locked', 'exact secure-store lock from decrypt is classified as locked');

  decryptError = null;
  readError = new Error('read failed');
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(result.status === 'unreadable' && result.sourceFormat === 'none', 'ordinary storage read failure is unreadable');

  readError = new Error('SECURE_STORE_LOCKED');
  result = await loadStructuredStorageValue('sessions', options, dependencies);
  assert(result.status === 'locked', 'exact secure-store lock from storage read is classified as locked');

  readError = null;
  raw = '[]';
  const throwingOptions: StructuredStorageLoadOptions<WorkoutSession[], TrainingDecodeIssue> = {
    ...options,
    decode: () => { throw new Error('unexpected decoder failure'); },
  };
  result = await loadStructuredStorageValue('sessions', throwingOptions, dependencies);
  assert(result.status === 'unreadable', 'unexpected decoder failure is surfaced as unreadable');

  assert(readCount === 12, 'each classification performs exactly one storage read');
  assert(writeCount === 0, 'structured reads never invoke storage writes');
  assert(
    recoveryHistoryCompletenessForStatus('valid') === 'complete' &&
      recoveryHistoryCompletenessForStatus('absent') === 'complete' &&
      recoveryHistoryCompletenessForStatus('invalid') === 'unknown' &&
      recoveryHistoryCompletenessForStatus('unreadable') === 'unknown' &&
      recoveryHistoryCompletenessForStatus('locked') === 'unknown',
    'structured session status propagates to Recovery history completeness',
  );

  let encryptedInput: string | null = null;
  let writtenPayload: string | null = null;
  let strictWriteCount = 0;
  await saveStructuredStorageValue([validLegacySession], {
    encrypt: serialized => {
      encryptedInput = serialized;
      return 'encrypted-payload';
    },
    write: payload => {
      strictWriteCount += 1;
      writtenPayload = payload;
    },
  });
  assert(
    strictWriteCount === 1 &&
      encryptedInput === JSON.stringify([validLegacySession]) &&
      writtenPayload === 'encrypted-payload',
    'successful strict persistence serializes, encrypts, and writes exactly once',
  );

  const circular: { self?: unknown } = {};
  circular.self = circular;
  let encryptCalledForCircularValue = false;
  const serializationError = await captureRejection(() => saveStructuredStorageValue(circular, {
    encrypt: () => {
      encryptCalledForCircularValue = true;
      return 'unreachable';
    },
    write: () => { throw new Error('unreachable write'); },
  }));
  assert(
    serializationError instanceof Error && !encryptCalledForCircularValue,
    'JSON serialization rejection propagates before encryption or write',
  );

  let encryptCalledForUndefined = false;
  const undefinedSerializationError = await captureRejection(() => saveStructuredStorageValue(undefined, {
    encrypt: () => {
      encryptCalledForUndefined = true;
      return 'unreachable';
    },
    write: () => { throw new Error('unreachable write'); },
  }));
  assert(
    undefinedSerializationError instanceof TypeError && !encryptCalledForUndefined,
    'JSON.stringify undefined rejection propagates before encryption or write',
  );

  const encryptionError = new Error('encrypt failed');
  let writeAfterEncryptionFailure = false;
  const observedEncryptionError = await captureRejection(() => saveStructuredStorageValue([], {
    encrypt: () => { throw encryptionError; },
    write: () => { writeAfterEncryptionFailure = true; },
  }));
  assert(
    observedEncryptionError === encryptionError && !writeAfterEncryptionFailure,
    'ordinary encryption rejection propagates unchanged and prevents write',
  );

  const asyncEncryptionError = new Error('async encrypt failed');
  const observedAsyncEncryptionError = await captureRejection(() => saveStructuredStorageValue([], {
    encrypt: () => Promise.reject(asyncEncryptionError),
    write: () => { throw new Error('unreachable write'); },
  }));
  assert(
    observedAsyncEncryptionError === asyncEncryptionError,
    'Promise-rejected encryption propagates unchanged',
  );

  const encryptionLockedError = new Error('SECURE_STORE_LOCKED');
  const observedEncryptionLockedError = await captureRejection(() => saveStructuredStorageValue([], {
    encrypt: () => { throw encryptionLockedError; },
    write: () => { throw new Error('unreachable write'); },
  }));
  assert(
    observedEncryptionLockedError === encryptionLockedError,
    'secure-store lock rejection from key/encryption stage propagates unchanged',
  );

  const writeError = new Error('write failed');
  const observedWriteError = await captureRejection(() => saveStructuredStorageValue([], {
    encrypt: () => 'encrypted-payload',
    write: () => { throw writeError; },
  }));
  assert(observedWriteError === writeError, 'ordinary storage write rejection propagates unchanged');

  const asyncWriteError = new Error('async write failed');
  const observedAsyncWriteError = await captureRejection(() => saveStructuredStorageValue([], {
    encrypt: () => 'encrypted-payload',
    write: () => Promise.reject(asyncWriteError),
  }));
  assert(observedAsyncWriteError === asyncWriteError, 'Promise-rejected write propagates unchanged');

  const writeLockedError = new Error('SECURE_STORE_LOCKED');
  const observedWriteLockedError = await captureRejection(() => saveStructuredStorageValue([], {
    encrypt: () => 'encrypted-payload',
    write: () => { throw writeLockedError; },
  }));
  assert(
    observedWriteLockedError === writeLockedError,
    'secure-store lock rejection from write stage propagates unchanged',
  );

  const successfulReplayEvents: string[] = [];
  const replayed = await replayStagedMerge('{"sessions":[]}', {
    parse: serialized => JSON.parse(serialized) as { sessions: unknown[] },
    writeSteps: () => [
      async () => { successfulReplayEvents.push('settings'); },
      async () => { successfulReplayEvents.push('sessions'); },
    ],
    removeStaging: async () => { successfulReplayEvents.push('remove'); },
  });
  assert(
    replayed && successfulReplayEvents.join(',') === 'settings,sessions,remove',
    'staging removal occurs once and only after every replay write succeeds',
  );

  const replayWriteError = new Error('session replay write failed');
  const failedReplayEvents: string[] = [];
  const observedReplayWriteError = await captureRejection(async () => {
    await replayStagedMerge('{"sessions":[]}', {
      parse: serialized => JSON.parse(serialized) as { sessions: unknown[] },
      writeSteps: () => [
        async () => { failedReplayEvents.push('settings'); },
        async () => {
          failedReplayEvents.push('sessions');
          throw replayWriteError;
        },
        async () => { failedReplayEvents.push('later-write'); },
      ],
      removeStaging: async () => { failedReplayEvents.push('remove'); },
    });
  });
  assert(
    observedReplayWriteError === replayWriteError &&
      failedReplayEvents.join(',') === 'settings,sessions',
    'replay write failure propagates, stops later writes, and retains staging',
  );

  const malformedReplayEvents: string[] = [];
  const observedParseError = await captureRejection(async () => {
    await replayStagedMerge('not-json', {
      parse: serialized => JSON.parse(serialized),
      writeSteps: () => [async () => { malformedReplayEvents.push('write'); }],
      removeStaging: async () => { malformedReplayEvents.push('remove'); },
    });
  });
  assert(
    observedParseError instanceof Error && malformedReplayEvents.length === 0,
    'malformed staging rejects without writes or deletion',
  );

  const previousSameId: WorkoutSession = {
    id: 'finish-session',
    templateId: 'template-push-a',
    templateName: 'Old snapshot',
    startTime: 1,
    endTime: 2,
    sets: [],
    totalVolume: 0,
    sessionNumber: 1,
  };
  const unrelatedSession: WorkoutSession = {
    ...previousSameId,
    id: 'unrelated-session',
    templateName: 'Unrelated',
  };
  const completedSession: WorkoutSession = {
    ...previousSameId,
    templateName: 'Completed snapshot',
    endTime: 3,
  };

  const historyFailure = new Error('history write failed');
  let clearAfterHistoryFailure = 0;
  let commitAfterHistoryFailure = 0;
  let hapticAfterHistoryFailure = 0;
  const observedHistoryFailure = await captureRejection(async () => {
    await finishSessionTransaction([previousSameId, unrelatedSession], completedSession, {
      persistHistory: async () => { throw historyFailure; },
      clearActiveCache: async () => { clearAfterHistoryFailure += 1; },
      commit: () => {
        commitAfterHistoryFailure += 1;
        hapticAfterHistoryFailure += 1;
      },
    });
  });
  assert(
    observedHistoryFailure === historyFailure &&
      clearAfterHistoryFailure === 0 &&
      commitAfterHistoryFailure === 0 &&
      hapticAfterHistoryFailure === 0,
    'history failure propagates without cache clear, state commit, or success haptic',
  );

  const clearFailure = new Error('active cache clear failed');
  let durablyWrittenBeforeClearFailure: readonly WorkoutSession[] = [];
  let commitAfterClearFailure = 0;
  const observedClearFailure = await captureRejection(async () => {
    await finishSessionTransaction([previousSameId, unrelatedSession], completedSession, {
      persistHistory: async sessions => { durablyWrittenBeforeClearFailure = sessions; },
      clearActiveCache: async () => { throw clearFailure; },
      commit: () => { commitAfterClearFailure += 1; },
    });
  });
  assert(
    observedClearFailure === clearFailure &&
      commitAfterClearFailure === 0 &&
      durablyWrittenBeforeClearFailure.filter(session => session.id === completedSession.id).length === 1,
    'active-cache clear failure propagates without exposing durable history in memory',
  );

  const retryEvents: string[] = [];
  let retryCommitCount = 0;
  const retryResult = await finishSessionTransaction(
    durablyWrittenBeforeClearFailure,
    completedSession,
    {
      persistHistory: async sessions => {
        retryEvents.push('history');
        assert(
          sessions.filter(session => session.id === completedSession.id).length === 1,
          'finish retry deduplicates the already durable session ID',
        );
      },
      clearActiveCache: async () => { retryEvents.push('clear'); },
      commit: sessions => {
        retryEvents.push('commit');
        retryCommitCount += 1;
        assert(sessions[0] === completedSession, 'duplicate ID is replaced by the completed snapshot');
      },
    },
  );
  assert(
    retryEvents.join(',') === 'history,clear,commit' &&
      retryCommitCount === 1 &&
      retryResult.length === 2 &&
      retryResult.filter(session => session.id === completedSession.id).length === 1,
    'successful retry preserves write order and performs one deduplicated commit',
  );

  const deletionTimestamp = 42_424;
  const existingDeletionTombstones: Tombstone[] = [
    { id: 'unrelated-deletion', deletedAt: 11 },
    { id: previousSameId.id, deletedAt: 12 },
  ];
  let persistedDeletionSessions = [previousSameId, unrelatedSession];
  let persistedDeletionTombstones = [...existingDeletionTombstones];
  const deletionEvents: string[] = [];
  let deletionCommitCount = 0;
  const successfulDeletion = await deleteSessionTransaction(
    persistedDeletionSessions,
    existingDeletionTombstones,
    previousSameId.id,
    deletionTimestamp,
    {
      persistJournal: async journal => {
        deletionEvents.push('journal');
        assert(
          journal.deletedAt === deletionTimestamp && journal.previousTombstone?.deletedAt === 12,
          'deletion journal uses one timestamp and preserves the prior matching tombstone',
        );
      },
      clearJournal: async () => { deletionEvents.push('clear'); },
      persistSessions: async sessions => {
        deletionEvents.push('history');
        persistedDeletionSessions = sessions;
      },
      persistTombstones: async tombstones => {
        deletionEvents.push('tombstone');
        persistedDeletionTombstones = tombstones;
      },
      readSessions: async () => ({ status: 'valid', value: persistedDeletionSessions }),
      readTombstones: async () => persistedDeletionTombstones,
      commit: () => {
        deletionEvents.push('commit');
        deletionCommitCount += 1;
      },
    },
  );
  assert(
    successfulDeletion.status === 'committed' &&
      deletionEvents.join(',') === 'journal,history,tombstone,commit,clear' &&
      deletionCommitCount === 1 &&
      persistedDeletionSessions.length === 1 &&
      persistedDeletionTombstones.some(tombstone => tombstone.id === 'unrelated-deletion') &&
      persistedDeletionTombstones.filter(tombstone => tombstone.id === previousSameId.id).length === 1,
    'successful deletion preserves order, unrelated tombstones, and one state commit',
  );

  const deletionHistoryError = new Error('deletion history write failed');
  let ambiguousHistory = [previousSameId, unrelatedSession];
  let ambiguousHistoryWrite = 0;
  let historyFailureTombstoneWrites = 0;
  let historyFailureJournalClears = 0;
  const deletionHistoryFailure = await deleteSessionTransaction(
    [previousSameId, unrelatedSession],
    [],
    previousSameId.id,
    deletionTimestamp,
    {
      persistJournal: async () => undefined,
      clearJournal: async () => { historyFailureJournalClears += 1; },
      persistSessions: async sessions => {
        ambiguousHistoryWrite += 1;
        ambiguousHistory = sessions;
        if (ambiguousHistoryWrite === 1) throw deletionHistoryError;
      },
      persistTombstones: async () => { historyFailureTombstoneWrites += 1; },
      readSessions: async () => ({ status: 'valid', value: ambiguousHistory }),
      readTombstones: async () => [],
      commit: () => { throw new Error('unreachable commit'); },
    },
  );
  assert(
    deletionHistoryFailure.status === 'failed' &&
      deletionHistoryFailure.error === deletionHistoryError &&
      deletionHistoryFailure.rollback === 'complete' &&
      ambiguousHistoryWrite === 2 &&
      historyFailureTombstoneWrites === 0 &&
      historyFailureJournalClears === 1 &&
      ambiguousHistory.length === 2,
    'history applied-then-rejected is restored and verified before journal clear without tombstone intent',
  );

  let unresolvedHistory = [previousSameId, unrelatedSession];
  let unresolvedHistoryWrite = 0;
  let unresolvedJournalClears = 0;
  const unresolvedHistoryFailure = await deleteSessionTransaction(
    [previousSameId, unrelatedSession],
    [],
    previousSameId.id,
    deletionTimestamp,
    {
      persistJournal: async () => undefined,
      clearJournal: async () => { unresolvedJournalClears += 1; },
      persistSessions: async sessions => {
        unresolvedHistoryWrite += 1;
        if (unresolvedHistoryWrite === 1) {
          unresolvedHistory = sessions;
          throw deletionHistoryError;
        }
        throw new Error('history restoration rejected');
      },
      persistTombstones: async () => { throw new Error('unreachable tombstone'); },
      readSessions: async () => ({ status: 'valid', value: unresolvedHistory }),
      readTombstones: async () => [],
      commit: () => { throw new Error('unreachable commit'); },
    },
  );
  assert(
    unresolvedHistoryFailure.status === 'failed' &&
      unresolvedHistoryFailure.rollback === 'incomplete' &&
      unresolvedHistoryFailure.reconciledSessions === unresolvedHistory &&
      unresolvedJournalClears === 0,
    'unverified ambiguous history rejection retains journal and returns durable reconciliation',
  );

  const deletionTombstoneError = new Error('deletion tombstone write failed');
  let ambiguousTombstoneHistory = [previousSameId, unrelatedSession];
  let ambiguousTombstones = [...existingDeletionTombstones];
  let tombstoneWriteCount = 0;
  let tombstoneFailureJournalClears = 0;
  const tombstoneFailureWithRollback = await deleteSessionTransaction(
    [previousSameId, unrelatedSession],
    existingDeletionTombstones,
    previousSameId.id,
    deletionTimestamp,
    {
      persistJournal: async () => undefined,
      clearJournal: async () => { tombstoneFailureJournalClears += 1; },
      persistSessions: async sessions => { ambiguousTombstoneHistory = sessions; },
      persistTombstones: async tombstones => {
        tombstoneWriteCount += 1;
        ambiguousTombstones = tombstones;
        if (tombstoneWriteCount === 1) throw deletionTombstoneError;
      },
      readSessions: async () => ({ status: 'valid', value: ambiguousTombstoneHistory }),
      readTombstones: async () => ambiguousTombstones,
      commit: () => { throw new Error('unreachable commit'); },
    },
  );
  assert(
      tombstoneFailureWithRollback.status === 'failed' &&
      tombstoneFailureWithRollback.error === deletionTombstoneError &&
      tombstoneFailureWithRollback.rollback === 'complete' &&
      tombstoneWriteCount === 2 && tombstoneFailureJournalClears === 1 &&
      ambiguousTombstoneHistory.length === 2 &&
      JSON.stringify(ambiguousTombstones) === JSON.stringify(existingDeletionTombstones),
    'tombstone applied-then-rejected restores and verifies tombstones plus history before clearing evidence',
  );

  let noopDependencyCalls = 0;
  const duplicateDeletionNoop = await deleteSessionTransaction(
    [unrelatedSession],
    existingDeletionTombstones,
    'missing-session',
    deletionTimestamp,
    {
      persistJournal: async () => { noopDependencyCalls += 1; },
      clearJournal: async () => { noopDependencyCalls += 1; },
      persistSessions: async () => { noopDependencyCalls += 1; },
      persistTombstones: async () => { noopDependencyCalls += 1; },
      readSessions: async () => { noopDependencyCalls += 1; return { status: 'valid', value: [] }; },
      readTombstones: async () => { noopDependencyCalls += 1; return []; },
      commit: () => { noopDependencyCalls += 1; },
    },
  );
  assert(
    duplicateDeletionNoop.status === 'noop' && noopDependencyCalls === 0,
    'duplicate or already absent deletion is a side-effect-free no-op',
  );

  const recoveryJournal = {
    version: 1 as const,
    sessionId: previousSameId.id,
    deletedAt: deletionTimestamp,
    originalIndex: 0,
    session: previousSameId,
    previousTombstone: existingDeletionTombstones[1],
  };
  assert(
    !decodeSessionDeletionJournal({ ...recoveryJournal, deletedAt: -1 }).ok &&
      !decodeSessionDeletionJournal({ ...recoveryJournal, deletedAt: 1.5 }).ok &&
      !decodeSessionDeletionJournal({
        ...recoveryJournal,
        previousTombstone: { id: recoveryJournal.sessionId, deletedAt: -1 },
      }).ok &&
      !decodeSessionDeletionJournal({ ...recoveryJournal, sessionId: 'mismatched-id' }).ok,
    'journal validation requires nonnegative integer timestamps and exact snapshot IDs',
  );

  async function runRecoveryFixture(options: {
    journalRead?: SessionDeletionJournalRead;
    historyStatus: 'absent' | 'valid' | 'invalid' | 'unreadable' | 'locked';
    sessions: WorkoutSession[];
    tombstones: Tombstone[];
    clearFails?: boolean;
  }) {
    let historyStatus = options.historyStatus;
    let storedSessions = [...options.sessions];
    let storedTombstones = [...options.tombstones];
    const events: string[] = [];
    let clearCount = 0;
    const result = await recoverSessionDeletionWithDependencies({
      readJournal: async () => options.journalRead ?? {
        status: 'valid',
        sourceFormat: 'encrypted',
        value: recoveryJournal,
      },
      readSessions: async () => {
        events.push('read-history');
        return { status: historyStatus, value: storedSessions };
      },
      readTombstones: async () => {
        events.push('read-tombstones');
        return storedTombstones;
      },
      persistSessions: async sessions => {
        events.push('write-history');
        storedSessions = sessions;
        historyStatus = 'valid';
      },
      persistTombstones: async tombstones => {
        events.push('write-tombstones');
        storedTombstones = tombstones;
      },
      clearJournal: async () => {
        events.push('clear');
        clearCount += 1;
        if (options.clearFails) throw new Error('journal clear failed');
      },
    });
    return { result, events, clearCount, storedSessions, storedTombstones };
  }

  const crashAfterJournal = await runRecoveryFixture({
    historyStatus: 'valid',
    sessions: [previousSameId, unrelatedSession],
    tombstones: existingDeletionTombstones,
  });
  assert(
    crashAfterJournal.result.status === 'rolled_back' &&
      crashAfterJournal.events.indexOf('write-tombstones') < crashAfterJournal.events.indexOf('write-history') &&
      crashAfterJournal.events.at(-1) === 'clear',
    'crash after journal restores tombstones before history and clears only after verification',
  );

  const crashAfterHistory = await runRecoveryFixture({
    historyStatus: 'valid',
    sessions: [unrelatedSession],
    tombstones: existingDeletionTombstones,
  });
  assert(
    crashAfterHistory.result.status === 'rolled_back' &&
      crashAfterHistory.storedSessions[0].id === previousSameId.id,
    'crash after history restores the journal session at its original index',
  );

  const committedTombstones = [
    existingDeletionTombstones[0],
    { id: previousSameId.id, deletedAt: deletionTimestamp },
  ];
  const crashAfterTombstone = await runRecoveryFixture({
    historyStatus: 'valid',
    sessions: [unrelatedSession],
    tombstones: committedTombstones,
  });
  assert(
    crashAfterTombstone.result.status === 'committed' &&
      crashAfterTombstone.events.join(',') === 'read-history,read-tombstones,clear',
    'only valid absent-session history plus the exact tombstone proves a committed deletion',
  );

  const absentHistoryWithTombstone = await runRecoveryFixture({
    historyStatus: 'absent',
    sessions: [],
    tombstones: committedTombstones,
  });
  assert(
    absentHistoryWithTombstone.result.status === 'rolled_back' &&
      absentHistoryWithTombstone.storedSessions.some(session => session.id === previousSameId.id),
    'an absent history key is restored and never treated as deletion completion proof',
  );

  for (const historyStatus of ['invalid', 'unreadable', 'locked'] as const) {
    const unavailableHistory = await runRecoveryFixture({
      historyStatus,
      sessions: [],
      tombstones: committedTombstones,
    });
    assert(
      unavailableHistory.result.status === 'unavailable' &&
        !unavailableHistory.events.includes('write-history') &&
        unavailableHistory.clearCount === 0,
      `${historyStatus} history retains journal without recovery writes`,
    );
  }

  for (const journalRead of [
    { status: 'invalid', sourceFormat: 'encrypted', value: null },
    { status: 'locked', sourceFormat: 'none', value: null },
    { status: 'valid', sourceFormat: 'legacy_plaintext', value: recoveryJournal },
  ] as SessionDeletionJournalRead[]) {
    const unavailableJournal = await runRecoveryFixture({
      journalRead,
      historyStatus: 'valid',
      sessions: [previousSameId],
      tombstones: existingDeletionTombstones,
    });
    assert(
      unavailableJournal.result.status === 'unavailable' && unavailableJournal.events.length === 0,
      'corrupt, locked, and plaintext journals block without touching history or tombstones',
    );
  }

  const committedClearFailure = await runRecoveryFixture({
    historyStatus: 'valid',
    sessions: [unrelatedSession],
    tombstones: committedTombstones,
    clearFails: true,
  });
  assert(
    committedClearFailure.result.status === 'unavailable' && committedClearFailure.clearCount === 1,
    'journal clear failure retains recovery evidence and blocks sync despite committed data',
  );

  const gateRunner = createTombstoneTransactionRunner();
  let gateRecoveryAttempt = 0;
  let gateDirtyCount = 0;
  let gatedOperationCount = 0;
  const gateDependencies = {
    recover: async () => {
      gateRecoveryAttempt += 1;
      return gateRecoveryAttempt === 1
        ? { status: 'unavailable' as const, historyStatus: 'locked' as const, error: new Error('locked') }
        : { status: 'none' as const };
    },
    markDirty: async () => { gateDirtyCount += 1; },
    runExclusive: gateRunner,
  };
  const blockedGateError = await captureRejection(async () => {
    await runSessionDeletionSyncGate(async () => { gatedOperationCount += 1; }, gateDependencies);
  });
  await runSessionDeletionSyncGate(async () => { gatedOperationCount += 1; }, gateDependencies);
  assert(
    blockedGateError instanceof SessionDeletionRecoveryBlockedError &&
      gateDirtyCount === 1 && gatedOperationCount === 1 && gateRecoveryAttempt === 2,
    'root sync gate blocks and marks dirty, then retries recovery and allows the next operation',
  );

  const concurrencyRunner = createTombstoneTransactionRunner();
  const concurrencyEvents: string[] = [];
  let releaseFirstTransaction: (() => void) | undefined;
  const firstTransactionGate = new Promise<void>(resolve => { releaseFirstTransaction = resolve; });
  const firstTombstoneTransaction = concurrencyRunner(async () => {
    concurrencyEvents.push('first-read');
    await firstTransactionGate;
    concurrencyEvents.push('first-write');
  });
  const secondTombstoneTransaction = concurrencyRunner(async () => {
    concurrencyEvents.push('second-read');
    concurrencyEvents.push('second-write');
  });
  await Promise.resolve();
  assert(concurrencyEvents.join(',') === 'first-read', 'shared tombstone queue holds the entire first transaction');
  releaseFirstTransaction?.();
  await Promise.all([firstTombstoneTransaction, secondTombstoneTransaction]);
  assert(
    concurrencyEvents.join(',') === 'first-read,first-write,second-read,second-write',
    'template/session tombstone transactions cannot interleave read-modify-write scopes',
  );

  let journalSerialized = '';
  let journalWritten = '';
  await saveStructuredStorageValue(recoveryJournal, {
    encrypt: serialized => {
      journalSerialized = serialized;
      return 'encrypted-journal';
    },
    write: encrypted => { journalWritten = encrypted; },
  });
  assert(
    journalSerialized.includes(recoveryJournal.sessionId) && journalWritten === 'encrypted-journal',
    'journal persistence encrypts the snapshot before its storage write',
  );

  const backupPayload = buildVaultBackupState({
    exportedAt: '2026-01-01T00:00:00.000Z',
    logs: [],
    settings: {} as never,
    sessions: [previousSameId],
    templates: [],
    customExercises: [],
    exerciseDefaults: {},
    tombstones: existingDeletionTombstones,
  });
  const serializedBackupPayload = JSON.stringify(backupPayload);
  assert(
    !serializedBackupPayload.includes(SESSION_DELETION_JOURNAL_STORAGE_KEY) &&
      !serializedBackupPayload.includes('sessionDeletionJournal') &&
      serializedBackupPayload.includes('workout_sessions'),
    'encrypted deletion journal key and contents are excluded from backup payloads',
  );

  const orderedQueue = new SerializedAsyncQueue();
  const activeWriteEvents: string[] = [];
  let persistedActiveValue: string | null = 'previous';
  let releaseDelayedAutosave: (() => void) | undefined;
  const delayedAutosaveGate = new Promise<void>(resolve => {
    releaseDelayedAutosave = resolve;
  });
  const delayedAutosave = orderedQueue.enqueue(async () => {
    activeWriteEvents.push('autosave-start');
    await delayedAutosaveGate;
    persistedActiveValue = 'draft';
    activeWriteEvents.push('autosave-end');
  });
  const queuedStrictClear = orderedQueue.enqueue(async () => {
    activeWriteEvents.push('strict-clear');
    persistedActiveValue = null;
  });
  await Promise.resolve();
  assert(
    activeWriteEvents.join(',') === 'autosave-start' && persistedActiveValue === 'previous',
    'strict clear waits behind an earlier delayed autosave',
  );
  releaseDelayedAutosave?.();
  await Promise.all([delayedAutosave, queuedStrictClear]);
  assert(
    activeWriteEvents.join(',') === 'autosave-start,autosave-end,strict-clear' &&
      persistedActiveValue === null,
    'late autosave resolves before strict clear and final active cache remains null',
  );

  const nonPoisoningQueue = new SerializedAsyncQueue();
  const queuedAutosaveError = new Error('queued autosave failed');
  const rejectedAutosave = nonPoisoningQueue.enqueue<void>(
    () => Promise.reject(queuedAutosaveError),
  );
  let clearAfterRejectedAutosave = 0;
  const clearFollowingRejectedAutosave = nonPoisoningQueue.enqueue(async () => {
    clearAfterRejectedAutosave += 1;
  });
  const observedQueuedAutosaveError = await captureRejection(async () => {
    await rejectedAutosave;
  });
  await clearFollowingRejectedAutosave;
  assert(
    observedQueuedAutosaveError === queuedAutosaveError && clearAfterRejectedAutosave === 1,
    'rejected autosave reaches its caller without poisoning the following strict clear',
  );

  let autosavesEnqueuedWhileFinishing = 0;
  if (shouldEnqueueActiveSessionAutosave(false, true)) {
    autosavesEnqueuedWhileFinishing += 1;
  }
  assert(
    autosavesEnqueuedWhileFinishing === 0 &&
      shouldEnqueueActiveSessionAutosave(false, false) &&
      !shouldEnqueueActiveSessionAutosave(true, false),
    'autosave cannot enqueue while Finish is pending or after a session ended',
  );
}
