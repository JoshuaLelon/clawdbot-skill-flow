/**
 * Integration tests for dynamic buttons
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createDynamicButtons } from "../../src/hooks/dynamic-buttons.js";
import type { FlowStep, FlowSession } from "../../src/types.js";

describe("createDynamicButtons integration", () => {
  const testDir = path.join(os.tmpdir(), "skill-flow-test");
  const historyFile = path.join(testDir, "history.jsonl");

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });

    // Create sample history file
    const history = [
      { reps: 20, timestamp: "2026-01-20" },
      { reps: 22, timestamp: "2026-01-21" },
      { reps: 24, timestamp: "2026-01-22" },
      { reps: 26, timestamp: "2026-01-23" },
      { reps: 28, timestamp: "2026-01-24" },
    ];

    await fs.writeFile(
      historyFile,
      history.map((h) => JSON.stringify(h)).join("\n")
    );
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should generate centered buttons from history file", async () => {
    const hook = createDynamicButtons({
      historyFile,
      variable: "reps",
      strategy: "centered",
      buttonCount: 5,
      step: 5,
    });

    const step: FlowStep = {
      id: "set1",
      message: "How many reps?",
      capture: "reps",
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

    const modifiedStep = await hook(step, session);

    expect(modifiedStep.buttons).toBeDefined();
    expect(modifiedStep.buttons).toHaveLength(5);

    // Average of [20, 22, 24, 26, 28] is 24
    // Centered buttons with step 5: [14, 19, 24, 29, 34]
    const values = modifiedStep.buttons?.map((b) =>
      typeof b === "object" && "value" in b ? b.value : b
    );
    expect(values).toEqual([14, 19, 24, 29, 34]);
  });

  it("should generate progressive buttons", async () => {
    const hook = createDynamicButtons({
      historyFile,
      variable: "reps",
      strategy: "progressive",
      buttonCount: 5,
      step: 2,
    });

    const step: FlowStep = {
      id: "set1",
      message: "How many reps?",
      capture: "reps",
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

    const modifiedStep = await hook(step, session);

    // Average is 24, progressive: [24, 26, 28, 30, 32]
    const values = modifiedStep.buttons?.map((b) =>
      typeof b === "object" && "value" in b ? b.value : b
    );
    expect(values).toEqual([24, 26, 28, 30, 32]);
  });

  it("should not modify step if variable doesn't match", async () => {
    const hook = createDynamicButtons({
      historyFile,
      variable: "weight",
      strategy: "centered",
    });

    const step: FlowStep = {
      id: "set1",
      message: "How many reps?",
      capture: "reps",
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

    const modifiedStep = await hook(step, session);

    // Step should be unchanged
    expect(modifiedStep).toEqual(step);
  });

  it("should return unchanged step if no history exists", async () => {
    const hook = createDynamicButtons({
      historyFile: path.join(testDir, "nonexistent.jsonl"),
      variable: "reps",
      strategy: "centered",
    });

    const step: FlowStep = {
      id: "set1",
      message: "How many reps?",
      capture: "reps",
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

    const modifiedStep = await hook(step, session);

    // Step should be unchanged (no history available)
    expect(modifiedStep).toEqual(step);
  });

  it("should handle tilde expansion in file path", async () => {
    const hook = createDynamicButtons({
      historyFile: `~/${path.relative(os.homedir(), historyFile)}`,
      variable: "reps",
      strategy: "centered",
    });

    const step: FlowStep = {
      id: "set1",
      message: "How many reps?",
      capture: "reps",
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

    const modifiedStep = await hook(step, session);

    expect(modifiedStep.buttons).toBeDefined();
    expect(modifiedStep.buttons).toHaveLength(5);
  });

  it("should handle malformed JSONL gracefully", async () => {
    // Write malformed JSONL
    await fs.writeFile(
      historyFile,
      '{"reps": 20}\ninvalid json\n{"reps": 22}'
    );

    const hook = createDynamicButtons({
      historyFile,
      variable: "reps",
      strategy: "centered",
    });

    const step: FlowStep = {
      id: "set1",
      message: "How many reps?",
      capture: "reps",
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

    // Should not throw, should parse valid lines
    const modifiedStep = await hook(step, session);

    // Should have generated buttons from the 2 valid entries
    expect(modifiedStep.buttons).toBeDefined();
  });
});
