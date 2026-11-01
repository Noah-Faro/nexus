export interface StagedMergeReplayDependencies<T> {
  parse: (serialized: string) => T;
  writeSteps: (value: T) => readonly (() => Promise<void>)[];
  removeStaging: () => Promise<void>;
}

/**
 * Replays staged writes in order and removes staging only after every write succeeds.
 * Parse, write, and removal failures intentionally reject unchanged.
 */
export async function replayStagedMerge<T>(
  serialized: string | null,
  dependencies: StagedMergeReplayDependencies<T>,
): Promise<boolean> {
  if (serialized === null) return false;
  const value = dependencies.parse(serialized);
  for (const write of dependencies.writeSteps(value)) {
    await write();
  }
  await dependencies.removeStaging();
  return true;
}
