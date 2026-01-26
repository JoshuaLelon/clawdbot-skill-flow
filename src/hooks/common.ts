/**
 * Common utilities for hooks library
 */

import type { FlowHooks, FlowSession } from "../types.js";
import type { HookFunction, ConditionFunction, RetryOptions } from "./types.js";

/**
 * Compose multiple hooks of the same type into a single hook.
 * Hooks are executed in sequence. If any hook throws, execution stops.
 *
 * @example
 * ```ts
 * const combined = composeHooks(
 *   createSheetsLogger({ ... }),
 *   async (variable, value, session) => {
 *     await sendSlackNotification(session);
 *   }
 * );
 * ```
 */
export function composeHooks<T extends keyof FlowHooks>(
  ...hooks: Array<HookFunction<T>>
): HookFunction<T> {
  return (async (...args: unknown[]) => {
    let result: unknown;
    for (const hook of hooks) {
      // @ts-expect-error - complex typing, but runtime is safe
      result = await hook(...args);
    }
    return result;
  }) as HookFunction<T>;
}

/**
 * Retry a function with exponential backoff.
 * Useful for network requests or external API calls.
 *
 * @param fn - Function to retry
 * @param options - Retry configuration
 * @param options.maxAttempts - Maximum number of attempts (default: 3)
 * @param options.delayMs - Initial delay in milliseconds (default: 1000)
 * @param options.backoff - Use exponential backoff (default: true)
 * @param options.maxDelayMs - Maximum delay cap (default: 30000 = 30 seconds)
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, delayMs: 1000, backoff: true }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoff = true,
    maxDelayMs = 30000,
  } = options;

  let lastError: Error | unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        break;
      }

      // Calculate delay with optional exponential backoff and max cap
      const exponentialDelay = delayMs * Math.pow(2, attempt - 1);
      const delay = backoff
        ? Math.min(exponentialDelay, maxDelayMs)
        : delayMs;
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Validate email address format
 * Uses simple regex - not perfect but catches most invalid formats
 */
export function validateEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validate number with optional min/max bounds
 */
export function validateNumber(
  value: unknown,
  min?: number,
  max?: number
): boolean {
  // Reject empty strings, null, undefined
  if (value === "" || value === null || value === undefined) {
    return false;
  }

  const num = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(num)) {
    return false;
  }

  if (min !== undefined && num < min) {
    return false;
  }

  if (max !== undefined && num > max) {
    return false;
  }

  return true;
}

/**
 * Validate phone number format (basic validation)
 * Accepts various formats: +1234567890, (123) 456-7890, 123-456-7890
 */
export function validatePhone(value: string): boolean {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  // Check if we have 10-15 digits (covers most international formats)
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Conditional hook execution - only run hook if condition is met
 *
 * @example
 * ```ts
 * const logOnComplete = whenCondition(
 *   (session) => session.variables.score > 100,
 *   createSheetsLogger({ ... })
 * );
 * ```
 */
export function whenCondition<T extends keyof FlowHooks>(
  condition: ConditionFunction,
  hook: HookFunction<T>
): HookFunction<T> {
  return (async (...args: unknown[]) => {
    // Session is typically the last argument for most hooks
    const session = args[args.length - 1] as FlowSession;

    const shouldRun = await condition(session);
    if (shouldRun) {
      // @ts-expect-error - complex typing, but runtime is safe
      return await hook(...args);
    }
  }) as HookFunction<T>;
}

/**
 * Create a debounced version of a hook (useful for rate limiting)
 * Ensures hook is only called once within a time window
 */
export function debounceHook<T extends keyof FlowHooks>(
  hook: HookFunction<T>,
  delayMs: number
): HookFunction<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingArgs: unknown[] | null = null;

  return (async (...args: unknown[]) => {
    pendingArgs = args;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        if (pendingArgs) {
          // @ts-expect-error - complex typing, but runtime is safe
          const result = await hook(...pendingArgs);

          // Clear references to allow garbage collection
          pendingArgs = null;
          timeoutId = null;

          resolve(result);
        }
      }, delayMs);
    });
  }) as HookFunction<T>;
}

/**
 * Create a throttled version of a hook (ensures minimum time between calls)
 */
export function throttleHook<T extends keyof FlowHooks>(
  hook: HookFunction<T>,
  intervalMs: number
): HookFunction<T> {
  let lastCallTime = 0;

  return (async (...args: unknown[]) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= intervalMs) {
      lastCallTime = now;
      // @ts-expect-error - complex typing, but runtime is safe
      return await hook(...args);
    }
  }) as HookFunction<T>;
}
