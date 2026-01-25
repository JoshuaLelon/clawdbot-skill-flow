/**
 * Skill Flow Plugin - Multi-step workflow orchestration for Clawdbot
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { parseSkillFlowConfig } from "./src/config.js";
import { initSessionStore } from "./src/state/session-store.js";
import { createFlowStartCommand } from "./src/commands/flow-start.js";
import { createFlowStepCommand } from "./src/commands/flow-step.js";
import { createFlowCreateCommand } from "./src/commands/flow-create.js";
import { createFlowListCommand } from "./src/commands/flow-list.js";
import { createFlowDeleteCommand } from "./src/commands/flow-delete.js";

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

    // Register commands
    api.registerCommand({
      name: "flow-start",
      description: "Start a workflow",
      acceptsArgs: true,
      requireAuth: true,
      handler: createFlowStartCommand(api),
    });

    api.registerCommand({
      name: "flow-step",
      description: "Handle flow step transition (internal)",
      acceptsArgs: true,
      requireAuth: true,
      handler: createFlowStepCommand(api),
    });

    api.registerCommand({
      name: "flow-create",
      description: "Create a new flow from JSON",
      acceptsArgs: true,
      requireAuth: true,
      handler: createFlowCreateCommand(api),
    });

    api.registerCommand({
      name: "flow-list",
      description: "List all available flows",
      acceptsArgs: false,
      requireAuth: true,
      handler: createFlowListCommand(api),
    });

    api.registerCommand({
      name: "flow-delete",
      description: "Delete a flow",
      acceptsArgs: true,
      requireAuth: true,
      handler: createFlowDeleteCommand(api),
    });

    api.logger.info("Skill Flow plugin registered successfully", {
      sessionTimeoutMinutes: config.sessionTimeoutMinutes,
      enableBuiltinHistory: config.enableBuiltinHistory,
    });
  },
};

export default plugin;
