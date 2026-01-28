/**
 * Action executor for declarative actions
 * Validates config against schema and executes with timeout/retry
 */

import type { ActionContext, ActionDefinition } from "./action-registry.js";
import type { ActionRegistry } from "./action-loader.js";

/**
 * Execute a declarative action
 *
 * @param actionType - The action type (e.g., "sheets.append")
 * @param config - The action configuration
 * @param context - Execution context (session, api, step, etc.)
 * @param registry - Action registry to look up action definition
 * @returns Promise resolving to action result
 */
export async function executeDeclarativeAction(
  actionType: string,
  config: unknown,
  context: ActionContext,
  registry: ActionRegistry
): Promise<unknown> {
  // Get action definition from registry
  const actionDef = registry.get(actionType);

  if (!actionDef) {
    throw new Error(
      `Unknown action type: ${actionType}. Available actions: ${registry.list().join(", ")}`
    );
  }

  // Validate config against schema
  try {
    const validatedConfig = actionDef.schema.parse(config);

    // Execute with timeout and error handling
    return await safeExecuteAction(
      actionType,
      actionDef,
      validatedConfig,
      context
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Invalid configuration for action ${actionType}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Safely execute an action with timeout and error handling
 */
async function safeExecuteAction(
  actionType: string,
  actionDef: ActionDefinition,
  config: unknown,
  context: ActionContext
): Promise<unknown> {
  const timeout = 30000; // 30 second timeout

  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Action ${actionType} timed out after ${timeout}ms`));
      }, timeout);
    });

    // Race between action execution and timeout
    const result = await Promise.race([
      actionDef.execute(config, context),
      timeoutPromise,
    ]);

    return result;
  } catch (error) {
    // Enhanced error message with context
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorWithContext = new Error(
      `Action ${actionType} failed: ${errorMessage}`
    );

    // Preserve stack trace
    if (error instanceof Error && error.stack) {
      errorWithContext.stack = error.stack;
    }

    throw errorWithContext;
  }
}
