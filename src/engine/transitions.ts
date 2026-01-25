/**
 * Flow step transition logic with validation and conditional branching
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type {
  FlowMetadata,
  FlowStep,
  FlowSession,
  TransitionResult,
  FlowHooks,
} from "../types.js";
import { normalizeButton, validateInput } from "../validation.js";
import { safeExecuteHook } from "./hooks-loader.js";

/**
 * Evaluate condition against session variables
 */
function evaluateCondition(
  condition: FlowStep["condition"],
  variables: Record<string, string | number>
): boolean {
  if (!condition) {
    return false;
  }

  const value = variables[condition.variable];

  if (value === undefined) {
    return false;
  }

  // Check equals
  if (condition.equals !== undefined) {
    return value === condition.equals;
  }

  // Check greater than
  if (condition.greaterThan !== undefined) {
    const numValue =
      typeof value === "number" ? value : Number(value);
    return !isNaN(numValue) && numValue > condition.greaterThan;
  }

  // Check less than
  if (condition.lessThan !== undefined) {
    const numValue =
      typeof value === "number" ? value : Number(value);
    return !isNaN(numValue) && numValue < condition.lessThan;
  }

  // Check contains (for strings)
  if (condition.contains !== undefined) {
    return String(value).includes(condition.contains);
  }

  return false;
}

/**
 * Find next step ID based on transition rules
 */
function findNextStep(
  step: FlowStep,
  value: string | number,
  variables: Record<string, string | number>
): string | undefined {
  // 1. Check button-specific next
  if (step.buttons && step.buttons.length > 0) {
    const buttons = step.buttons.map((btn, idx) =>
      normalizeButton(btn, idx)
    );
    const matchingButton = buttons.find((btn) => btn.value === value);
    if (matchingButton?.next) {
      return matchingButton.next;
    }
  }

  // 2. Check conditional branching
  if (step.condition && evaluateCondition(step.condition, variables)) {
    return step.condition.next;
  }

  // 3. Use default next
  return step.next;
}

/**
 * Execute step transition
 */
export async function executeTransition(
  api: ClawdbotPluginApi,
  flow: FlowMetadata,
  session: FlowSession,
  stepId: string,
  value: string | number,
  hooks?: FlowHooks | null
): Promise<TransitionResult> {
  // Find current step
  const step = flow.steps.find((s) => s.id === stepId);

  if (!step) {
    return {
      variables: session.variables,
      complete: false,
      error: `Step ${stepId} not found`,
    };
  }

  // Convert value to string for validation
  const valueStr = String(value);

  // Validate input if required
  if (step.validate) {
    const validation = validateInput(valueStr, step.validate);
    if (!validation.valid) {
      return {
        variables: session.variables,
        complete: false,
        error: validation.error,
        message: validation.error,
      };
    }
  }

  // Capture variable if specified
  const updatedVariables = { ...session.variables };
  if (step.capture) {
    // Convert to number if validation type is number
    const capturedValue =
      step.validate === "number" ? Number(value) : valueStr;
    updatedVariables[step.capture] = capturedValue;

    // Call onCapture hook
    if (hooks?.onCapture) {
      await safeExecuteHook(
        api,
        "onCapture",
        hooks.onCapture,
        step.capture,
        capturedValue,
        { ...session, variables: updatedVariables }
      );
    }
  }

  // Find next step
  const nextStepId = findNextStep(step, value, updatedVariables);

  // If no next step, flow is complete
  if (!nextStepId) {
    return {
      variables: updatedVariables,
      complete: true,
    };
  }

  // Verify next step exists
  const nextStep = flow.steps.find((s) => s.id === nextStepId);
  if (!nextStep) {
    return {
      variables: updatedVariables,
      complete: false,
      error: `Next step ${nextStepId} not found`,
    };
  }

  return {
    nextStepId,
    variables: updatedVariables,
    complete: false,
  };
}
