/**
 * /flow_step command - Handle flow step transitions (called via Telegram callbacks)
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { parseSkillFlowConfig } from "../config.js";
import { loadFlow } from "../state/flow-store.js";
import {
  getSession,
  getSessionKey,
  updateSession,
  deleteSession,
} from "../state/session-store.js";
import { saveFlowHistory } from "../state/history-store.js";
import { processStep } from "../engine/executor.js";
import {
  loadHooks,
  resolveFlowPath,
  safeExecuteHook,
} from "../engine/hooks-loader.js";

export function createFlowStepCommand(api: ClawdbotPluginApi) {
  return async (args: {
    args?: string;
    senderId: string;
    channel: string;
  }) => {
    const input = args.args?.trim();

    if (!input) {
      return {
        text: "Error: Missing step parameters",
      };
    }

    // Parse callback: "flowName stepId:value"
    const parts = input.split(" ");
    if (parts.length < 2) {
      return {
        text: "Error: Invalid step parameters",
      };
    }

    const flowName = parts[0]!;
    const stepData = parts.slice(1).join(" "); // Handle spaces in value
    const colonIndex = stepData.indexOf(":");

    if (colonIndex === -1) {
      return {
        text: "Error: Invalid step format (expected stepId:value)",
      };
    }

    const stepId = stepData.substring(0, colonIndex);
    const valueStr = stepData.substring(colonIndex + 1);

    // Load flow first
    const flow = await loadFlow(api, flowName);

    if (!flow) {
      return {
        text: `Flow "${flowName}" not found.`,
      };
    }

    // Get active session
    const sessionKey = getSessionKey(args.senderId, flowName);
    const session = getSession(sessionKey);

    if (!session) {
      // Load hooks and call onFlowAbandoned
      if (flow.hooks) {
        const hooksPath = resolveFlowPath(api, flow.name, flow.hooks);
        const hooks = await loadHooks(api, hooksPath);
        if (hooks?.lifecycle?.onFlowAbandoned) {
          await safeExecuteHook(
            api,
            "onFlowAbandoned",
            hooks.lifecycle.onFlowAbandoned,
            {
              flowName,
              currentStepId: stepId,
              senderId: args.senderId,
              channel: args.channel,
              variables: {},
              startedAt: 0,
              lastActivityAt: 0,
            },
            "timeout"
          );
        }
      }

      return {
        text: `Session expired or not found.\n\nUse /flow_start ${flowName} to restart the flow.`,
      };
    }

    // Detect if value should be numeric
    const value = /^\d+$/.test(valueStr) ? Number(valueStr) : valueStr;

    // Process step transition
    const result = await processStep(api, flow, session, stepId, value);

    // Update session or cleanup
    if (result.complete) {
      // Save to history
      const finalSession = {
        ...session,
        variables: result.updatedVariables,
      };
      const config = parseSkillFlowConfig(api.pluginConfig);
      await saveFlowHistory(api, finalSession, flow, config);

      // Cleanup session
      deleteSession(sessionKey);

      api.logger.info(
        `Completed flow "${flowName}" for user ${args.senderId}`
      );
    } else {
      // Update session with new variables and current step
      updateSession(sessionKey, {
        variables: result.updatedVariables,
      });
    }

    return result.reply;
  };
}
