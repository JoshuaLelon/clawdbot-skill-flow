/**
 * In-memory session storage with automatic timeout cleanup
 */

import type { FlowSession } from "../types.js";

// Session timeout: 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Cleanup interval: 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// In-memory session store
const sessions = new Map<string, FlowSession>();

// Cleanup timer
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Generate session key
 */
export function getSessionKey(senderId: string, flowName: string): string {
  return `${senderId}-${flowName}`;
}

/**
 * Create a new session
 */
export function createSession(params: {
  flowName: string;
  currentStepId: string;
  senderId: string;
  channel: string;
}): FlowSession {
  const now = Date.now();
  const session: FlowSession = {
    ...params,
    variables: {},
    startedAt: now,
    lastActivityAt: now,
  };

  const key = getSessionKey(params.senderId, params.flowName);
  sessions.set(key, session);

  // Start cleanup timer if not already running
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);
  }

  return session;
}

/**
 * Get session by key (returns null if expired)
 */
export function getSession(key: string): FlowSession | null {
  const session = sessions.get(key);

  if (!session) {
    return null;
  }

  // Check if expired
  const now = Date.now();
  if (now - session.lastActivityAt > SESSION_TIMEOUT_MS) {
    sessions.delete(key);
    return null;
  }

  return session;
}

/**
 * Update session (merges partial updates)
 */
export function updateSession(
  key: string,
  patch: Partial<FlowSession>
): FlowSession | null {
  const session = getSession(key);

  if (!session) {
    return null;
  }

  const updated: FlowSession = {
    ...session,
    ...patch,
    lastActivityAt: Date.now(),
    // Merge variables instead of replacing
    variables: patch.variables
      ? { ...session.variables, ...patch.variables }
      : session.variables,
  };

  sessions.set(key, updated);
  return updated;
}

/**
 * Delete session
 */
export function deleteSession(key: string): void {
  sessions.delete(key);

  // Stop cleanup timer if no sessions remain
  if (sessions.size === 0 && cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Cleanup expired sessions
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActivityAt > SESSION_TIMEOUT_MS) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    sessions.delete(key);
  }

  // Stop timer if no sessions remain
  if (sessions.size === 0 && cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Get all active sessions (for debugging)
 * @public - For debugging and monitoring
 */
export function getAllSessions(): FlowSession[] {
  return Array.from(sessions.values());
}

/**
 * Clear all sessions (for testing)
 */
export function clearAllSessions(): void {
  sessions.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
