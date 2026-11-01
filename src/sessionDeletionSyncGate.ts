import type { SessionDeletionRecoveryResult } from './sessionDeletionRecovery';

export class SessionDeletionRecoveryBlockedError extends Error {
  readonly recovery: Extract<SessionDeletionRecoveryResult, { status: 'unavailable' }>;

  constructor(recovery: Extract<SessionDeletionRecoveryResult, { status: 'unavailable' }>) {
    super('Resolve the interrupted workout deletion before backup or cloud sync.');
    this.name = 'SessionDeletionRecoveryBlockedError';
    this.recovery = recovery;
  }
}

export interface SessionDeletionSyncGateDependencies {
  recover: () => Promise<SessionDeletionRecoveryResult>;
  markDirty: () => Promise<void>;
  runExclusive: <T>(operation: () => Promise<T>) => Promise<T>;
}

export async function runSessionDeletionSyncGate<T>(
  operation: () => Promise<T>,
  dependencies: SessionDeletionSyncGateDependencies,
): Promise<T> {
  return dependencies.runExclusive(async () => {
    const recovery = await dependencies.recover();
    if (recovery.status === 'unavailable') {
      await dependencies.markDirty();
      throw new SessionDeletionRecoveryBlockedError(recovery);
    }
    return operation();
  });
}
