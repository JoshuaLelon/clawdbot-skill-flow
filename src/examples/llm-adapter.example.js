/**
 * Example: Using the LLM Adapter Hook
 *
 * This example demonstrates how to use the LLM adapter to make
 * your flow steps adaptive based on user context.
 *
 * Usage:
 * 1. Reference this file in your flow's "hooks" field
 * 2. The hook will adapt step messages and buttons dynamically
 */

import { createLLMAdapter } from "@joshualelon/clawdbot-skill-flow/hooks/llm-adapter";
import { composeHooks } from "@joshualelon/clawdbot-skill-flow/hooks";
import { createDynamicButtons } from "@joshualelon/clawdbot-skill-flow/hooks/dynamic-buttons";

/**
 * Basic LLM adapter - adapts messages based on session variables
 */
export const basicAdapter = (api) => ({
  onStepRender: createLLMAdapter(api, {
    adaptMessage: true,
    includeVariables: true,
  }),
});

/**
 * Button-aware adapter - adapts both messages and button labels
 */
export const buttonAdapter = (api) => ({
  onStepRender: createLLMAdapter(api, {
    adaptMessage: true,
    adaptButtons: true,
    preserveButtonValues: true, // Keep values, just adapt labels
    includeVariables: true,
  }),
});

/**
 * Selective adapter - only adapt certain steps
 */
export const selectiveAdapter = (api) => ({
  onStepRender: createLLMAdapter(api, {
    stepFilter: (step) => {
      // Only adapt steps with IDs starting with "feedback"
      return step.id.startsWith("feedback");
    },
    adaptMessage: true,
    includeVariables: true,
  }),
});

/**
 * User-filtered adapter - only adapt for specific users
 */
export const userFilteredAdapter = (api) => ({
  onStepRender: createLLMAdapter(api, {
    userFilter: (session) => {
      // Only adapt if user has captured at least 2 variables
      return Object.keys(session.variables).length >= 2;
    },
    adaptMessage: true,
    includeVariables: true,
  }),
});

/**
 * Composed adapter - combines dynamic buttons with LLM adaptation
 *
 * This is a powerful pattern:
 * 1. Dynamic buttons generates button values from history
 * 2. LLM adapter then adapts the labels to be more contextual
 */
export const composedAdapter = (api) => ({
  onStepRender: composeHooks(
    // First: Generate dynamic buttons from history
    createDynamicButtons({
      variable: "reps",
      strategy: "centered",
      historyFile: "~/.clawdbot/history/pushups.jsonl",
    }),
    // Then: Adapt message and button labels with LLM
    createLLMAdapter(api, {
      adaptMessage: true,
      adaptButtons: true,
      preserveButtonValues: true,
      includeVariables: true,
    })
  ),
});

/**
 * Performance tuning - adjust LLM parameters
 */
export const customParameters = (api) => ({
  onStepRender: createLLMAdapter(api, {
    temperature: 0.8,    // More creative responses
    maxTokens: 300,      // Shorter responses for faster latency
    adaptMessage: true,
    includeVariables: true,
  }),
});

/**
 * Default export - use the button-aware adapter
 */
export default buttonAdapter;
