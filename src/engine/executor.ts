/**
 * Main flow execution orchestrator
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type {
  FlowMetadata,
  FlowSession,
  FlowStep,
  ReplyPayload,
  LoadedHooks,
  ConditionalAction,
  FetchAction,
  BeforeRenderAction,
  EnhancedPluginApi,
} from "../types.js";
import { renderStep } from "./renderer.js";
import { executeTransition } from "./transitions.js";
import { loadHooks, resolveFlowPath, safeExecuteHook, safeExecuteAction, validateFlowActions } from "./hooks-loader.js";
import * as pluginHooks from "../hooks/index.js";

/**
 * Determine if an action should execute based on conditional logic
 */
export function shouldExecuteAction(
  action: ConditionalAction,
  session: FlowSession
): { execute: boolean; actionName: string } {
  // Check if condition is specified
  if (action.if) {
    const conditionValue = session.variables[action.if];
    const execute = Boolean(conditionValue);
    return { execute, actionName: action.action };
  }

  // No condition, always execute
  return { execute: true, actionName: action.action };
}

/**
 * Execute step-level actions (fetch, beforeRender)
 */
async function executeStepActions(
  api: ClawdbotPluginApi,
  step: FlowStep,
  session: FlowSession,
  hooks: LoadedHooks | null
): Promise<{ step: FlowStep; session: FlowSession }> {
  if (!hooks || !step.actions) {
    return { step, session };
  }

  // Create enhanced API with plugin utilities
  const enhancedApi: EnhancedPluginApi = {
    ...api,
    hooks: pluginHooks,
  };

  let modifiedStep = step;
  let modifiedSession = { ...session };

  // 1. Execute fetch actions - inject variables into session
  if (step.actions.fetch) {
    for (const [varName, action] of Object.entries(step.actions.fetch)) {
      // Check if action should execute
      const { execute, actionName } = shouldExecuteAction(action, modifiedSession);

      if (!execute) {
        api.logger.debug(
          `Skipping fetch action "${actionName}" for variable "${varName}" - condition not met`
        );
        continue;
      }

      const fetchFn = hooks.actions[actionName] as FetchAction | undefined;
      if (fetchFn) {
        // Validate signature before calling
        if (fetchFn.length > 2) {
          api.logger.error(
            `Fetch action "${actionName}" has invalid signature. Expected 1-2 parameters (session, api?), got ${fetchFn.length}`
          );
          continue;
        }

        const result = await safeExecuteAction(
          api,
          actionName,
          fetchFn,
          modifiedSession,
          enhancedApi  // Pass enhanced API with hooks
        );
        if (result && typeof result === "object") {
          // Only inject the requested variable, not all keys
          if (varName in result) {
            const value = result[varName];
            // Validate that the value is a string or number
            if (typeof value === "string" || typeof value === "number") {
              modifiedSession = {
                ...modifiedSession,
                variables: {
                  ...modifiedSession.variables,
                  [varName]: value,
                },
              };
            } else {
              api.logger.warn(
                `Fetch action "${actionName}" returned invalid type for "${varName}". ` +
                `Expected string or number, got ${typeof value}`
              );
            }
          } else {
            // Warn if action didn't return the expected variable
            api.logger.warn(
              `Fetch action "${actionName}" did not return variable "${varName}". ` +
              `Returned keys: ${Object.keys(result).join(', ')}`
            );
          }
        }
      }
    }
  }

  // 2. Execute beforeRender actions - modify step
  if (step.actions.beforeRender) {
    for (const action of step.actions.beforeRender) {
      // Check if action should execute
      const { execute, actionName } = shouldExecuteAction(action, modifiedSession);

      if (!execute) {
        api.logger.debug(
          `Skipping beforeRender action "${actionName}" - condition not met`
        );
        continue;
      }

      const beforeRenderFn = hooks.actions[actionName] as BeforeRenderAction | undefined;
      if (beforeRenderFn) {
        // Validate signature before calling
        if (beforeRenderFn.length > 3) {
          api.logger.error(
            `BeforeRender action "${actionName}" has invalid signature. Expected 2-3 parameters (step, session, api?), got ${beforeRenderFn.length}`
          );
          continue;
        }

        const result = await safeExecuteAction(
          api,
          actionName,
          beforeRenderFn,
          modifiedStep,
          modifiedSession,
          enhancedApi  // Pass enhanced API with hooks
        );
        if (result) {
          modifiedStep = result as FlowStep;
        }
      }
    }
  }

  return { step: modifiedStep, session: modifiedSession };
}

