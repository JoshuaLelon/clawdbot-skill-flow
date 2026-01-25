/**
 * Hooks loader - Dynamically loads and executes flow hooks
 */

import type { FlowHooks, StorageBackend } from "../types.js";
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  resolvePathSafely,
  validatePathWithinBase,
} from "../security/path-validation.js";

/**
 * Load hooks from a file path
 * @param api - Plugin API for logging
 * @param hooksPath - Absolute path to hooks file
 * @returns FlowHooks object or null if loading fails
 */
export async function loadHooks(
  api: ClawdbotPluginApi,
  hooksPath: string
): Promise<FlowHooks | null> {
  try {
    // Validate path is within flows directory
    const flowsDir = path.join(api.runtime.state.resolveStateDir(), "flows");
    validatePathWithinBase(hooksPath, flowsDir, "hooks file");

    // Check if file exists
    await fs.access(hooksPath);

    // Dynamically import the hooks module
    const hooksModule = await import(hooksPath);

    // Support both default export and named export
    const hooks: FlowHooks = hooksModule.default ?? hooksModule;

    api.logger.debug(`Loaded hooks from ${hooksPath}`);
    return hooks;
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
    const flowsDir = path.join(api.runtime.state.resolveStateDir(), "flows");
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
  const flowDir = path.join(
    api.runtime.state.resolveStateDir(),
    "flows",
    flowName
  );

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

  try {
    const result = await hookFn(...args);
    return result;
  } catch (error) {
    api.logger.error(`Hook ${hookName} failed:`, error);
    return undefined;
  }
}
