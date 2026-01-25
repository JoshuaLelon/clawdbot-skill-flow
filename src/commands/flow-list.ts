/**
 * /flow-list command - List all available flows
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { listFlows } from "../state/flow-store.js";

export function createFlowListCommand(api: ClawdbotPluginApi) {
  return async () => {
    const flows = await listFlows(api);

    if (flows.length === 0) {
      return {
        text: "No flows found.\n\nCreate one with: /flow-create import {...}",
      };
    }

    let message = `📋 Available Flows (${flows.length}):\n\n`;

    for (const flow of flows) {
      message += `• ${flow.name}\n`;
      message += `  ${flow.description}\n`;

      if (flow.triggers?.cron) {
        message += `  🕒 Cron: ${flow.triggers.cron}\n`;
      }

      message += `  Start: /flow-start ${flow.name}\n\n`;
    }

    return { text: message };
  };
}