/**
 * Start a flow from the beginning
 */
export async function startFlow(
  api: ClawdbotPluginApi,
  flow: FlowMetadata,
  session: FlowSession
): Promise<ReplyPayload> {
  let firstStep = flow.steps[0];

  if (!firstStep) {
    return {
      text: `Error: Flow "${flow.name}" has no steps`,
    };
  }

  // Load hooks if configured
  let hooks: LoadedHooks | null = null;
  if (flow.hooks) {
    const hooksPath = resolveFlowPath(api, flow.name, flow.hooks);
    hooks = await loadHooks(api, hooksPath);

    // Validate that all action references in the flow exist
    if (hooks) {
      validateFlowActions(flow, hooks, api);
    }
  }

  // Inject environment variables into session
  if (flow.env) {
    const resolvedEnv: Record<string, string | number> = {};

    for (const [varName, envKey] of Object.entries(flow.env)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        resolvedEnv[varName] = value;
      } else {
        api.logger.warn(
          `Flow "${flow.name}" requires environment variable "${envKey}" ` +
          `(for session variable "${varName}") but it is not set`
        );
      }
    }

    session = {
      ...session,
      variables: {
        ...session.variables,
        ...resolvedEnv,
      },
    };
  }

  // Execute step actions before rendering
  const actionResult = await executeStepActions(api, firstStep, session, hooks);
  firstStep = actionResult.step;
  session = actionResult.session;

  return renderStep(api, flow, firstStep, session, session.channel, hooks);
}

/**
 * Process a step transition and return next step or completion message
 */
export async function processStep(
  api: ClawdbotPluginApi,
  flow: FlowMetadata,
  session: FlowSession,
  stepId: string,
  value: string | number
): Promise<{
  reply: ReplyPayload;
  complete: boolean;
  updatedVariables: Record<string, string | number>;
}> {
  // Load hooks if configured
  let hooks: LoadedHooks | null = null;
  if (flow.hooks) {
    const hooksPath = resolveFlowPath(api, flow.name, flow.hooks);
    hooks = await loadHooks(api, hooksPath);

    // Validate that all action references in the flow exist
    if (hooks) {
      validateFlowActions(flow, hooks, api);
    }
  }

  const result = await executeTransition(
    api,
    flow,
    session,
    stepId,
    value,
    hooks
  );

  // Handle errors
  if (result.error) {
    return {
      reply: { text: result.message || result.error },
      complete: false,
      updatedVariables: result.variables,
    };
  }

  // Handle completion
  if (result.complete) {
    const updatedSession = { ...session, variables: result.variables };

    // Call onFlowComplete hook
    if (hooks?.lifecycle?.onFlowComplete) {
      await safeExecuteHook(api, "onFlowComplete", hooks.lifecycle.onFlowComplete, updatedSession);
    }

    const completionMessage = generateCompletionMessage(flow, result.variables);
    return {
      reply: { text: completionMessage },
      complete: true,
      updatedVariables: result.variables,
    };
  }

  // Render next step
  if (!result.nextStepId) {
    return {
      reply: { text: "Error: No next step found" },
      complete: false,
      updatedVariables: result.variables,
    };
  }

  let nextStep = flow.steps.find((s) => s.id === result.nextStepId);
  if (!nextStep) {
    return {
      reply: { text: `Error: Step ${result.nextStepId} not found` },
      complete: false,
      updatedVariables: result.variables,
    };
  }

  let updatedSession = { ...session, variables: result.variables };

  // Execute step actions before rendering
  const actionResult = await executeStepActions(api, nextStep, updatedSession, hooks);
  nextStep = actionResult.step;
  updatedSession = actionResult.session;

  const reply = await renderStep(
    api,
    flow,
    nextStep,
    updatedSession,
    session.channel,
    hooks
  );

  return {
    reply,
    complete: false,
    updatedVariables: updatedSession.variables,
  };
}

/**
 * Generate completion message
 */
function generateCompletionMessage(
  flow: FlowMetadata,
  variables: Record<string, string | number>
): string {
  let message = `✅ Flow "${flow.name}" completed!\n\n`;

  if (Object.keys(variables).length > 0) {
    message += "Summary:\n";
    for (const [key, value] of Object.entries(variables)) {
      message += `• ${key}: ${value}\n`;
    }
  }

  return message;
}
