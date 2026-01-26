/**
 * Core type definitions for skill-flow plugin
 */

export type ValidationType = "number" | "email" | "phone";

export interface Button {
  text: string;
  value: string | number;
  next?: string;
}

export interface FlowStep {
  id: string;
  message: string;
  buttons?: Array<Button | string | number>;
  next?: string;
  capture?: string;
  validate?: ValidationType;
  condition?: {
    variable: string;
    equals?: string | number;
    greaterThan?: number;
    lessThan?: number;
    contains?: string;
    next: string;
  };
}

export interface FlowMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  steps: FlowStep[];
  triggers?: {
    manual?: boolean;
    cron?: string;
    event?: string;
  };
  hooks?: string; // Path to hooks file (relative to flow directory)
  storage?: {
    backend?: string; // Path to custom storage backend
    builtin?: boolean; // Also write to JSONL (default: true)
  };
  // Allow extra fields (e.g., job config)
  [key: string]: unknown;
}

export interface FlowSession {
  flowName: string;
  currentStepId: string;
  senderId: string;
  channel: string;
  variables: Record<string, string | number>;
  startedAt: number;
  lastActivityAt: number;
}

export interface TransitionResult {
  nextStepId?: string;
  variables: Record<string, string | number>;
  complete: boolean;
  error?: string;
  message?: string;
}

export interface ReplyPayload {
  text: string;
  channelData?: {
    telegram?: {
      buttons?: Array<Array<{ text: string; callback_data: string }>>;
    };
  };
}

/**
 * Hooks interface for customizing flow behavior at key points.
 * All hooks are optional and async-compatible.
 */
export interface FlowHooks {
  /**
   * Called before rendering a step. Return modified step (e.g., dynamic buttons).
   * @param step - The step about to be rendered
   * @param session - Current session state (variables, history)
   * @returns Modified step or original
   */
  onStepRender?: (
    step: FlowStep,
    session: FlowSession
  ) => FlowStep | Promise<FlowStep>;

  /**
   * Called after a variable is captured. Use for external logging.
   * @param variable - Variable name
   * @param value - Captured value
   * @param session - Current session state
   */
  onCapture?: (
    variable: string,
    value: string | number,
    session: FlowSession
  ) => void | Promise<void>;

  /**
   * Called when flow completes (reaches terminal step). Use for follow-up actions.
   * @param session - Final session state with all captured variables
   */
  onFlowComplete?: (session: FlowSession) => void | Promise<void>;

  /**
   * Called when flow is abandoned (timeout, user cancels).
   * @param session - Session state at time of abandonment
   * @param reason - "timeout" | "cancelled" | "error"
   */
  onFlowAbandoned?: (
    session: FlowSession,
    reason: "timeout" | "cancelled" | "error"
  ) => void | Promise<void>;
}

/**
 * Pluggable storage backend interface for custom persistence.
 */
export interface StorageBackend {
  /**
   * Save a completed session to storage.
   * @param session - The completed flow session
   */
  saveSession(session: FlowSession): Promise<void>;

  /**
   * Load historical sessions for a flow.
   * @param flowName - Name of the flow
   * @param options - Query options (limit, filter by sender)
   * @returns Array of historical sessions
   */
  loadHistory(
    flowName: string,
    options?: { limit?: number; senderId?: string }
  ): Promise<FlowSession[]>;
}
