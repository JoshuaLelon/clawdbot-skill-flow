/**
 * LLM Adapter Hook - Adaptive step modification using LLMs
 *
 * Dynamically adapts step messages and button labels based on session context.
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type { FlowStep, FlowSession, FlowHooks } from "../types.js";
import type { LLMAdapterConfig } from "./types.js";
import { getPluginConfig } from "../config.js";
import { callLLM, parseJSONResponse } from "../llm/runner.js";
import {
  getStepAdaptationSystemPrompt,
  buildStepAdaptationPrompt,
  validateStepAdaptationResponse,
} from "../llm/prompts.js";
import { normalizeButton } from "../validation.js";

/**
 * Create an LLM adapter hook for adaptive step modification
 *
 * @param api - Clawdbot plugin API instance
 * @param config - Configuration options for the adapter
 * @returns Hook function for onStepRender
 *
 * @example
 * ```ts
 * import { createLLMAdapter } from '@joshualelon/clawdbot-skill-flow/hooks/llm-adapter';
 *
 * export default {
 *   onStepRender: createLLMAdapter(api, {
 *     adaptMessage: true,
 *     adaptButtons: true,
 *     includeVariables: true
 *   })
 * };
 * ```
 */
export function createLLMAdapter(
  api: ClawdbotPluginApi,
  config: LLMAdapterConfig = {}
): NonNullable<FlowHooks["onStepRender"]> {
  // Apply defaults
  const {
    enabled = true,
    adaptMessage = true,
    adaptButtons = true,
    preserveButtonValues = true,
    includeVariables = true,
    includeFlowMetadata = false,
    fallbackToOriginal = true,
    temperature = 0.7,
    maxTokens = 500,
  } = config;

  return async (step: FlowStep, session: FlowSession): Promise<FlowStep> => {
    // Check if enabled
    if (!enabled) {
      return step;
    }

    // Check step filter
    if (config.stepFilter && !config.stepFilter(step)) {
      return step;
    }

    // Check user filter
    if (config.userFilter && !(await config.userFilter(session))) {
      return step;
    }

    try {
      const pluginConfig = getPluginConfig();
      const llmConfig = pluginConfig.llm || {};

      // Build system and user prompts
      const systemPrompt = getStepAdaptationSystemPrompt();
      const userPrompt = buildStepAdaptationPrompt(step, session, {
        includeVariables,
        includeFlowMetadata,
        adaptButtons: adaptButtons && !!step.buttons,
      });

      api.logger.debug("Adapting step with LLM", {
        stepId: step.id,
        flowName: session.flowName,
        senderId: session.senderId,
      });

      // Call LLM
      const result = await callLLM(api, {
        systemPrompt,
        userPrompt,
        provider: config.provider || llmConfig.defaultProvider,
        model: config.model || llmConfig.defaultModel,
        temperature,
        maxTokens,
        timeout: llmConfig.adaptationTimeout || 5000,
      });

      if (!result.success || !result.response) {
        api.logger.warn("LLM adaptation failed, using original step", {
          stepId: step.id,
          error: result.error,
        });
        return fallbackToOriginal ? step : step;
      }

      // Parse response
      let parsedResponse: unknown;
      try {
        parsedResponse = parseJSONResponse(result.response);
      } catch (parseError) {
        api.logger.warn("Failed to parse LLM adaptation response", {
          stepId: step.id,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
        return fallbackToOriginal ? step : step;
      }

      // Validate response
      const validation = validateStepAdaptationResponse(parsedResponse);
      if (!validation.valid) {
        api.logger.warn("Invalid LLM adaptation response", {
          stepId: step.id,
          error: validation.error,
        });
        return fallbackToOriginal ? step : step;
      }

      // Apply adaptations
      const adaptedStep: FlowStep = { ...step };

      // Adapt message
      if (adaptMessage && validation.message) {
        adaptedStep.message = validation.message;
      }

      // Adapt buttons
      if (
        adaptButtons &&
        validation.buttons &&
        step.buttons &&
        validation.buttons.length === step.buttons.length
      ) {
        // Map new labels to existing buttons, preserving values
        adaptedStep.buttons = step.buttons.map((originalBtn, idx) => {
          const normalizedOriginal = normalizeButton(originalBtn, idx);
          const newLabel = validation.buttons![idx]!;

          if (preserveButtonValues) {
            // Keep original value, update label
            return {
              text: newLabel,
              value: normalizedOriginal.value,
              next: normalizedOriginal.next,
            };
          } else {
            // Update both label and value
            return {
              text: newLabel,
              value: newLabel,
              next: normalizedOriginal.next,
            };
          }
        });
      } else if (adaptButtons && validation.buttons && step.buttons) {
        api.logger.warn("Button count mismatch in adaptation, keeping original", {
          stepId: step.id,
          originalCount: step.buttons.length,
          adaptedCount: validation.buttons.length,
        });
      }

      api.logger.debug("Successfully adapted step", {
        stepId: step.id,
        adaptedMessage: adaptMessage,
        adaptedButtons: adaptButtons && !!validation.buttons,
      });

      return adaptedStep;
    } catch (error) {
      api.logger.error("Unexpected error during step adaptation", {
        stepId: step.id,
        error: error instanceof Error ? error.message : String(error),
      });

      return fallbackToOriginal ? step : step;
    }
  };
}
