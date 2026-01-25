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

describe("renderStep - Telegram buttons", () => {
  it("should render buttons in channelData.telegram", async () => {
    const flow: FlowMetadata = {
      name: "test-flow",
      description: "Test",
      version: "1.0.0",
      steps: [
        {
          id: "step1",
          message: "Choose an option",
          buttons: ["Option A", "Option B"],
        },
      ],
    };

    const session: FlowSession = {
      flowName: "test-flow",
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

    expect(result.text).toBe("Choose an option");
    expect(result.channelData?.telegram).toBeDefined();
    expect(result.channelData?.telegram?.buttons).toHaveLength(2);
    expect(result.channelData?.telegram?.buttons?.[0]).toEqual([
      { text: "Option A", callback_data: "/flow-step test-flow step1:Option A" },
    ]);
  });

  it("should render numeric buttons in 2-column grid", async () => {
    const flow: FlowMetadata = {
      name: "pushups",
      description: "Test",
      version: "1.0.0",
      steps: [
        {
          id: "set1",
          message: "Set 1 reps?",
          buttons: [20, 25, 30, 35],
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

    const buttons = result.channelData?.telegram?.buttons;
    expect(buttons).toHaveLength(2); // 2 rows
    expect(buttons?.[0]).toHaveLength(2); // 2 buttons per row
    expect(buttons?.[0]?.[0]).toEqual({
      text: "20",
      callback_data: "/flow-step pushups set1:20",
    });
  });

  it("should render steps without buttons", async () => {
    const flow: FlowMetadata = {
      name: "test-flow",
      description: "Test",
      version: "1.0.0",
      steps: [
        {
          id: "step1",
          message: "This is a message without buttons",
        },
      ],
    };

    const session: FlowSession = {
      flowName: "test-flow",
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

    expect(result.text).toBe("This is a message without buttons");
    expect(result.channelData).toBeUndefined();
  });

  it("should interpolate variables in messages", async () => {
    const flow: FlowMetadata = {
      name: "test-flow",
      description: "Test",
      version: "1.0.0",
      steps: [
        {
          id: "step1",
          message: "Hello {{name}}, you scored {{score}} points!",
        },
      ],
    };

    const session: FlowSession = {
      flowName: "test-flow",
      currentStepId: "step1",
      senderId: "user123",
      channel: "telegram",
      variables: {
        name: "Alice",
        score: 42,
      },
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

    expect(result.text).toBe("Hello Alice, you scored 42 points!");
  });
});
