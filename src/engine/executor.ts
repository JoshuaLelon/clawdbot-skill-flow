/**
 * Main flow execution orchestrator
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type { FlowMetadata, FlowSession, ReplyPayload } from "../types.js";
import { renderStep } from "./renderer.js";
import { executeTransition } from "./transitions.js";

/**
 * Start a flow from the beginning
 */
export function startFlow(
  api: ClawdbotPluginApi,
  flow: FlowMetadata,
  session: FlowSession
): ReplyPayload {
  const firstStep = flow.steps[0];

  if (!firstStep) {
    return {
      text: `Error: Flow "${flow.name}" has no steps`,
    };
  }

  return renderStep(api, flow, firstStep, session, session.channel);
}

/**
 * Process a step transition and return next step or completion message
 */
export function processStep(
  api: ClawdbotPluginApi,
  flow: FlowMetadata,
  session: FlowSession,
  stepId: string,
  value: string | number
): {
  reply: ReplyPayload;
  complete: boolean;
  updatedVariables: Record<string, string | number>;
} {
  const result = executeTransition(api, flow, session, stepId, value);

  // Handle errors
  if (result.error) {
    return {
      reply: { text: result.message || result.error },
      complete: false,
      updatedVariables: result.variables,
    };
  }

  // Handle completion
  if (result.complete) {
    const completionMessage = generateCompletionMessage(flow, result.variables);
    return {
      reply: { text: completionMessage },
      complete: true,
      updatedVariables: result.variables,
    };
  }

  // Render next step
  if (!result.nextStepId) {
    return {
      reply: { text: "Error: No next step found" },
      complete: false,
      updatedVariables: result.variables,
    };
  }

  const nextStep = flow.steps.find((s) => s.id === result.nextStepId);
  if (!nextStep) {
    return {
      reply: { text: `Error: Step ${result.nextStepId} not found` },
      complete: false,
      updatedVariables: result.variables,
    };
  }

  const updatedSession = { ...session, variables: result.variables };
  const reply = renderStep(api, flow, nextStep, updatedSession, session.channel);

  return {
    reply,
    complete: false,
    updatedVariables: result.variables,
  };
}

/**
 * Generate completion message
 */
function generateCompletionMessage(
  flow: FlowMetadata,
  variables: Record<string, string | number>
): string {
  let message = `✅ Flow "${flow.name}" completed!\n\n`;

  if (Object.keys(variables).length > 0) {
    message += "Summary:\n";
    for (const [key, value] of Object.entries(variables)) {
      message += `• ${key}: ${value}\n`;
    }
  }

  return message;
}
