/**
 * Executor and transitions tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { executeTransition } from "../src/engine/transitions";
import type { FlowMetadata, FlowSession } from "../src/types";
import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";

// Mock API
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

describe("executeTransition", () => {
  let testFlow: FlowMetadata;
  let testSession: FlowSession;

  beforeEach(() => {
    testFlow = {
      name: "test-flow",
      description: "Test flow",
      version: "1.0.0",
      steps: [
        {
          id: "step1",
          message: "First step",
          next: "step2",
        },
        {
          id: "step2",
          message: "Second step",
        },
      ],
    };

    testSession = {
      flowName: "test-flow",
      currentStepId: "step1",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };
  });

  it("should transition to next step", async () => {
    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "step1",
      "continue"
    );

    expect(result.complete).toBe(false);
    expect(result.nextStepId).toBe("step2");
    expect(result.error).toBeUndefined();
  });

  it("should complete flow when no next step", async () => {
    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "step2",
      "done"
    );

    expect(result.complete).toBe(true);
    expect(result.nextStepId).toBeUndefined();
  });

  it("should capture variable", async () => {
    testFlow.steps[0]!.capture = "user_input";

    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "step1",
      "test value"
    );

    expect(result.variables.user_input).toBe("test value");
  });

  it("should validate number input", async () => {
    testFlow.steps[0]!.capture = "count";
    testFlow.steps[0]!.validate = "number";

    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "step1",
      "abc"
    );

    expect(result.error).toBeTruthy();
    expect(result.complete).toBe(false);
  });

  it("should accept valid number", async () => {
    testFlow.steps[0]!.capture = "count";
    testFlow.steps[0]!.validate = "number";

    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "step1",
      "42"
    );

    expect(result.error).toBeUndefined();
    expect(result.variables.count).toBe(42);
  });

  it("should handle conditional branching - greaterThan", async () => {
    testSession.variables = { score: 8 };

    testFlow.steps[0]!.condition = {
      variable: "score",
      greaterThan: 5,
      next: "high-score",
    };

    testFlow.steps.push({
      id: "high-score",
      message: "High score!",
    });

    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "step1",
      "continue"
    );

    expect(result.nextStepId).toBe("high-score");
  });

  it("should handle conditional branching - equals", async () => {
    testSession.variables = { choice: "yes" };

    testFlow.steps[0]!.condition = {
      variable: "choice",
      equals: "yes",
      next: "confirmed",
    };

    testFlow.steps.push({
      id: "confirmed",
      message: "Confirmed!",
    });

    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "step1",
      "continue"
    );

    expect(result.nextStepId).toBe("confirmed");
  });

  it("should use button-specific next", async () => {
    testFlow.steps[0]!.buttons = [
      { text: "Yes", value: "yes", next: "confirm" },
      { text: "No", value: "no", next: "cancel" },
    ];

    testFlow.steps.push(
      {
        id: "confirm",
        message: "Confirmed!",
      },
      {
        id: "cancel",
        message: "Cancelled!",
      }
    );

    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "step1",
      "yes"
    );

    expect(result.nextStepId).toBe("confirm");
  });

  it("should return error for missing step", async () => {
    const result = await executeTransition(
      mockApi,
      testFlow,
      testSession,
      "nonexistent",
      "test"
    );

    expect(result.error).toBeTruthy();
    expect(result.complete).toBe(false);
  });
});
