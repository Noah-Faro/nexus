import type { WorkoutSession } from './trainingTypes';

export interface FinishSessionTransactionDependencies {
  persistHistory: (sessions: readonly WorkoutSession[]) => Promise<void>;
  clearActiveCache: () => Promise<void>;
  commit: (sessions: WorkoutSession[]) => void;
}

/**
 * Durable history may temporarily lead the active-session cache when its clear fails.
 * No in-memory commit occurs until both writes succeed, and retry is safe by session ID.
 */
export async function finishSessionTransaction(
  currentSessions: readonly WorkoutSession[],
  completedSession: WorkoutSession,
  dependencies: FinishSessionTransactionDependencies,
): Promise<WorkoutSession[]> {
  const nextSessions = [
    completedSession,
    ...currentSessions.filter(session => session.id !== completedSession.id),
  ];
  await dependencies.persistHistory(nextSessions);
  await dependencies.clearActiveCache();
  dependencies.commit(nextSessions);
  return nextSessions;
}
