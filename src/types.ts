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
  buttons?: Array<{
    text: string;
    callback_data: string;
  }[]>;
}
