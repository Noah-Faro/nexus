import { SerializedAsyncQueue } from './serializedAsyncQueue';

export function createTombstoneTransactionRunner() {
  const queue = new SerializedAsyncQueue();
  return <T>(operation: () => T | Promise<T>): Promise<T> => queue.enqueue(operation);
}

const runSharedTombstoneTransaction = createTombstoneTransactionRunner();

/** Serializes complete tombstone read-modify-write transactions, not individual writes. */
export function runTombstoneTransaction<T>(operation: () => T | Promise<T>): Promise<T> {
  return runSharedTombstoneTransaction(operation);
}
