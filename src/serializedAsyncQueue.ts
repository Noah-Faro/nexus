export class SerializedAsyncQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export function shouldEnqueueActiveSessionAutosave(
  sessionEnded: boolean,
  isFinishing: boolean,
): boolean {
  return !sessionEnded && !isFinishing;
}
