import {
  type StorageDecoderResult,
  type StorageLoadStatus,
  type StorageSourceFormat,
} from './structuredStorage';
import { decodeWorkoutSessions } from './trainingDecoders';
import {
  SESSION_DELETION_JOURNAL_VERSION,
  type SessionDeletionJournal,
} from './sessionDeletionTransaction';
import type { Tombstone } from './tombstones';
import type { WorkoutSession } from './trainingTypes';

export interface SessionDeletionJournalIssue {
  code: 'invalid_journal';
  message: string;
}

function invalidJournal(message: string): StorageDecoderResult<SessionDeletionJournal | null, SessionDeletionJournalIssue> {
  return { ok: false, recoverableValue: null, issues: [{ code: 'invalid_journal', message }] };
}

export function decodeSessionDeletionJournal(
  value: unknown,
): StorageDecoderResult<SessionDeletionJournal | null, SessionDeletionJournalIssue> {
  if (value === null) return { ok: true, value: null, issues: [] };
  if (typeof value !== 'object' || value === null) return invalidJournal('Journal must be an object.');
  const candidate = value as Partial<SessionDeletionJournal>;
  if (
    candidate.version !== SESSION_DELETION_JOURNAL_VERSION ||
    typeof candidate.sessionId !== 'string' || !candidate.sessionId ||
    !Number.isInteger(candidate.deletedAt) || (candidate.deletedAt ?? -1) < 0 ||
    !Number.isInteger(candidate.originalIndex) || (candidate.originalIndex ?? -1) < 0
  ) return invalidJournal('Journal metadata is invalid.');

  const decodedSession = decodeWorkoutSessions([candidate.session]);
  if (!decodedSession.ok || decodedSession.value.length !== 1) {
    return invalidJournal('Journal session snapshot is invalid.');
  }
  const session = decodedSession.value[0];
  if (session.id !== candidate.sessionId) return invalidJournal('Journal session ID does not match its snapshot.');

  const previous = candidate.previousTombstone;
  if (
    previous !== null &&
    (typeof previous !== 'object' || previous === null || previous.id !== candidate.sessionId ||
      !Number.isInteger(previous.deletedAt) || previous.deletedAt < 0)
  ) return invalidJournal('Journal tombstone snapshot is invalid.');

  return {
    ok: true,
    value: {
      version: SESSION_DELETION_JOURNAL_VERSION,
      sessionId: candidate.sessionId,
      deletedAt: candidate.deletedAt as number,
      originalIndex: candidate.originalIndex as number,
      session,
      previousTombstone: previous ? { id: previous.id, deletedAt: previous.deletedAt } : null,
    },
    issues: [],
  };
}

export type SessionDeletionRecoveryResult =
  | { status: 'none' | 'committed' | 'rolled_back' }
  | { status: 'unavailable'; historyStatus: StorageLoadStatus; error: unknown };

export interface SessionDeletionJournalRead {
  status: StorageLoadStatus;
  sourceFormat: StorageSourceFormat;
  value: SessionDeletionJournal | null;
}

export interface SessionDeletionHistoryRead {
  status: StorageLoadStatus;
  value: WorkoutSession[];
}

export interface SessionDeletionRecoveryDependencies {
  readJournal: () => Promise<SessionDeletionJournalRead>;
  readSessions: () => Promise<SessionDeletionHistoryRead>;
  readTombstones: () => Promise<Tombstone[]>;
  persistSessions: (sessions: WorkoutSession[]) => Promise<void>;
  persistTombstones: (tombstones: Tombstone[]) => Promise<void>;
  clearJournal: () => Promise<void>;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function restorePreviousTombstone(tombstones: readonly Tombstone[], journal: SessionDeletionJournal): Tombstone[] {
  const restored = tombstones.filter(tombstone => tombstone.id !== journal.sessionId);
  if (journal.previousTombstone) restored.push(journal.previousTombstone);
  return restored;
}

function restoreSession(sessions: readonly WorkoutSession[], journal: SessionDeletionJournal): WorkoutSession[] {
  if (sessions.some(session => session.id === journal.sessionId)) return [...sessions];
  const restored = [...sessions];
  restored.splice(Math.min(journal.originalIndex, restored.length), 0, journal.session);
  return restored;
}

export async function recoverSessionDeletionWithDependencies(
  dependencies: SessionDeletionRecoveryDependencies,
): Promise<SessionDeletionRecoveryResult> {
  let journalRead: SessionDeletionJournalRead;
  try { journalRead = await dependencies.readJournal(); }
  catch (error) { return { status: 'unavailable', historyStatus: 'unreadable', error }; }

  if (journalRead.status !== 'valid' && journalRead.status !== 'absent') {
    return { status: 'unavailable', historyStatus: journalRead.status, error: new Error(`Deletion recovery journal is ${journalRead.status}.`) };
  }
  const journal = journalRead.value;
  if (!journal) return { status: 'none' };
  if (journalRead.sourceFormat !== 'encrypted') {
    return { status: 'unavailable', historyStatus: 'invalid', error: new Error('Deletion recovery journal is not encrypted.') };
  }

  let sessionsRead: SessionDeletionHistoryRead;
  let tombstones: Tombstone[];
  try { [sessionsRead, tombstones] = await Promise.all([dependencies.readSessions(), dependencies.readTombstones()]); }
  catch (error) { return { status: 'unavailable', historyStatus: 'unreadable', error }; }

  const committed = sessionsRead.status === 'valid' &&
    !sessionsRead.value.some(session => session.id === journal.sessionId) &&
    tombstones.some(tombstone => tombstone.id === journal.sessionId && tombstone.deletedAt === journal.deletedAt);
  if (committed) {
    try { await dependencies.clearJournal(); return { status: 'committed' }; }
    catch (error) { return { status: 'unavailable', historyStatus: 'unreadable', error }; }
  }

  if (sessionsRead.status !== 'valid' && sessionsRead.status !== 'absent') {
    return { status: 'unavailable', historyStatus: sessionsRead.status, error: new Error(`Training history is ${sessionsRead.status} during deletion recovery.`) };
  }

  const restoredTombstones = restorePreviousTombstone(tombstones, journal);
  const restoredSessions = restoreSession(sessionsRead.value, journal);
  try {
    await dependencies.persistTombstones(restoredTombstones);
    await dependencies.persistSessions(restoredSessions);
  } catch (error) {
    return { status: 'unavailable', historyStatus: 'unreadable', error };
  }

  try {
    const [verifiedSessions, verifiedTombstones] = await Promise.all([dependencies.readSessions(), dependencies.readTombstones()]);
    if (
      verifiedSessions.status !== 'valid' ||
      !sameJson(verifiedSessions.value, restoredSessions) ||
      !sameJson(verifiedTombstones, restoredTombstones)
    ) {
      return {
        status: 'unavailable',
        historyStatus: verifiedSessions.status === 'valid' ? 'unreadable' : verifiedSessions.status,
        error: new Error('Deletion rollback could not be verified.'),
      };
    }
    await dependencies.clearJournal();
    return { status: 'rolled_back' };
  } catch (error) {
    return { status: 'unavailable', historyStatus: 'unreadable', error };
  }
}
