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
  DeclarativeAction,
} from "../types.js";
import { renderStep } from "./renderer.js";
import { executeTransition } from "./transitions.js";
import { loadHooks, resolveFlowPath, safeExecuteHook, safeExecuteAction, validateFlowActions } from "./hooks-loader.js";
import * as pluginHooks from "../hooks/index.js";
import { loadActionRegistry, type ActionRegistry } from "./action-loader.js";
import { evaluateCondition } from "./condition-evaluator.js";
import { executeDeclarativeAction } from "./action-executor.js";
import { createInterpolationContext, interpolateConfig } from "./interpolation.js";

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
 * Supports both declarative actions (new) and hooks (legacy)
 */
async function executeStepActions(
  api: ClawdbotPluginApi,
  step: FlowStep,
  session: FlowSession,
  flow: FlowMetadata,
  hooks: LoadedHooks | null,
  actionRegistry: ActionRegistry | null
): Promise<{ step: FlowStep; session: FlowSession }> {
  if (!step.actions) {
    return { step, session };
  }

  let modifiedStep = step;
  let modifiedSession = { ...session };

  // Check if actions are declarative (new) or legacy hooks
  const firstAction =
    step.actions.fetch && Object.values(step.actions.fetch)[0] ||
    step.actions.beforeRender?.[0];

  const isDeclarative = firstAction && "type" in firstAction;

  if (isDeclarative && actionRegistry) {
    // NEW: Declarative action system
    const context = createInterpolationContext(modifiedSession, flow.env || {});

    // 1. Execute fetch actions
    if (step.actions.fetch) {
      for (const [varName, action] of Object.entries(step.actions.fetch)) {
        const declarativeAction = action as DeclarativeAction;

        // Evaluate condition
        if (declarativeAction.if && !evaluateCondition(declarativeAction.if, modifiedSession)) {
          api.logger.debug(`Skipping fetch action ${declarativeAction.type} - condition not met`);
          continue;
        }

        // Interpolate config
        const config = interpolateConfig(declarativeAction.config, context);

        try {
          // Execute action
          const result = await executeDeclarativeAction(
            declarativeAction.type,
            config,
            { session: modifiedSession, api, step: modifiedStep },
            actionRegistry
          );

          // Inject result into session
          if (result && typeof result === "object" && varName in result) {
            const value = (result as Record<string, unknown>)[varName];
            if (typeof value === "string" || typeof value === "number") {
              modifiedSession = {
                ...modifiedSession,
                variables: {
                  ...modifiedSession.variables,
                  [varName]: value,
                },
              };
              // Update context for next actions
              context.variables = modifiedSession.variables;
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          api.logger.error(`Fetch action ${declarativeAction.type} failed: ${errorMsg}`);
          // Continue with other actions
        }
      }
    }

    // 2. Execute beforeRender actions
    if (step.actions.beforeRender) {
      for (const action of step.actions.beforeRender) {
        const declarativeAction = action as DeclarativeAction;

        // Evaluate condition
        if (declarativeAction.if && !evaluateCondition(declarativeAction.if, modifiedSession)) {
          api.logger.debug(`Skipping beforeRender action ${declarativeAction.type} - condition not met`);
          continue;
        }

        // Interpolate config
        const config = interpolateConfig(declarativeAction.config, context);

        try {
          // Execute action
          const result = await executeDeclarativeAction(
            declarativeAction.type,
            config,
            { session: modifiedSession, api, step: modifiedStep },
            actionRegistry
          );

          if (result && typeof result === "object") {
            modifiedStep = result as FlowStep;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          api.logger.error(`BeforeRender action ${declarativeAction.type} failed: ${errorMsg}`);
          // Continue with other actions
        }
      }
    }
  } else if (hooks) {
    // LEGACY: Hook-based action system
    const enhancedApi: EnhancedPluginApi = {
      ...api,
      hooks: pluginHooks,
    };

    // 1. Execute fetch actions - inject variables into session
    if (step.actions.fetch) {
      for (const [varName, action] of Object.entries(step.actions.fetch)) {
        // Check if it's a legacy action (has "action" field instead of "type")
        if (!("action" in action)) continue;

        const legacyAction = action as unknown as ConditionalAction;
        // Check if action should execute
        const { execute, actionName} = shouldExecuteAction(legacyAction, modifiedSession);

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
            enhancedApi
          );
          if (result && typeof result === "object") {
            if (varName in result) {
              const value = result[varName];
              if (typeof value === "string" || typeof value === "number") {
                modifiedSession = {
                  ...modifiedSession,
                  variables: {
                    ...modifiedSession.variables,
                    [varName]: value,
                  },
                };
              }
            }
          }
        }
      }
    }

    // 2. Execute beforeRender actions - modify step
    if (step.actions.beforeRender) {
      for (const action of step.actions.beforeRender) {
        // Check if it's a legacy action (has "action" field instead of "type")
        if (!("action" in action)) continue;

        const legacyAction = action as unknown as ConditionalAction;
        const { execute, actionName } = shouldExecuteAction(legacyAction, modifiedSession);

        if (!execute) {
          api.logger.debug(
            `Skipping beforeRender action "${actionName}" - condition not met`
          );
          continue;
        }

        const beforeRenderFn = hooks.actions[actionName] as BeforeRenderAction | undefined;
        if (beforeRenderFn) {
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
            enhancedApi
          );
          if (result) {
            modifiedStep = result as FlowStep;
          }
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

  // Load action registry for declarative actions
  let actionRegistry: ActionRegistry | null = null;
  if (flow.actions?.imports || !flow.hooks) {
    try {
      actionRegistry = await loadActionRegistry(flow.actions?.imports);
      api.logger.debug(`Loaded action registry with ${actionRegistry.list().length} actions`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      api.logger.error(`Failed to load action registry: ${errorMsg}`);
    }
  }

  // Load hooks if configured (legacy support)
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
  const actionResult = await executeStepActions(api, firstStep, session, flow, hooks, actionRegistry);
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
  // Load action registry for declarative actions
  let actionRegistry: ActionRegistry | null = null;
  if (flow.actions?.imports || !flow.hooks) {
    try {
      actionRegistry = await loadActionRegistry(flow.actions?.imports);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      api.logger.error(`Failed to load action registry: ${errorMsg}`);
    }
  }

  // Load hooks if configured (legacy support)
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
    hooks,
    actionRegistry
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
  const actionResult = await executeStepActions(api, nextStep, updatedSession, flow, hooks, actionRegistry);
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
