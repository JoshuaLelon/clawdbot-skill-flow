/**
 * /flow-create command - Create a new flow
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { saveFlow } from "../state/flow-store.js";
import { FlowMetadataSchema } from "../validation.js";
import type { FlowMetadata } from "../types.js";

export function createFlowCreateCommand(api: ClawdbotPluginApi) {
  return async (args: { args?: string }) => {
    const input = args.args?.trim();

    if (!input) {
      return {
        text: "Usage: /flow-create import <json>\n\nExample:\n/flow-create import {...}",
      };
    }

    // Check for 'import' subcommand
    const importMatch = input.match(/^import\s+(.+)$/s);

    if (!importMatch) {
      return {
        text: "Currently only 'import' mode is supported.\n\nUsage: /flow-create import <json>",
      };
    }

    const jsonStr = importMatch[1];
    if (!jsonStr) {
      return {
        text: "Error: No JSON provided",
      };
    }

    try {
      // Parse JSON
      const data = JSON.parse(jsonStr) as unknown;

      // Validate schema
      const flow: FlowMetadata = FlowMetadataSchema.parse(data);

      // Save flow
      await saveFlow(api, flow);

      api.logger.info(`Created flow "${flow.name}"`);

      return {
        text: `✅ Flow "${flow.name}" created successfully!\n\nStart it with: /flow-start ${flow.name}`,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {
          text: `Error: Invalid JSON\n\n${error.message}`,
        };
      }

      if (error instanceof Error) {
        return {
          text: `Error: Invalid flow definition\n\n${error.message}`,
        };
      }

      return {
        text: "Error: Failed to create flow",
      };
    }
  };
}
