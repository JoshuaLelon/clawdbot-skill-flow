/**
 * /flow_generate command - Generate flows from natural language
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { generateFlow, formatFlowJSON } from "../llm/flow-generator.js";
import { saveFlow } from "../state/flow-store.js";
import type { FlowMetadata } from "../types.js";

// Store pending flows for confirmation
const pendingFlows = new Map<string, FlowMetadata>();

export function createFlowGenerateCommand(api: ClawdbotPluginApi) {
  return async (args: { args?: string; senderId?: string }) => {
    const input = args.args?.trim();
    const senderId = args.senderId || "unknown";

    if (!input) {
      return {
        text: `Usage: /flow_generate <description>

Example:
/flow_generate Create a 4-set pushup tracker with progressive difficulty

This command uses AI to generate a complete flow from your description. You'll see a preview before saving.`,
      };
    }

    // Check for special commands
    if (input === "save" || input === "confirm") {
      return handleConfirmation(api, senderId);
    }

    if (input === "cancel" || input === "discard") {
      pendingFlows.delete(senderId);
      return {
        text: "Flow generation cancelled. No changes made.",
      };
    }

    // Generate flow
    try {
      api.logger.info("Starting flow generation", {
        senderId,
        request: input,
      });

      const result = await generateFlow(api, input, {
        includeExamples: true,
      });

      if (!result.success || !result.flow) {
        return {
          text: `❌ Flow generation failed\n\n${result.error || "Unknown error"}\n\nTry rephrasing your request or being more specific about the steps you want.`,
        };
      }

      // Store for confirmation
      pendingFlows.set(senderId, result.flow);

      // Show preview
      const preview = result.preview || "No preview available";
      const jsonPreview = formatFlowJSON(result.flow);

      return {
        text: `✅ Flow generated successfully!\n\n${preview}\n\n📋 JSON:\n\`\`\`json\n${jsonPreview}\n\`\`\`\n\nTo save this flow, use: /flow_generate save\nTo cancel: /flow_generate cancel`,
      };
    } catch (error) {
      api.logger.error("Flow generation command failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        text: `❌ Unexpected error during flow generation\n\n${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  };
}

/**
 * Handle save confirmation
 */
async function handleConfirmation(
  api: ClawdbotPluginApi,
  senderId: string
): Promise<{ text: string }> {
  const flow = pendingFlows.get(senderId);

  if (!flow) {
    return {
      text: "No pending flow to save. Generate a flow first with:\n/flow_generate <description>",
    };
  }

  try {
    // Save flow
    await saveFlow(api, flow);

    // Clear pending
    pendingFlows.delete(senderId);

    api.logger.info("Flow saved from generation", {
      flowName: flow.name,
      senderId,
    });

    return {
      text: `✅ Flow "${flow.name}" saved successfully!\n\nStart it with: /flow_start ${flow.name}\n\nView all flows: /flow_list`,
    };
  } catch (error) {
    api.logger.error("Failed to save generated flow", {
      error: error instanceof Error ? error.message : String(error),
      flowName: flow.name,
    });

    return {
      text: `❌ Failed to save flow\n\n${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
