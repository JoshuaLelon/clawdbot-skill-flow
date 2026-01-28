/**
 * Flow step rendering for different channel types
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import type {
  FlowMetadata,
  FlowStep,
  FlowSession,
  ReplyPayload,
} from "../types.js";
import { normalizeButton } from "../validation.js";

/**
 * Interpolate variables in message text
 */
function interpolateVariables(
  text: string,
  variables: Record<string, string | number | boolean>
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
  variables: Record<string, string | number | boolean>
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
  variables: Record<string, string | number | boolean>
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
 * Render a flow step for the user's channel
 *
 * Note: Step actions (fetch, beforeRender) are executed in executor.ts
 * before this function is called.
 *
 * @param _api - Plugin API (reserved for future use)
 * @param flow - Flow metadata
 * @param step - Step to render (already modified by beforeRender actions)
 * @param session - Current session with variables (already populated by fetch actions)
 * @param channel - Target channel (telegram, slack, etc.)
 * @returns Rendered message payload for the channel
 */
export async function renderStep(
  _api: ClawdbotPluginApi,
  flow: FlowMetadata,
  step: FlowStep,
  session: FlowSession,
  channel: string
): Promise<ReplyPayload> {
  // Channel-specific rendering
  if (channel === "telegram") {
    return renderTelegram(flow.name, step, session.variables);
  }

  // Fallback for all other channels
  return renderFallback(step, session.variables);
}
