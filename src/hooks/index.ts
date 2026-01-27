/**
 * Hooks Utility Library
 *
 * Optional utilities for common workflow patterns.
 * Import only what you need:
 *
 * @example
 * ```ts
 * // Import specific utilities
 * import { createSheetsLogger } from '@joshualelon/clawdbot-skill-flow/hooks/google-sheets';
 * import { createDynamicButtons } from '@joshualelon/clawdbot-skill-flow/hooks/dynamic-buttons';
 *
 * // Or import from main hooks export
 * import { composeHooks, withRetry } from '@joshualelon/clawdbot-skill-flow/hooks';
 * ```
 */

// Re-export types
export type * from "./types.js";

// Re-export common utilities
export {
  composeHooks,
  withRetry,
  validateEmail,
  validateNumber,
  validatePhone,
  whenCondition,
  debounceHook,
  throttleHook,
} from "./common.js";

// Re-export Google Sheets utilities
export { createSheetsLogger, appendToSheet, querySheetHistory, createSpreadsheet } from "./google-sheets.js";

// Re-export dynamic buttons utilities
export { createDynamicButtons, getRecentAverage, generateButtonRange } from "./dynamic-buttons.js";

// Re-export scheduling utilities (Google Calendar)
export {
  createScheduler,
  scheduleNextSession,
  checkCalendarConflicts,
  findNextAvailableSlot,
} from "./scheduling.js";

// Re-export ClawdBot native cron scheduling
export {
  createClawdBotScheduler,
  scheduleOneTimeReminder,
  listCronJobs,
  removeCronJob,
} from "./clawdbot-scheduler.js";

// Re-export LLM adapter utilities
export { createLLMAdapter } from "./llm-adapter.js";
