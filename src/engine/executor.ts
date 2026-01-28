/**
 * Main flow execution orchestrator
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type {
  FlowMetadata,
  FlowSession,
  FlowStep,
  ReplyPayload,
  DeclarativeAction,
} from "../types.js";
import { renderStep } from "./renderer.js";
import { executeTransition } from "./transitions.js";
import { loadActionRegistry, type ActionRegistry } from "./action-loader.js";
import { evaluateCondition } from "./condition-evaluator.js";
import { executeDeclarativeAction } from "./action-executor.js";
import { createInterpolationContext, interpolateConfig } from "./interpolation.js";

/**
 * Execute step-level actions (fetch, beforeRender)
 */
async function executeStepActions(
  api: ClawdbotPluginApi,
  step: FlowStep,
  session: FlowSession,
  flow: FlowMetadata,
  actionRegistry: ActionRegistry
): Promise<{ step: FlowStep; session: FlowSession }> {
  api.logger.info(`[ACTIONS] executeStepActions called for step: ${step.id}`);

  if (!step.actions) {
    api.logger.debug(`[ACTIONS] No actions defined for step ${step.id}`);
    return { step, session };
  }

  api.logger.info(`[ACTIONS] Step ${step.id} has actions. Fetch: ${step.actions.fetch ? Object.keys(step.actions.fetch).length : 0}, BeforeRender: ${step.actions.beforeRender?.length || 0}, AfterCapture: ${step.actions.afterCapture?.length || 0}`);

  let modifiedStep = step;
  let modifiedSession = { ...session };
  const context = createInterpolationContext(modifiedSession, flow.env || {});

  // 1. Execute fetch actions
  if (step.actions.fetch) {
    api.logger.info(`[FETCH] Executing ${Object.keys(step.actions.fetch).length} fetch action(s) for step ${step.id}`);

    for (const [varName, action] of Object.entries(step.actions.fetch)) {
      const declarativeAction = action as DeclarativeAction;
      api.logger.info(`[FETCH] Starting fetch action: ${declarativeAction.type} -> ${varName}`);

      // Evaluate condition
      if (declarativeAction.if && !evaluateCondition(declarativeAction.if, modifiedSession)) {
        api.logger.debug(`[FETCH] Skipping fetch action ${declarativeAction.type} - condition not met`);
        continue;
      }

      // Interpolate config
      const config = interpolateConfig(declarativeAction.config, context);
      api.logger.debug(`[FETCH] Interpolated config: ${JSON.stringify(config)}`);

      try {
        // Execute action
        api.logger.info(`[FETCH] Executing ${declarativeAction.type}...`);
        const result = await executeDeclarativeAction(
          declarativeAction.type,
          config,
          { session: modifiedSession, api, step: modifiedStep },
          actionRegistry
        );
        api.logger.info(`[FETCH] Action ${declarativeAction.type} completed. Result type: ${typeof result}`);

        // Inject result into session
        if (result !== null && result !== undefined) {
          if (typeof result === "object") {
            // If result is an object, inject all its fields as separate variables
            const resultObj = result as Record<string, unknown>;
            api.logger.info(`[FETCH] Injecting ${Object.keys(resultObj).length} variables from result: ${Object.keys(resultObj).join(', ')}`);

            for (const [key, value] of Object.entries(resultObj)) {
              if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                modifiedSession = {
                  ...modifiedSession,
                  variables: {
                    ...modifiedSession.variables,
                    [key]: value,
                  },
                };
                api.logger.debug(`[FETCH] Injected ${key} = ${value}`);
              }
            }
            // Update context for next actions
            context.variables = modifiedSession.variables;
          } else if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") {
            // If result is a primitive, inject it under varName
            api.logger.info(`[FETCH] Injecting primitive result as ${varName} = ${result}`);
            modifiedSession = {
              ...modifiedSession,
              variables: {
                ...modifiedSession.variables,
                [varName]: result,
              },
            };
            // Update context for next actions
            context.variables = modifiedSession.variables;
          }
        } else {
          api.logger.warn(`[FETCH] Action ${declarativeAction.type} returned null/undefined`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        api.logger.error(`[FETCH] Fetch action ${declarativeAction.type} failed: ${errorMsg}`);
        if (errorStack) {
          api.logger.debug(`[FETCH] Stack trace: ${errorStack}`);
        }
        // Continue with other actions
      }
    }

    api.logger.info(`[FETCH] Fetch actions complete. Variables in session: ${Object.keys(modifiedSession.variables).join(', ')}`);
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

  // Load action registry
  const actionRegistry = await loadActionRegistry(flow.actions?.imports);
  api.logger.debug(`Loaded action registry with ${actionRegistry.list().length} actions`);

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
  const actionResult = await executeStepActions(api, firstStep, session, flow, actionRegistry);
  firstStep = actionResult.step;
  session = actionResult.session;

  return renderStep(api, flow, firstStep, session, session.channel);
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
  updatedVariables: Record<string, string | number | boolean>;
}> {
  // Load action registry
  const actionRegistry = await loadActionRegistry(flow.actions?.imports);

  const result = await executeTransition(
    api,
    flow,
    session,
    stepId,
    value,
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
  const actionResult = await executeStepActions(api, nextStep, updatedSession, flow, actionRegistry);
  nextStep = actionResult.step;
  updatedSession = actionResult.session;

  const reply = await renderStep(
    api,
    flow,
    nextStep,
    updatedSession,
    session.channel
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
  variables: Record<string, string | number | boolean>
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
