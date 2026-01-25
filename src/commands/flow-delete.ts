/**
 * /flow-delete command - Delete a flow
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { deleteFlow, loadFlow } from "../state/flow-store.js";

export function createFlowDeleteCommand(api: ClawdbotPluginApi) {
  return async (args: { args?: string }) => {
    const flowName = args.args?.trim();

    if (!flowName) {
      return {
        text: "Usage: /flow-delete <flow-name>\n\nExample: /flow-delete pushups",
      };
    }

    // Check if flow exists
    const flow = await loadFlow(api, flowName);

    if (!flow) {
      return {
        text: `Flow "${flowName}" not found.\n\nUse /flow-list to see available flows.`,
      };
    }

    // Delete flow
    await deleteFlow(api, flowName);

    api.logger.info(`Deleted flow "${flowName}"`);

    return {
      text: `✅ Flow "${flowName}" deleted successfully.`,
    };
  };
}
