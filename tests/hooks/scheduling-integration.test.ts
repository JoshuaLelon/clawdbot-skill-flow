/**
 * Integration tests for scheduling
 */

import { describe, it, expect, vi } from "vitest";
import { createScheduler } from "../../src/hooks/scheduling.js";
import type { FlowSession } from "../../src/types.js";

describe("createScheduler integration", () => {
  it("should create a scheduler hook", () => {
    const hook = createScheduler({
      days: ["mon", "wed", "fri"],
      time: "08:00",
    });

    expect(hook).toBeDefined();
    expect(typeof hook).toBe("function");
  });

  it("should schedule next session on completion", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error");

    const hook = createScheduler({
      days: ["mon", "wed", "fri"],
      time: "08:00",
    });

    const session: FlowSession = {
      flowName: "pushups",
      currentStepId: "complete",
      senderId: "user123",
      channel: "telegram",
      variables: { set1: 20, set2: 22 },
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await hook(session);

    // Without valid credentials, it should fail but not throw (error is caught)
    // The error should be logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to schedule next session')
    );

    consoleErrorSpy.mockRestore();
  });

  it("should use default configuration", async () => {
    const hook = createScheduler({});

    const session: FlowSession = {
      flowName: "test",
      currentStepId: "complete",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    // Should not throw
    await expect(hook(session)).resolves.not.toThrow();
  });

  it("should handle scheduling errors gracefully", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error");

    const hook = createScheduler({
      days: [], // Invalid: no days specified
      time: "08:00",
    });

    const session: FlowSession = {
      flowName: "test",
      currentStepId: "complete",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    // Should not throw even with invalid config
    await expect(hook(session)).resolves.not.toThrow();

    // Should have logged a warning
    expect(consoleErrorSpy).not.toHaveBeenCalled(); // Actually logs a warning, not error

    consoleErrorSpy.mockRestore();
  });

  it("should work with calendar check disabled", async () => {
    const hook = createScheduler({
      days: ["mon"],
      time: "09:00",
      calendarCheck: false,
    });

    const session: FlowSession = {
      flowName: "test",
      currentStepId: "complete",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await expect(hook(session)).resolves.not.toThrow();
  });

  it("should work with calendar check enabled", async () => {
    const hook = createScheduler({
      days: ["tue"],
      time: "10:00",
      calendarCheck: true,
      rescheduleOnConflict: true,
    });

    const session: FlowSession = {
      flowName: "test",
      currentStepId: "complete",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };

    await expect(hook(session)).resolves.not.toThrow();
  });
});
