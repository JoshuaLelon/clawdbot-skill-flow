/**
 * Tests for flow-level environment variables
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FlowMetadata, FlowSession } from "../src/types.js";

describe("Environment Variables", () => {
  // Store original env vars
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save original env vars
    originalEnv.TEST_VAR_1 = process.env.TEST_VAR_1;
    originalEnv.TEST_VAR_2 = process.env.TEST_VAR_2;
    originalEnv.TEST_API_KEY = process.env.TEST_API_KEY;

    // Set test env vars
    process.env.TEST_VAR_1 = "value1";
    process.env.TEST_VAR_2 = "value2";
    process.env.TEST_API_KEY = "secret-key-123";
  });

  afterEach(() => {
    // Restore original env vars
    if (originalEnv.TEST_VAR_1 === undefined) {
      delete process.env.TEST_VAR_1;
    } else {
      process.env.TEST_VAR_1 = originalEnv.TEST_VAR_1;
    }

    if (originalEnv.TEST_VAR_2 === undefined) {
      delete process.env.TEST_VAR_2;
    } else {
      process.env.TEST_VAR_2 = originalEnv.TEST_VAR_2;
    }

    if (originalEnv.TEST_API_KEY === undefined) {
      delete process.env.TEST_API_KEY;
    } else {
      process.env.TEST_API_KEY = originalEnv.TEST_API_KEY;
    }
  });

  describe("Flow Metadata Schema", () => {
    it("should accept flow with env field", () => {
      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test flow",
        version: "1.0.0",
        env: {
          apiKey: "TEST_API_KEY",
          configId: "TEST_VAR_1",
        },
        steps: [
          {
            id: "step1",
            message: "Hello",
          },
        ],
      };

      expect(flow.env).toBeDefined();
      expect(flow.env?.apiKey).toBe("TEST_API_KEY");
    });

    it("should accept flow without env field", () => {
      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test flow",
        version: "1.0.0",
        steps: [
          {
            id: "step1",
            message: "Hello",
          },
        ],
      };

      expect(flow.env).toBeUndefined();
    });

    it("should accept empty env object", () => {
      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test flow",
        version: "1.0.0",
        env: {},
        steps: [
          {
            id: "step1",
            message: "Hello",
          },
        ],
      };

      expect(flow.env).toEqual({});
    });
  });

  describe("Environment Variable Injection", () => {
    it("should inject single env var into session", () => {
      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test",
        version: "1.0.0",
        env: {
          myVar: "TEST_VAR_1",
        },
        steps: [{ id: "step1", message: "Test" }],
      };

      const session: FlowSession = {
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user1",
        channel: "test",
        variables: {},
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      // Simulate env injection (as would happen in executor.ts)
      const resolvedEnv: Record<string, string | number> = {};
      if (flow.env) {
        for (const [varName, envKey] of Object.entries(flow.env)) {
          const value = process.env[envKey];
          if (value !== undefined) {
            resolvedEnv[varName] = value;
          }
        }
      }

      const updatedSession = {
        ...session,
        variables: {
          ...session.variables,
          ...resolvedEnv,
        },
      };

      expect(updatedSession.variables.myVar).toBe("value1");
    });

    it("should inject multiple env vars into session", () => {
      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test",
        version: "1.0.0",
        env: {
          var1: "TEST_VAR_1",
          var2: "TEST_VAR_2",
          apiKey: "TEST_API_KEY",
        },
        steps: [{ id: "step1", message: "Test" }],
      };

      const session: FlowSession = {
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user1",
        channel: "test",
        variables: {},
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      // Simulate env injection
      const resolvedEnv: Record<string, string | number> = {};
      if (flow.env) {
        for (const [varName, envKey] of Object.entries(flow.env)) {
          const value = process.env[envKey];
          if (value !== undefined) {
            resolvedEnv[varName] = value;
          }
        }
      }

      const updatedSession = {
        ...session,
        variables: {
          ...session.variables,
          ...resolvedEnv,
        },
      };

      expect(updatedSession.variables.var1).toBe("value1");
      expect(updatedSession.variables.var2).toBe("value2");
      expect(updatedSession.variables.apiKey).toBe("secret-key-123");
    });

    it("should not inject missing env vars", () => {
      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test",
        version: "1.0.0",
        env: {
          existingVar: "TEST_VAR_1",
          missingVar: "DOES_NOT_EXIST",
        },
        steps: [{ id: "step1", message: "Test" }],
      };

      const session: FlowSession = {
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user1",
        channel: "test",
        variables: {},
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      // Simulate env injection with missing var handling
      const resolvedEnv: Record<string, string | number> = {};
      const missingVars: string[] = [];

      if (flow.env) {
        for (const [varName, envKey] of Object.entries(flow.env)) {
          const value = process.env[envKey];
          if (value !== undefined) {
            resolvedEnv[varName] = value;
          } else {
            missingVars.push(envKey);
          }
        }
      }

      const updatedSession = {
        ...session,
        variables: {
          ...session.variables,
          ...resolvedEnv,
        },
      };

      expect(updatedSession.variables.existingVar).toBe("value1");
      expect(updatedSession.variables.missingVar).toBeUndefined();
      expect(missingVars).toContain("DOES_NOT_EXIST");
    });

    it("should preserve existing session variables", () => {
      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test",
        version: "1.0.0",
        env: {
          apiKey: "TEST_API_KEY",
        },
        steps: [{ id: "step1", message: "Test" }],
      };

      const session: FlowSession = {
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user1",
        channel: "test",
        variables: {
          existingVar: "existing-value",
          userInput: 42,
        },
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      // Simulate env injection
      const resolvedEnv: Record<string, string | number> = {};
      if (flow.env) {
        for (const [varName, envKey] of Object.entries(flow.env)) {
          const value = process.env[envKey];
          if (value !== undefined) {
            resolvedEnv[varName] = value;
          }
        }
      }

      const updatedSession = {
        ...session,
        variables: {
          ...session.variables,
          ...resolvedEnv,
        },
      };

      expect(updatedSession.variables.existingVar).toBe("existing-value");
      expect(updatedSession.variables.userInput).toBe(42);
      expect(updatedSession.variables.apiKey).toBe("secret-key-123");
    });

    it("should handle empty env config", () => {
      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test",
        version: "1.0.0",
        env: {},
        steps: [{ id: "step1", message: "Test" }],
      };

      const session: FlowSession = {
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user1",
        channel: "test",
        variables: { existing: "value" },
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
      };

      // Simulate env injection
      const resolvedEnv: Record<string, string | number> = {};
      if (flow.env) {
        for (const [varName, envKey] of Object.entries(flow.env)) {
          const value = process.env[envKey];
          if (value !== undefined) {
            resolvedEnv[varName] = value;
          }
        }
      }

      const updatedSession = {
        ...session,
        variables: {
          ...session.variables,
          ...resolvedEnv,
        },
      };

      expect(updatedSession.variables).toEqual({ existing: "value" });
    });
  });

  describe("Use Cases", () => {
    it("should support API key configuration", () => {
      const flow: FlowMetadata = {
        name: "survey",
        description: "Survey with Sheets integration",
        version: "1.0.0",
        env: {
          spreadsheetId: "TEST_VAR_1",
          apiKey: "TEST_API_KEY",
        },
        steps: [{ id: "step1", message: "Test" }],
      };

      const resolvedEnv: Record<string, string | number> = {};
      if (flow.env) {
        for (const [varName, envKey] of Object.entries(flow.env)) {
          const value = process.env[envKey];
          if (value !== undefined) {
            resolvedEnv[varName] = value;
          }
        }
      }

      expect(resolvedEnv.spreadsheetId).toBe("value1");
      expect(resolvedEnv.apiKey).toBe("secret-key-123");
    });

    it("should support feature flags", () => {
      process.env.FEATURE_ENABLED = "true";

      const flow: FlowMetadata = {
        name: "test-flow",
        description: "Test",
        version: "1.0.0",
        env: {
          featureEnabled: "FEATURE_ENABLED",
        },
        steps: [{ id: "step1", message: "Test" }],
      };

      const resolvedEnv: Record<string, string | number> = {};
      if (flow.env) {
        for (const [varName, envKey] of Object.entries(flow.env)) {
          const value = process.env[envKey];
          if (value !== undefined) {
            resolvedEnv[varName] = value;
          }
        }
      }

      expect(resolvedEnv.featureEnabled).toBe("true");

      delete process.env.FEATURE_ENABLED;
    });
  });
});
