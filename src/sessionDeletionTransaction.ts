import type { WorkoutSession } from './trainingTypes';
import type { Tombstone } from './tombstones';

export const SESSION_DELETION_JOURNAL_VERSION = 1 as const;

export interface SessionDeletionJournal {
  version: typeof SESSION_DELETION_JOURNAL_VERSION;
  sessionId: string;
  deletedAt: number;
  originalIndex: number;
  session: WorkoutSession;
  previousTombstone: Tombstone | null;
}

export type SessionDeletionFailureStage = 'journal' | 'history' | 'tombstone';

export interface SessionHistoryRead {
  status: 'absent' | 'valid' | 'invalid' | 'unreadable' | 'locked';
  value: WorkoutSession[];
}

export type SessionDeletionTransactionResult =
  | { status: 'noop' }
  | {
      status: 'committed';
      nextSessions: WorkoutSession[];
      nextTombstones: Tombstone[];
      journalCleanupError?: unknown;
    }
  | {
      status: 'failed';
      stage: SessionDeletionFailureStage;
      error: unknown;
      rollback: 'not_needed' | 'complete' | 'incomplete';
      rollbackErrors: readonly unknown[];
      reconciledSessions?: WorkoutSession[];
      reconciledHistoryStatus?: SessionHistoryRead['status'];
      reconciliationError?: unknown;
      journalCleanupError?: unknown;
    };

export interface SessionDeletionTransactionDependencies {
  persistJournal: (journal: SessionDeletionJournal) => Promise<void>;
  clearJournal: () => Promise<void>;
  persistSessions: (sessions: WorkoutSession[]) => Promise<void>;
  persistTombstones: (tombstones: Tombstone[]) => Promise<void>;
  readSessions: () => Promise<SessionHistoryRead>;
  readTombstones: () => Promise<Tombstone[]>;
  commit: (sessions: WorkoutSession[]) => void;
}

export function buildSessionDeletion(
  sessions: readonly WorkoutSession[],
  tombstones: readonly Tombstone[],
  sessionId: string,
  deletedAt: number,
): { journal: SessionDeletionJournal; nextSessions: WorkoutSession[]; nextTombstones: Tombstone[] } | null {
  const originalIndex = sessions.findIndex(session => session.id === sessionId);
  if (originalIndex < 0) return null;

  const session = sessions[originalIndex];
  const previousTombstone = tombstones.find(tombstone => tombstone.id === sessionId) ?? null;
  const nextTombstone = { id: sessionId, deletedAt };

  return {
    journal: {
      version: SESSION_DELETION_JOURNAL_VERSION,
      sessionId,
      deletedAt,
      originalIndex,
      session,
      previousTombstone,
    },
    nextSessions: sessions.filter(candidate => candidate.id !== sessionId),
    nextTombstones: [
      ...tombstones.filter(tombstone => tombstone.id !== sessionId),
      nextTombstone,
    ],
  };
}

async function captureFailure(action: () => Promise<void>): Promise<unknown | undefined> {
  try {
    await action();
    return undefined;
  } catch (error) {
    return error;
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function readRollbackState(
  sessions: readonly WorkoutSession[],
  tombstones: readonly Tombstone[] | null,
  dependencies: SessionDeletionTransactionDependencies,
): Promise<{
  verified: boolean;
  sessionsRead?: SessionHistoryRead;
  error?: unknown;
}> {
  try {
    const [sessionsRead, tombstonesRead] = await Promise.all([
      dependencies.readSessions(),
      tombstones === null ? Promise.resolve(null) : dependencies.readTombstones(),
    ]);
    const historyVerified = sessionsRead.status === 'valid' && sameJson(sessionsRead.value, sessions);
    const tombstonesVerified = tombstonesRead === null || sameJson(tombstonesRead, tombstones);
    return { verified: historyVerified && tombstonesVerified, sessionsRead };
  } catch (error) {
    return { verified: false, error };
  }
}

export async function deleteSessionTransaction(
  sessions: readonly WorkoutSession[],
  tombstones: readonly Tombstone[],
  sessionId: string,
  deletedAt: number,
  dependencies: SessionDeletionTransactionDependencies,
): Promise<SessionDeletionTransactionResult> {
  const prepared = buildSessionDeletion(sessions, tombstones, sessionId, deletedAt);
  if (!prepared) return { status: 'noop' };

  try {
    await dependencies.persistJournal(prepared.journal);
  } catch (error) {
    return { status: 'failed', stage: 'journal', error, rollback: 'not_needed', rollbackErrors: [] };
  }

  try {
    await dependencies.persistSessions(prepared.nextSessions);
  } catch (error) {
    // A rejected native write is ambiguous: it may have applied before reporting
    // failure. Restore and then verify structured storage before clearing evidence.
    const restorationError = await captureFailure(
      () => dependencies.persistSessions([...sessions]),
    );
    const verification = await readRollbackState(sessions, null, dependencies);
    const rollbackErrors = [restorationError, verification.error]
      .filter((rollbackError): rollbackError is unknown => rollbackError !== undefined);
    if (verification.verified) {
      const journalCleanupError = await captureFailure(dependencies.clearJournal);
      if (!journalCleanupError) {
        return {
          status: 'failed',
          stage: 'history',
          error,
          rollback: 'complete',
          rollbackErrors,
        };
      }
      rollbackErrors.push(journalCleanupError);
    }
    return {
      status: 'failed',
      stage: 'history',
      error,
      rollback: 'incomplete',
      rollbackErrors,
      reconciledSessions: verification.sessionsRead?.status === 'valid'
        ? verification.sessionsRead.value
        : undefined,
      reconciledHistoryStatus: verification.sessionsRead?.status,
      reconciliationError: verification.error,
    };
  }

  try {
    await dependencies.persistTombstones(prepared.nextTombstones);
  } catch (error) {
    // Restore deletion intent before history so a failed transaction cannot be
    // interpreted as a remote deletion while rollback is in progress.
    const tombstoneRollbackError = await captureFailure(
      () => dependencies.persistTombstones([...tombstones]),
    );
    const historyRollbackError = await captureFailure(
      () => dependencies.persistSessions([...sessions]),
    );
    const verification = await readRollbackState(sessions, tombstones, dependencies);
    const rollbackErrors = [tombstoneRollbackError, historyRollbackError, verification.error]
      .filter((rollbackError): rollbackError is unknown => rollbackError !== undefined);

    if (verification.verified) {
      const journalCleanupError = await captureFailure(dependencies.clearJournal);
      if (!journalCleanupError) {
        return {
          status: 'failed',
          stage: 'tombstone',
          error,
          rollback: 'complete',
          rollbackErrors,
        };
      }
      rollbackErrors.push(journalCleanupError);
    }

    return {
      status: 'failed',
      stage: 'tombstone',
      error,
      rollback: 'incomplete',
      rollbackErrors,
      reconciledSessions: verification.sessionsRead?.status === 'valid'
        ? verification.sessionsRead.value
        : undefined,
      reconciledHistoryStatus: verification.sessionsRead?.status,
      reconciliationError: verification.error,
    };
  }

  dependencies.commit(prepared.nextSessions);
  const journalCleanupError = await captureFailure(dependencies.clearJournal);
  return {
    status: 'committed',
    nextSessions: prepared.nextSessions,
    nextTombstones: prepared.nextTombstones,
    journalCleanupError,
  };
}
