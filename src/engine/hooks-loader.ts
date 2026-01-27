/**
 * Hooks loader - Dynamically loads and executes flow hooks
 */

import type { FlowHooks, StorageBackend, LoadedHooks } from "../types.js";
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  resolvePathSafely,
  validatePathWithinBase,
} from "../security/path-validation.js";
import { getPluginConfig } from "../config.js";
import { withTimeout, TimeoutError } from "../security/timeout.js";

/**
 * Get the flows directory path (same logic as flow-store.ts)
 */
function getFlowsDir(api: ClawdbotPluginApi): string {
  const config = getPluginConfig();
  if (config.flowsDir) {
    const expandedPath = config.flowsDir.replace(/^~/, process.env.HOME || "~");
    return path.resolve(expandedPath);
  }
  const stateDir = api.runtime.state.resolveStateDir();
  return path.join(stateDir, "flows");
}

/**
 * Load hooks from a file path
 * @param api - Plugin API for logging
 * @param hooksPath - Absolute path to hooks file
 * @returns LoadedHooks object with lifecycle hooks and actions, or null if loading fails
 */
export async function loadHooks(
  api: ClawdbotPluginApi,
  hooksPath: string
): Promise<LoadedHooks | null> {
  try {
    // Validate path is within flows directory
    const flowsDir = getFlowsDir(api);
    validatePathWithinBase(hooksPath, flowsDir, "hooks file");

    // Check if file exists
    await fs.access(hooksPath);

    // Dynamically import the hooks module
    const hooksModule = await import(hooksPath);

    // Extract default export for lifecycle hooks
    let moduleExport = hooksModule.default ?? {};

    // Support factory functions that take API and return lifecycle hooks
    if (typeof moduleExport === "function") {
      moduleExport = moduleExport(api);
    }

    // Extract global lifecycle hooks from default export
    const lifecycle: FlowHooks = {
      onFlowComplete: moduleExport?.onFlowComplete,
      onFlowAbandoned: moduleExport?.onFlowAbandoned,
    };

    // Extract all named exports as step-level actions
    const actions: Record<string, Function> = {};
    for (const [key, value] of Object.entries(hooksModule)) {
      if (key !== "default" && typeof value === "function") {
        actions[key] = value;
      }
    }

    api.logger.debug(`Loaded hooks from ${hooksPath}: ${Object.keys(actions).length} actions, ${Object.keys(lifecycle).filter(k => lifecycle[k as keyof FlowHooks]).length} lifecycle hooks`);
    return { lifecycle, actions };
  } catch (error) {
    api.logger.warn(`Failed to load hooks from ${hooksPath}:`, error);
    return null;
  }
}

/**
 * Load storage backend from a file path
 * @param api - Plugin API for logging
 * @param backendPath - Absolute path to storage backend file
 * @returns StorageBackend or null if loading fails
 */
export async function loadStorageBackend(
  api: ClawdbotPluginApi,
  backendPath: string
): Promise<StorageBackend | null> {
  try {
    // Validate path is within flows directory
    const flowsDir = getFlowsDir(api);
    validatePathWithinBase(backendPath, flowsDir, "storage backend");

    // Check if file exists
    await fs.access(backendPath);

    // Dynamically import the backend module
    const backendModule = await import(backendPath);

    // Support both default export and named export
    const backend: StorageBackend = backendModule.default ?? backendModule;

    api.logger.debug(`Loaded storage backend from ${backendPath}`);
    return backend;
  } catch (error) {
    api.logger.warn(`Failed to load storage backend from ${backendPath}:`, error);
    return null;
  }
}

/**
 * Resolve relative path to absolute (relative to flow directory)
 * @param api - Plugin API
 * @param flowName - Name of the flow
 * @param relativePath - Relative path from flow config
 * @returns Absolute path
 */
export function resolveFlowPath(
  api: ClawdbotPluginApi,
  flowName: string,
  relativePath: string
): string {
  const flowsDir = getFlowsDir(api);
  const flowDir = path.join(flowsDir, flowName);

  // Validate that relativePath doesn't escape flowDir
  return resolvePathSafely(flowDir, relativePath, "flow path");
}

/**
 * Safe hook executor - wraps hook calls with error handling
 * @param api - Plugin API for logging
 * @param hookName - Name of the hook being called
 * @param hookFn - The hook function to execute
 * @param args - Arguments to pass to the hook
 * @returns Result of hook or undefined if hook fails
 */
