/**
 * Tests for dynamic buttons utilities
 */

import { describe, it, expect } from "vitest";
import {
  getRecentAverage,
  generateButtonRange,
} from "../../src/hooks/dynamic-buttons.js";

describe("getRecentAverage", () => {
  it("should calculate average from historical data", async () => {
    const history = [
      { reps: 20 },
      { reps: 22 },
      { reps: 24 },
      { reps: 26 },
      { reps: 28 },
    ];

    const avg = await getRecentAverage("reps", history);
    expect(avg).toBe(24);
  });

  it("should handle string values", async () => {
    const history = [{ reps: "20" }, { reps: "22" }, { reps: "24" }];

    const avg = await getRecentAverage("reps", history);
    expect(avg).toBe(22);
  });

  it("should limit to recent N values", async () => {
    const history = [
      { reps: 10 },
      { reps: 12 },
      { reps: 14 },
      { reps: 20 },
      { reps: 22 },
    ];

    // Only take last 3 values: 14, 20, 22
    const avg = await getRecentAverage("reps", history, 3);
    expect(avg).toBe(19); // (14 + 20 + 22) / 3 = 18.67 rounded to 19
  });

  it("should return null for empty history", async () => {
    const avg = await getRecentAverage("reps", []);
    expect(avg).toBeNull();
  });

  it("should return null for missing variable", async () => {
    const history = [{ other: 20 }, { other: 22 }];

    const avg = await getRecentAverage("reps", history);
    expect(avg).toBeNull();
  });

  it("should filter out invalid values", async () => {
    const history = [
      { reps: 20 },
      { reps: "invalid" },
      { reps: null },
      { reps: 22 },
      { reps: undefined },
      { reps: 24 },
    ];

    const avg = await getRecentAverage("reps", history);
    expect(avg).toBe(22); // (20 + 22 + 24) / 3
  });
});

describe("generateButtonRange", () => {
  describe("centered strategy", () => {
    it("should generate centered buttons (odd count)", () => {
      const buttons = generateButtonRange(20, 5, 5, "centered");
      expect(buttons).toEqual([10, 15, 20, 25, 30]);
    });

    it("should generate centered buttons (even count)", () => {
      const buttons = generateButtonRange(20, 4, 5, "centered");
      expect(buttons).toEqual([10, 15, 20, 25]);
    });

    it("should support minValue to prevent negatives", () => {
      // With minValue=0, negative values are clamped to 0
      const buttons = generateButtonRange(5, 5, 5, "centered", 0);
      expect(buttons).toEqual([0, 0, 5, 10, 15]);
    });

    it("should allow negative values by default", () => {
      // Without minValue, negative values are allowed
      const buttons = generateButtonRange(5, 5, 5, "centered");
      expect(buttons).toEqual([-5, 0, 5, 10, 15]);
    });
  });

  describe("progressive strategy", () => {
    it("should generate increasing values", () => {
      const buttons = generateButtonRange(20, 5, 5, "progressive");
      expect(buttons).toEqual([20, 25, 30, 35, 40]);
    });

    it("should handle smaller steps", () => {
      const buttons = generateButtonRange(20, 5, 2, "progressive");
      expect(buttons).toEqual([20, 22, 24, 26, 28]);
    });

    it("should support minValue to prevent negatives", () => {
      // With minValue=0, values stay at or above 0
      const buttons = generateButtonRange(0, 5, 5, "progressive", 0);
      expect(buttons).toEqual([0, 5, 10, 15, 20]);
    });
  });

  describe("range strategy", () => {
    it("should generate evenly-spaced range", () => {
      const buttons = generateButtonRange(25, 5, 5, "range");
      expect(buttons).toEqual([15, 20, 25, 30, 35]);
    });

    it("should handle different step sizes", () => {
      const buttons = generateButtonRange(50, 5, 10, "range");
      expect(buttons).toEqual([30, 40, 50, 60, 70]);
    });
  });

  it("should throw error for unknown strategy", () => {
    expect(() => {
      // @ts-expect-error - testing invalid strategy
      generateButtonRange(20, 5, 5, "invalid");
    }).toThrow("Unknown button strategy");
  });
});
