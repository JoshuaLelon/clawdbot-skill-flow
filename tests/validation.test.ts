/**
 * Validation tests
 */

import { describe, it, expect } from "vitest";
import {
  FlowMetadataSchema,
  normalizeButton,
  validateInput,
} from "../src/validation";

describe("FlowMetadataSchema", () => {
  it("should validate a valid flow", () => {
    const flow = {
      name: "test-flow",
      description: "Test flow",
      version: "1.0.0",
      steps: [
        {
          id: "step1",
          message: "Test message",
        },
      ],
    };

    expect(() => FlowMetadataSchema.parse(flow)).not.toThrow();
  });

  it("should reject flow with no steps", () => {
    const flow = {
      name: "test-flow",
      description: "Test flow",
      version: "1.0.0",
      steps: [],
    };

    expect(() => FlowMetadataSchema.parse(flow)).toThrow();
  });

  it("should reject flow missing required fields", () => {
    const flow = {
      name: "test-flow",
      steps: [{ id: "step1", message: "Test" }],
    };

    expect(() => FlowMetadataSchema.parse(flow)).toThrow();
  });
});

describe("normalizeButton", () => {
  it("should normalize string button", () => {
    const result = normalizeButton("Click me", 0);
    expect(result).toEqual({
      text: "Click me",
      value: "Click me",
    });
  });

  it("should normalize number button", () => {
    const result = normalizeButton(42, 0);
    expect(result).toEqual({
      text: "42",
      value: 42,
    });
  });

  it("should pass through object button", () => {
    const button = {
      text: "Yes",
      value: "yes",
      next: "confirm",
    };
    const result = normalizeButton(button, 0);
    expect(result).toEqual(button);
  });
});

describe("validateInput", () => {
  describe("number validation", () => {
    it("should accept valid numbers", () => {
      expect(validateInput("42", "number")).toEqual({ valid: true });
      expect(validateInput("3.14", "number")).toEqual({ valid: true });
      expect(validateInput("-10", "number")).toEqual({ valid: true });
    });

    it("should reject invalid numbers", () => {
      const result = validateInput("abc", "number");
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("email validation", () => {
    it("should accept valid emails", () => {
      expect(validateInput("user@example.com", "email")).toEqual({
        valid: true,
      });
      expect(validateInput("test.user@domain.co.uk", "email")).toEqual({
        valid: true,
      });
    });

    it("should reject invalid emails", () => {
      const result = validateInput("not-an-email", "email");
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("phone validation", () => {
    it("should accept valid phone numbers", () => {
      expect(validateInput("+1234567890", "phone")).toEqual({
        valid: true,
      });
      expect(validateInput("(123) 456-7890", "phone")).toEqual({
        valid: true,
      });
    });

    it("should reject invalid phone numbers", () => {
      const result = validateInput("123", "phone");
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
