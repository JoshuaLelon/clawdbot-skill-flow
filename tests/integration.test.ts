import { describe, it, expect } from "vitest";
import { renderStep } from "../src/engine/renderer";
import type { FlowMetadata, FlowSession } from "../src/types";
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";

const mockApi: ClawdbotPluginApi = {
  logger: {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
  },
  runtime: {
    state: {
      resolveStateDir: () => "/tmp/clawdbot-test",
    },
  },
  registerCommand: () => {},
} as ClawdbotPluginApi;

describe("Integration: channelData format", () => {
  it("should output Telegram buttons in channelData envelope", async () => {
    const flow: FlowMetadata = {
      name: "pushups",
      description: "Pushup workout",
      version: "1.0.0",
      steps: [
        {
          id: "set1",
          message: "Set 1: How many pushups?",
          buttons: [20, 25, 30, 35, 40],
          capture: "set1",
          validate: "number",
        },
      ],
    };

    const session: FlowSession = {
      flowName: "pushups",
      currentStepId: "set1",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    const result = await renderStep(
      mockApi,
      flow,
      flow.steps[0]!,
      session,
      "telegram"
    );

    // Verify structure matches Clawdbot's ReplyPayload + channelData pattern
    expect(result).toHaveProperty("text");
    expect(result).toHaveProperty("channelData");
    expect(result.channelData).toHaveProperty("telegram");
    expect(result.channelData?.telegram).toHaveProperty("buttons");

    // Verify buttons format
    const buttons = result.channelData?.telegram?.buttons;
    expect(Array.isArray(buttons)).toBe(true);
    expect(buttons).toHaveLength(3); // 5 buttons in 2-column grid = 3 rows

    // Verify first button
    expect(buttons?.[0]?.[0]).toEqual({
      text: "20",
      callback_data: "/flow-step pushups set1:20",
    });

    // Verify 2-column layout
    expect(buttons?.[0]).toHaveLength(2); // First row has 2 buttons
    expect(buttons?.[1]).toHaveLength(2); // Second row has 2 buttons
    expect(buttons?.[2]).toHaveLength(1); // Last row has 1 button (odd total)
  });

  it("should not have custom buttons field (old pattern)", async () => {
    const flow: FlowMetadata = {
      name: "test",
      description: "Test",
      version: "1.0.0",
      steps: [
        {
          id: "step1",
          message: "Choose",
          buttons: ["A", "B"],
        },
      ],
    };

    const session: FlowSession = {
      flowName: "test",
      currentStepId: "step1",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    const result = await renderStep(
      mockApi,
      flow,
      flow.steps[0]!,
      session,
      "telegram"
    );

    // Verify no custom 'buttons' field at top level
    expect(result).not.toHaveProperty("buttons");
  });
});
