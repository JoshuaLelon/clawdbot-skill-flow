/**
 * Flow step transition logic with validation and conditional branching
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type {
  FlowMetadata,
  FlowStep,
  FlowSession,
  TransitionResult,
  DeclarativeAction,
} from "../types.js";
import { normalizeButton, validateInput } from "../validation.js";
import { sanitizeInput } from "../security/input-sanitization.js";
import { getPluginConfig } from "../config.js";
import type { ActionRegistry } from "./action-loader.js";
import { evaluateCondition as evaluateDeclarativeCondition } from "./condition-evaluator.js";
import { executeDeclarativeAction } from "./action-executor.js";
import { createInterpolationContext, interpolateConfig } from "./interpolation.js";

/**
 * Evaluate condition against session variables
 */
function evaluateCondition(
  condition: FlowStep["condition"],
  variables: Record<string, string | number | boolean>
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
  variables: Record<string, string | number | boolean>
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
  actionRegistry: ActionRegistry
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
    // Sanitize input before capturing
    let sanitizedValue: string | number;
    try {
      const config = getPluginConfig();
      sanitizedValue = sanitizeInput(value, config);
    } catch (error) {
      api.logger.warn(
        `Input sanitization failed for step "${stepId}": ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        error: "Invalid input",
        message:
          "Your input contains invalid characters or exceeds length limits.",
        variables: updatedVariables,
        complete: false,
      };
    }

    // Convert to number if validation type is number
    const capturedValue =
      step.validate === "number" ? Number(sanitizedValue) : String(sanitizedValue);
    updatedVariables[step.capture] = capturedValue;

    // Execute afterCapture actions
    if (step.actions?.afterCapture) {
      const updatedSession = { ...session, variables: updatedVariables };
      const context = createInterpolationContext(updatedSession, flow.env || {});

      for (const action of step.actions.afterCapture) {
        const declarativeAction = action as DeclarativeAction;

        // Evaluate condition
        if (declarativeAction.if && !evaluateDeclarativeCondition(declarativeAction.if, updatedSession)) {
          api.logger.debug(`Skipping afterCapture action ${declarativeAction.type} - condition not met`);
          continue;
        }

        // Interpolate config
        const config = interpolateConfig(declarativeAction.config, context);

        try {
          // Execute action
          await executeDeclarativeAction(
            declarativeAction.type,
            config,
            {
              session: updatedSession,
              api,
              step,
              capturedVariable: step.capture,
              capturedValue: capturedValue,
            },
            actionRegistry
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          api.logger.error(`AfterCapture action ${declarativeAction.type} failed: ${errorMsg}`);
          // Continue with other actions
        }
      }
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
