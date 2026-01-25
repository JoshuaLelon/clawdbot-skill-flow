/**
 * /flow_start command - Start a flow
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { loadFlow, listFlows } from "../state/flow-store.js";
import { createSession, getSessionKey } from "../state/session-store.js";
import { startFlow } from "../engine/executor.js";

export function createFlowStartCommand(api: ClawdbotPluginApi) {
  return async (args: {
    args?: string;
    senderId: string;
    channel: string;
  }) => {
    const flowName = args.args?.trim();

    // Show flow selection buttons when no flow name provided (Telegram)
    if (!flowName) {
      const flows = await listFlows(api);

      if (flows.length === 0) {
        return {
          text: "No flows available.\n\nCreate one with /flow_create",
        };
      }

      // Show buttons on Telegram, text list on other channels
      if (args.channel === "telegram") {
        const buttons = flows.map((flow) => [
          {
            text: `${flow.name}${flow.description ? ` - ${flow.description}` : ""}`,
            callback_data: `/flow_start ${flow.name}`,
          },
        ]);

        return {
          text: "Choose a flow to start:",
          channelData: {
            telegram: { buttons },
          },
        };
      }

      // Fallback for non-Telegram channels
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
