/**
 * /flow_start command - Start a flow
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { loadFlow } from "../state/flow-store.js";
import { createSession, getSessionKey } from "../state/session-store.js";
import { startFlow } from "../engine/executor.js";

export function createFlowStartCommand(api: ClawdbotPluginApi) {
  return async (args: {
    args?: string;
    senderId: string;
    channel: string;
  }) => {
    const flowName = args.args?.trim();

    // Validate input
    if (!flowName) {
      return {
        text: "Usage: /flow_start <flow-name>\n\nExample: /flow_start pushups\n\nUse /flow_list to see available flows.",
      };
    }

    // Load flow
    const flow = await loadFlow(api, flowName);

    if (!flow) {
      return {
        text: `Flow "${flowName}" not found.\n\nUse /flow_list to see available flows.`,
      };
    }

    // Verify flow has steps
    if (!flow.steps || flow.steps.length === 0) {
      return {
        text: `Flow "${flowName}" has no steps.`,
      };
    }

    // Create session
    const session = createSession({
      flowName: flow.name,
      currentStepId: flow.steps[0]!.id,
      senderId: args.senderId,
      channel: args.channel,
    });

    api.logger.info(
      `Started flow "${flowName}" for user ${args.senderId} (session: ${getSessionKey(args.senderId, flowName)})`
    );

    // Render first step
    return startFlow(api, flow, session);
  };
}
