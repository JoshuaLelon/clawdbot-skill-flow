/**
 * Flow step rendering for different channel types
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type {
  FlowMetadata,
  FlowStep,
  FlowSession,
  ReplyPayload,
  FlowHooks,
} from "../types.js";
import { normalizeButton } from "../validation.js";
import { safeExecuteHook } from "./hooks-loader.js";

/**
 * Interpolate variables in message text
 */
function interpolateVariables(
  text: string,
  variables: Record<string, string | number>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Render step for Telegram (with inline keyboard)
 */
function renderTelegram(
  flowName: string,
  step: FlowStep,
  variables: Record<string, string | number>
): ReplyPayload {
  const message = interpolateVariables(step.message, variables);

  if (!step.buttons || step.buttons.length === 0) {
    return { text: message };
  }

  const buttons = step.buttons.map((btn, idx) =>
    normalizeButton(btn, idx)
  );

  // Detect if all buttons are numeric (for grid layout)
  const allNumeric = buttons.every((btn) => typeof btn.value === "number");

  let keyboard: Array<{ text: string; callback_data: string }[]>;

  if (allNumeric && buttons.length > 2) {
    // 2-column grid for numeric buttons
    keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) {
      const row = buttons.slice(i, i + 2).map((btn) => ({
        text: btn.text,
        callback_data: `/flow_step ${flowName} ${step.id}:${btn.value}`,
      }));
      keyboard.push(row);
    }
  } else {
    // Single column for text buttons
    keyboard = buttons.map((btn) => [
      {
        text: btn.text,
        callback_data: `/flow_step ${flowName} ${step.id}:${btn.value}`,
      },
    ]);
  }

  return {
    text: message,
    channelData: {
      telegram: {
        buttons: keyboard,
      },
    },
  };
}

/**
 * Render step for fallback channels (text-based)
 */
function renderFallback(
  step: FlowStep,
  variables: Record<string, string | number>
): ReplyPayload {
  const message = interpolateVariables(step.message, variables);

  if (!step.buttons || step.buttons.length === 0) {
    return { text: message };
  }

  const buttons = step.buttons.map((btn, idx) =>
    normalizeButton(btn, idx)
  );

  const buttonList = buttons
    .map((btn, idx) => `${idx + 1}. ${btn.text}`)
    .join("\n");

  return {
    text: `${message}\n\n${buttonList}\n\nReply with the number of your choice.`,
  };
}

/**
 * Render a flow step
 */
export async function renderStep(
  api: ClawdbotPluginApi,
  flow: FlowMetadata,
  step: FlowStep,
  session: FlowSession,
  channel: string,
  hooks?: FlowHooks | null
): Promise<ReplyPayload> {
  // Call onStepRender hook if available
  let finalStep = step;
  if (hooks?.onStepRender) {
    const modifiedStep = await safeExecuteHook(
      api,
      "onStepRender",
      hooks.onStepRender,
      step,
      session
    );
    if (modifiedStep) {
      finalStep = modifiedStep;
    }
  }

  // Channel-specific rendering
  if (channel === "telegram") {
    return renderTelegram(flow.name, finalStep, session.variables);
  }

  // Fallback for all other channels
  return renderFallback(finalStep, session.variables);
}
