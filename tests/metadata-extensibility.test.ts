/**
 * Tests for extensible metadata schema
 */

import { describe, it, expect } from "vitest";
import { FlowMetadataSchema } from "../src/validation.js";

describe("FlowMetadata extensibility", () => {
  it("should allow extra fields beyond core schema", () => {
    const metadata = {
      name: "pushups",
      description: "Pushup tracking",
      version: "1.0.0",
      steps: [
        {
          id: "start",
          message: "How many pushups?",
          capture: "reps",
        },
      ],
      // Extra field for job config
      job: {
        goal: { target: 100, baseline: 30, metric: "max pushups" },
        schedule: { days: ["mon", "wed", "fri"], time: "08:00" },
        drive: { folderId: "abc123", sheetId: "xyz789" },
      },
    };

    const parsed = FlowMetadataSchema.parse(metadata);

    // Core fields should be present
    expect(parsed.name).toBe("pushups");
    expect(parsed.description).toBe("Pushup tracking");
    expect(parsed.steps).toHaveLength(1);

    // Extra field should be preserved
    expect(parsed.job).toBeDefined();
    expect(parsed.job).toEqual({
      goal: { target: 100, baseline: 30, metric: "max pushups" },
      schedule: { days: ["mon", "wed", "fri"], time: "08:00" },
      drive: { folderId: "abc123", sheetId: "xyz789" },
    });
  });

  it("should still validate required core fields", () => {
    const invalid = {
      // Missing required 'name' field
      description: "Test",
      version: "1.0.0",
      steps: [],
    };

    expect(() => FlowMetadataSchema.parse(invalid)).toThrow();
  });

  it("should validate steps array is not empty", () => {
    const invalid = {
      name: "test",
      description: "Test",
      version: "1.0.0",
      steps: [], // Empty array not allowed
    };

    expect(() => FlowMetadataSchema.parse(invalid)).toThrow();
  });

  it("should allow arbitrary extra fields", () => {
    const metadata = {
      name: "test",
      description: "Test flow",
      version: "1.0.0",
      steps: [{ id: "step1", message: "Test" }],
      customField1: "value1",
      customField2: { nested: "object" },
      customField3: [1, 2, 3],
    };

    const parsed = FlowMetadataSchema.parse(metadata);

    expect(parsed.customField1).toBe("value1");
    expect(parsed.customField2).toEqual({ nested: "object" });
    expect(parsed.customField3).toEqual([1, 2, 3]);
  });
});
