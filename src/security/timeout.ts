/**
 * Timeout utilities for preventing hook functions from hanging indefinitely
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within the timeout,
 * it rejects with a TimeoutError.
 *
 * @param fn - The async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Optional custom timeout message
 * @returns Promise that resolves with the function result or rejects on timeout
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => fetchData(),
 *   5000,
 *   'Data fetch timed out after 5 seconds'
 * );
 * ```
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new TimeoutError(
              timeoutMessage || `Operation timed out after ${timeoutMs}ms`
            )
          ),
        timeoutMs
      )
    ),
  ]);
}
