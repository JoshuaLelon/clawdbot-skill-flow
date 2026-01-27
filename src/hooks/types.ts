/**
 * Type definitions for hooks utility library
 */

import type { FlowSession, FlowHooks } from "../types.js";

/**
 * Google Sheets configuration
 */
export interface SheetsConfig {
  spreadsheetId: string;
  worksheetName?: string;
  credentials?: GoogleServiceAccountCredentials;
}

export interface GoogleServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
}

export type HeaderMode = 'strict' | 'append' | 'overwrite';

export interface SheetsLogOptions {
  spreadsheetId: string;
  worksheetName?: string;
  columns?: string[]; // Variable names to log
  includeMetadata?: boolean; // Add timestamp, userId, flowName
  credentials?: GoogleServiceAccountCredentials;
  headerMode?: HeaderMode; // How to handle header mismatches (default: 'append')
}

/**
 * Dynamic buttons configuration
 */
export interface DynamicButtonsConfig {
  spreadsheetId?: string; // Source for history (Google Sheets)
  historyFile?: string; // Or use local .jsonl
  variable: string; // Which variable to generate buttons for
  strategy: "centered" | "progressive" | "range";
  buttonCount?: number; // How many buttons (default: 5)
  step?: number; // Increment between buttons
}

export type ButtonStrategy = "centered" | "progressive" | "range";

/**
 * Scheduling configuration
 */
export interface ScheduleConfig {
  days?: string[]; // ['mon', 'wed', 'fri']
  time?: string; // '08:00' (uses local server time)
  calendarId?: string; // Google Calendar ID (default: 'primary')
  credentials?: GoogleServiceAccountCredentials; // For calendar API access
  calendarCheck?: boolean; // Check for conflicts
  rescheduleOnConflict?: boolean;
}

/**
 * Hook composer type - accepts multiple hooks and merges them
 */
export type HookFunction<T extends keyof FlowHooks> = NonNullable<FlowHooks[T]>;

/**
 * Condition function for conditional hooks
 */
export type ConditionFunction = (session: FlowSession) => boolean | Promise<boolean>;

/**
 * Retry configuration
 */
export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: boolean; // Use exponential backoff
  maxDelayMs?: number; // Maximum delay cap (default: 30000ms)
}

/**
 * LLM Adapter configuration for adaptive step modification
 */
export interface LLMAdapterConfig {
  // When to adapt
  enabled?: boolean; // Default: true
  stepFilter?: (step: import("../types.js").FlowStep) => boolean;
  userFilter?: (session: FlowSession) => boolean;

  // What to adapt
  adaptMessage?: boolean; // Default: true
  adaptButtons?: boolean; // Default: true
  preserveButtonValues?: boolean; // Default: true (only adapt labels, not values)

  // LLM settings
  provider?: string; // Default: from plugin config
  model?: string; // Default: from plugin config
  temperature?: number; // Default: 0.7
  maxTokens?: number; // Default: 500

  // Context to include
  includeVariables?: boolean; // Default: true
  includeFlowMetadata?: boolean; // Default: false
  maxContextTokens?: number; // Default: 2000

  // Behavior
  fallbackToOriginal?: boolean; // Default: true (return original step on error)
}