export async function safeExecuteHook<T, Args extends unknown[]>(
  api: ClawdbotPluginApi,
  hookName: string,
  hookFn: ((...args: Args) => T | Promise<T>) | undefined,
  ...args: Args
): Promise<T | undefined> {
  if (!hookFn) {
    return undefined;
  }

  const config = getPluginConfig();
  const timeout = config.security.hookTimeout;

  try {
    const result = await withTimeout(
      () => Promise.resolve(hookFn(...args)),
      timeout,
      `Hook "${hookName}" timed out after ${timeout}ms`
    );
    return result;
  } catch (error) {
    const isTimeout = error instanceof TimeoutError;
    const errorMsg = isTimeout
      ? `Hook ${hookName} timed out after ${timeout}ms`
      : `Hook ${hookName} failed: ${error}`;

    api.logger.error(errorMsg);
    return undefined;
  }
}

/**
 * Safe action executor - wraps action calls with error handling
 * @param api - Plugin API for logging
 * @param actionName - Name of the action being called
 * @param actionFn - The action function to execute
 * @param args - Arguments to pass to the action
 * @returns Result of action or undefined if action fails
 */
export async function safeExecuteAction<T, Args extends unknown[]>(
  api: ClawdbotPluginApi,
  actionName: string,
  actionFn: ((...args: Args) => T | Promise<T>) | undefined,
  ...args: Args
): Promise<T | undefined> {
  if (!actionFn) {
    api.logger.warn(`Action ${actionName} not found in hooks`);
    return undefined;
  }

  const config = getPluginConfig();
  const strategy = config.actions?.fetchFailureStrategy || "warn";
  const timeout = config.security.actionTimeout;

  try {
    const result = await withTimeout(
      () => Promise.resolve(actionFn(...args)),
      timeout,
      `Action "${actionName}" timed out after ${timeout}ms`
    );
    return result;
  } catch (error) {
    const isTimeout = error instanceof TimeoutError;
    const errorMsg = isTimeout
      ? `Action ${actionName} timed out after ${timeout}ms`
      : `Action ${actionName} failed: ${error}`;

    if (strategy === "stop") {
      api.logger.error(errorMsg);
      throw error; // Re-throw to stop flow execution
    } else if (strategy === "warn") {
      api.logger.warn(errorMsg);
    }
    // 'silent' strategy logs nothing

    return undefined;
  }
}

/**
 * Extract action name from ConditionalAction
 */
function getActionName(action: import("../types.js").ConditionalAction): string {
  return action.action;
}

/**
 * Validate that all actions referenced in flow steps exist in hooks
 * @param flow - Flow metadata with steps
 * @param hooks - Loaded hooks with actions
 * @param api - Plugin API for logging
 * @throws Error if any action references are invalid
 */
export function validateFlowActions(
  flow: import("../types.js").FlowMetadata,
  hooks: LoadedHooks,
  api: ClawdbotPluginApi
): void {
  const availableActions = Object.keys(hooks.actions);
  const errors: string[] = [];

  for (const step of flow.steps) {
    if (!step.actions) continue;

    // Validate fetch actions
    if (step.actions.fetch) {
      for (const [varName, action] of Object.entries(step.actions.fetch)) {
        const actionName = getActionName(action);
        if (!availableActions.includes(actionName)) {
          errors.push(
            `Step "${step.id}": fetch action "${actionName}" not found (for variable "${varName}")`
          );
        }
      }
    }

    // Validate beforeRender actions
    if (step.actions.beforeRender) {
      for (const action of step.actions.beforeRender) {
        const actionName = getActionName(action);
        if (!availableActions.includes(actionName)) {
          errors.push(
            `Step "${step.id}": beforeRender action "${actionName}" not found`
          );
        }
      }
    }

    // Validate afterCapture actions
    if (step.actions.afterCapture) {
      for (const action of step.actions.afterCapture) {
        const actionName = getActionName(action);
        if (!availableActions.includes(actionName)) {
          errors.push(
            `Step "${step.id}": afterCapture action "${actionName}" not found`
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    const errorMsg = `Flow "${flow.name}" has invalid action references:\n${errors.join('\n')}`;
    api.logger.error(errorMsg);

    throw new Error(
      `Flow "${flow.name}" references ${errors.length} action(s) that don't exist in hooks file. ` +
      `Available actions: ${availableActions.join(', ') || '(none)'}`
    );
  }
}
