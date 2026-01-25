/**
 * Flow metadata storage with file locking for concurrent access
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import lockfile from "lockfile";
import { promisify } from "node:util";
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type { FlowMetadata } from "../types.js";
import { FlowMetadataSchema } from "../validation.js";

const lock = promisify(lockfile.lock);
const unlock = promisify(lockfile.unlock);

/**
 * Get the flows directory path
 */
function getFlowsDir(api: ClawdbotPluginApi): string {
  const stateDir = api.runtime.state.resolveStateDir();
  return path.join(stateDir, "flows");
}

/**
 * Get the flow directory path
 */
function getFlowDir(api: ClawdbotPluginApi, flowName: string): string {
  return path.join(getFlowsDir(api), flowName);
}

/**
 * Get the flow metadata file path
 */
function getFlowMetadataPath(
  api: ClawdbotPluginApi,
  flowName: string
): string {
  return path.join(getFlowDir(api, flowName), "metadata.json");
}

/**
 * Load a flow by name
 */
export async function loadFlow(
  api: ClawdbotPluginApi,
  flowName: string
): Promise<FlowMetadata | null> {
  const metadataPath = getFlowMetadataPath(api, flowName);
  const lockPath = `${metadataPath}.lock`;

  try {
    await lock(lockPath, { wait: 5000, retries: 3 });

    try {
      const content = await fs.readFile(metadataPath, "utf-8");
      const data = JSON.parse(content);
      return FlowMetadataSchema.parse(data);
    } finally {
      await unlock(lockPath);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    api.logger.error(`Failed to load flow ${flowName}:`, error);
    throw error;
  }
}

/**
 * Save a flow (atomic write with locking)
 */
export async function saveFlow(
  api: ClawdbotPluginApi,
  flow: FlowMetadata
): Promise<void> {
  const flowDir = getFlowDir(api, flow.name);
  const metadataPath = getFlowMetadataPath(api, flow.name);
  const lockPath = `${metadataPath}.lock`;
  const tempPath = `${metadataPath}.tmp`;

  // Validate flow metadata
  FlowMetadataSchema.parse(flow);

  try {
    // Ensure flow directory exists
    await fs.mkdir(flowDir, { recursive: true });

    await lock(lockPath, { wait: 5000, retries: 3 });

    try {
      // Write to temp file
      await fs.writeFile(tempPath, JSON.stringify(flow, null, 2), "utf-8");

      // Atomic rename
      await fs.rename(tempPath, metadataPath);
    } finally {
      await unlock(lockPath);

      // Cleanup temp file if it still exists
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore errors
      }
    }
  } catch (error) {
    api.logger.error(`Failed to save flow ${flow.name}:`, error);
    throw error;
  }
}

/**
 * List all flows
 */
export async function listFlows(
  api: ClawdbotPluginApi
): Promise<FlowMetadata[]> {
  const flowsDir = getFlowsDir(api);

  try {
    await fs.mkdir(flowsDir, { recursive: true });
    const entries = await fs.readdir(flowsDir, { withFileTypes: true });

    const flows: FlowMetadata[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const flow = await loadFlow(api, entry.name);
        if (flow) {
          flows.push(flow);
        }
      }
    }

    return flows;
  } catch (error) {
    api.logger.error("Failed to list flows:", error);
    throw error;
  }
}

/**
 * Delete a flow
 */
export async function deleteFlow(
  api: ClawdbotPluginApi,
  flowName: string
): Promise<void> {
  const flowDir = getFlowDir(api, flowName);

  try {
    await fs.rm(flowDir, { recursive: true, force: true });
  } catch (error) {
    api.logger.error(`Failed to delete flow ${flowName}:`, error);
    throw error;
  }
}
