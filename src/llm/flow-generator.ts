/**
 * Flow Generation - Generate flows from natural language descriptions
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type { FlowMetadata } from "../types.js";
import { FlowMetadataSchema } from "../validation.js";
import { getPluginConfig } from "../config.js";
import { callLLM, parseJSONResponse } from "./runner.js";
import {
  getFlowGenerationSystemPrompt,
  buildFlowGenerationPrompt,
  validateFlowGenerationResponse,
} from "./prompts.js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load example flows for context
 */
function loadExampleFlows(): FlowMetadata[] {
  const examples: FlowMetadata[] = [];
  const examplesDir = join(__dirname, "..", "examples");

  try {
    // Load pushups example (most complete example)
    const pushupsPath = join(examplesDir, "pushups.json");
    const pushupsData = readFileSync(pushupsPath, "utf-8");
    examples.push(JSON.parse(pushupsData) as FlowMetadata);
  } catch {
    // Examples are optional - just for context
  }

  return examples;
}

/**
 * Generate a flow from natural language description
 */
export async function generateFlow(
  api: ClawdbotPluginApi,
  request: string,
  options?: {
    includeExamples?: boolean;
    context?: string;
  }
): Promise<{
  success: boolean;
  flow?: FlowMetadata;
  error?: string;
  preview?: string;
}> {
  try {
    const config = getPluginConfig();
    const llmConfig = config.llm || {};

    // Load examples if requested
    const examples =
      options?.includeExamples !== false ? loadExampleFlows() : [];

    // Build prompt
    const systemPrompt = getFlowGenerationSystemPrompt();
    const userPrompt = buildFlowGenerationPrompt(
      request,
      examples,
      options?.context
    );

    api.logger.info("Generating flow from natural language", {
      request,
      hasExamples: examples.length > 0,
      hasContext: !!options?.context,
    });

    // Call LLM
    const result = await callLLM(api, {
      systemPrompt,
      userPrompt,
      provider: llmConfig.defaultProvider,
      model: llmConfig.defaultModel,
      temperature: llmConfig.temperature,
      maxTokens: llmConfig.maxTokens,
      timeout: llmConfig.flowGenerationTimeout,
    });

    if (!result.success || !result.response) {
      return {
        success: false,
        error: result.error || "LLM returned no response",
      };
    }

    // Parse response
    let parsedResponse: unknown;
    try {
      parsedResponse = parseJSONResponse(result.response);
    } catch (parseError) {
      api.logger.warn("Failed to parse LLM response as JSON", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        response: result.response,
      });
      return {
        success: false,
        error: "LLM response was not valid JSON. Please try again with a more specific request.",
      };
    }

    // Validate structure
    const validation = validateFlowGenerationResponse(parsedResponse);
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid flow structure: ${validation.error}`,
      };
    }

    // Parse with Zod schema for full validation
    let flow: FlowMetadata;
    try {
      flow = FlowMetadataSchema.parse(parsedResponse);
    } catch (zodError) {
      return {
        success: false,
        error: `Flow validation failed: ${zodError instanceof Error ? zodError.message : String(zodError)}`,
      };
    }

    // Create preview text
    const preview = createFlowPreview(flow);

    api.logger.info("Successfully generated flow", {
      flowName: flow.name,
      stepCount: flow.steps.length,
    });

    return {
      success: true,
      flow,
      preview,
    };
  } catch (error) {
    api.logger.error("Flow generation failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a human-readable preview of a flow
 */
function createFlowPreview(flow: FlowMetadata): string {
  let preview = `Flow: ${flow.name}\n`;
  preview += `Description: ${flow.description}\n`;
  preview += `Version: ${flow.version}\n`;
  preview += `\nSteps (${flow.steps.length}):\n`;

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i]!;
    preview += `\n${i + 1}. ${step.id}\n`;
    preview += `   Message: "${step.message}"\n`;

    if (step.buttons && step.buttons.length > 0) {
      preview += `   Buttons: ${JSON.stringify(step.buttons)}\n`;
    }

    if (step.capture) {
      preview += `   Captures: ${step.capture}`;
      if (step.validate) {
        preview += ` (validates: ${step.validate})`;
      }
      preview += "\n";
    }

    if (step.next) {
      preview += `   Next: ${step.next}\n`;
    } else {
      preview += `   (Terminal step)\n`;
    }

    if (step.condition) {
      preview += `   Conditional: if ${step.condition.variable} ${step.condition.equals !== undefined ? `= ${step.condition.equals}` : ""} -> ${step.condition.next}\n`;
    }
  }

  return preview;
}

/**
 * Format flow as JSON for display
 */
export function formatFlowJSON(flow: FlowMetadata): string {
  return JSON.stringify(flow, null, 2);
}
