/**
 * Skill Flow Plugin - Multi-step workflow orchestration for Clawdbot
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { parseSkillFlowConfig } from "./src/config.js";
import { initSessionStore, createSession, getSessionKey } from "./src/state/session-store.js";
import { createFlowStartCommand } from "./src/commands/flow-start.js";
import { createFlowStepCommand } from "./src/commands/flow-step.js";
import { createFlowCreateCommand } from "./src/commands/flow-create.js";
import { createFlowListCommand } from "./src/commands/flow-list.js";
import { createFlowDeleteCommand } from "./src/commands/flow-delete.js";
import { saveFlow, loadFlow, listFlows } from "./src/state/flow-store.js";
import { startFlow } from "./src/engine/executor.js";
import { FlowMetadataSchema } from "./src/validation.js";
import type { FlowMetadata } from "./src/types.js";

const plugin = {
  id: "skill-flow",
  name: "Skill Flow",
  description:
    "Multi-step workflow orchestration for deterministic command execution",
  version: "0.1.0",

  register(api: ClawdbotPluginApi) {
    // Parse and validate config
    const config = parseSkillFlowConfig(api.pluginConfig);

    // Initialize session store with config
    initSessionStore(config);

    // Register commands (use underscores per Telegram requirements)
    api.registerCommand({
      name: "flow_start",
      description: "Start a workflow",
      acceptsArgs: true,
      requireAuth: true,
      handler: createFlowStartCommand(api),
    });

    api.registerCommand({
      name: "flow_step",
      description: "Handle flow step transition (internal)",
      acceptsArgs: true,
      requireAuth: true,
      handler: createFlowStepCommand(api),
    });

    api.registerCommand({
      name: "flow_create",
      description: "Create a new flow from JSON",
      acceptsArgs: true,
      requireAuth: true,
      handler: createFlowCreateCommand(api),
    });

    api.registerCommand({
      name: "flow_list",
      description: "List all available flows",
      acceptsArgs: false,
      requireAuth: true,
      handler: createFlowListCommand(api),
    });

    api.registerCommand({
      name: "flow_delete",
      description: "Delete a flow",
      acceptsArgs: true,
      requireAuth: true,
      handler: createFlowDeleteCommand(api),
    });

    // Register gateway methods for programmatic access
    // @ts-expect-error - registerGatewayMethod exists at runtime, types will be available in future clawdbot release
    api.registerGatewayMethod("skill-flow.create", async ({ params, respond }) => {
      try {
        const flow: FlowMetadata = FlowMetadataSchema.parse(params);
        await saveFlow(api, flow);
        api.logger.info(`Created flow "${flow.name}" via gateway method`);
        respond(true, {
          success: true,
          flowName: flow.name,
          message: `Flow "${flow.name}" created successfully`,
        });
      } catch (error) {
        api.logger.error("Gateway method skill-flow.create failed:", error);
        respond(false, {
          error: error instanceof Error ? error.message : "Failed to create flow",
        });
      }
    });

    // @ts-expect-error - registerGatewayMethod exists at runtime, types will be available in future clawdbot release
    api.registerGatewayMethod("skill-flow.list", async ({ respond }) => {
      try {
        const flows = await listFlows(api);
        respond(true, {
          flows: flows.map((f) => ({
            name: f.name,
            description: f.description,
            version: f.version,
            author: f.author,
          })),
        });
      } catch (error) {
        api.logger.error("Gateway method skill-flow.list failed:", error);
        respond(false, {
          error: error instanceof Error ? error.message : "Failed to list flows",
        });
      }
    });

    // @ts-expect-error - registerGatewayMethod exists at runtime, types will be available in future clawdbot release
    api.registerGatewayMethod("skill-flow.start", async ({ params, respond }) => {
      try {
        const { flowName, senderId, channel } = params as {
          flowName: string;
          senderId: string;
          channel: string;
        };

        if (!flowName || !senderId || !channel) {
          respond(false, {
            error: "Missing required parameters: flowName, senderId, channel",
          });
          return;
        }

        // Load flow
        const flow = await loadFlow(api, flowName);
        if (!flow) {
          respond(false, {
            error: `Flow "${flowName}" not found`,
          });
          return;
        }

        // Verify flow has steps
        if (!flow.steps || flow.steps.length === 0) {
          respond(false, {
            error: `Flow "${flowName}" has no steps`,
          });
          return;
        }

        // Create session
        const session = createSession({
          flowName: flow.name,
          currentStepId: flow.steps[0]!.id,
          senderId,
          channel,
        });

        api.logger.info(
          `Started flow "${flowName}" for user ${senderId} via gateway method (session: ${getSessionKey(senderId, flowName)})`
        );

        // Get the first step response
        const response = startFlow(api, flow, session);

        respond(true, {
          success: true,
          sessionId: getSessionKey(senderId, flowName),
          flowName: flow.name,
          message: `Flow "${flowName}" started`,
          response,
        });
      } catch (error) {
        api.logger.error("Gateway method skill-flow.start failed:", error);
        respond(false, {
          error: error instanceof Error ? error.message : "Failed to start flow",
        });
      }
    });

    api.logger.info("Skill Flow plugin registered successfully", {
      sessionTimeoutMinutes: config.sessionTimeoutMinutes,
      enableBuiltinHistory: config.enableBuiltinHistory,
    });
  },
};

export default plugin;
