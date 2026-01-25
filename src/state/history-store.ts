/**
 * JSONL append-only history log for completed flows
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type { FlowSession } from "../types.js";

/**
 * Get history file path for a flow
 */
function getHistoryPath(api: ClawdbotPluginApi, flowName: string): string {
  const stateDir = api.runtime.state.resolveStateDir();
  return path.join(stateDir, "flows", flowName, "history.jsonl");
}

/**
 * Save completed flow session to history (fire-and-forget)
 */
export async function saveFlowHistory(
  api: ClawdbotPluginApi,
  session: FlowSession
): Promise<void> {
  const historyPath = getHistoryPath(api, session.flowName);

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(historyPath), { recursive: true });

    // Create history entry
    const entry = {
      ...session,
      completedAt: Date.now(),
    };

    // Append to JSONL file
    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(historyPath, line, "utf-8");
  } catch (error) {
    // Log error but don't throw (fire-and-forget)
    api.logger.error(
      `Failed to save history for flow ${session.flowName}:`,
      error
    );
  }
}

/**
 * Read history for a flow (for analytics/debugging)
 * @public - For future analytics/debugging features
 */
export async function readFlowHistory(
  api: ClawdbotPluginApi,
  flowName: string
): Promise<Array<FlowSession & { completedAt: number }>> {
  const historyPath = getHistoryPath(api, flowName);

  try {
    const content = await fs.readFile(historyPath, "utf-8");
    const lines = content.trim().split("\n");

    return lines
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    api.logger.error(
      `Failed to read history for flow ${flowName}:`,
      error
    );
    throw error;
  }
}
