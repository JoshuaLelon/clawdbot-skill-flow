/**
 * Core type definitions for skill-flow plugin
 */

export type ValidationType = "number" | "email" | "phone";

export interface Button {
  text: string;
  value: string | number;
  next?: string;
}

export interface ConditionalAction {
  action: string; // Action function name
  if?: string; // Optional: Variable name to check (truthy = execute). Omit for always execute.
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
  actions?: {
    fetch?: Record<string, ConditionalAction>;
    beforeRender?: ConditionalAction[];
    afterCapture?: ConditionalAction[];
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
  env?: Record<string, string>; // Environment variable mapping: { sessionVar: "ENV_VAR_NAME" }
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
 * Enhanced API with plugin utilities injected
 */
export type EnhancedPluginApi = import("clawdbot/plugin-sdk").ClawdbotPluginApi & {
  hooks: typeof import("./hooks/index.js");
};

/**
 * Action function signatures for step-level hooks
 * All actions receive an optional api parameter for accessing plugin utilities
 */
export type FetchAction = (
  session: FlowSession,
  api?: EnhancedPluginApi
) => Promise<Record<string, unknown>>;

export type BeforeRenderAction = (
  step: FlowStep,
  session: FlowSession,
  api?: EnhancedPluginApi
) => FlowStep | Promise<FlowStep>;

export type AfterCaptureAction = (
  variable: string,
  value: string | number,
  session: FlowSession,
  api?: EnhancedPluginApi
) => void | Promise<void>;

/**
 * Global lifecycle hooks for flow-level events.
 * Step-level actions should be exported as named exports from hooks file.
 */
export interface FlowHooks {
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

  /**
   * @deprecated Use step-level actions instead.
   * Called before rendering a step. Return modified step (e.g., dynamic buttons).
   */
  onStepRender?: (
    step: FlowStep,
    session: FlowSession
  ) => FlowStep | Promise<FlowStep>;

  /**
   * @deprecated Use step-level actions instead.
   * Called after a variable is captured. Use for external logging.
   */
  onCapture?: (
    variable: string,
    value: string | number,
    session: FlowSession
  ) => void | Promise<void>;
}

/**
 * Loaded hooks structure with lifecycle hooks and step-level actions
 */
export interface LoadedHooks {
  lifecycle: FlowHooks;
  actions: Record<string, Function>;
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
