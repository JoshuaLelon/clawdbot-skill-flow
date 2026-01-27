/**
 * Tests for conditional action execution
 */

import { describe, it, expect } from "vitest";
import { shouldExecuteAction } from "../src/engine/executor.js";
import type { FlowSession, ConditionalAction } from "../src/types.js";

describe("Conditional Action Execution", () => {
  const mockSession: FlowSession = {
    flowName: "test-flow",
    currentStepId: "step1",
    senderId: "user1",
    channel: "test",
    variables: {
      enabled: "true",
      count: 5,
      emptyString: "",
      zero: 0,
      apiKey: "secret-123",
    },
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  describe("shouldExecuteAction", () => {
    describe("Actions Without Conditions (Always Execute)", () => {
      it("should always execute actions without if field", () => {
        const action: ConditionalAction = {
          action: "myAction",
        };
        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(true);
        expect(result.actionName).toBe("myAction");
      });

      it("should return correct action name", () => {
        const action: ConditionalAction = {
          action: "logToSheets",
        };
        const result = shouldExecuteAction(action, mockSession);

        expect(result.actionName).toBe("logToSheets");
      });
    });

    describe("Conditional Actions with Truthy Values", () => {
      it("should execute when condition variable is truthy string", () => {
        const action: ConditionalAction = {
          action: "myAction",
          if: "enabled",
        };

        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(true);
        expect(result.actionName).toBe("myAction");
      });

      it("should execute when condition variable is non-zero number", () => {
        const action: ConditionalAction = {
          action: "myAction",
          if: "count",
        };

        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(true);
        expect(result.actionName).toBe("myAction");
      });

      it("should execute when condition variable is non-empty string", () => {
        const action: ConditionalAction = {
          action: "sendNotification",
          if: "apiKey",
        };

        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(true);
        expect(result.actionName).toBe("sendNotification");
      });
    });

    describe("Conditional Actions with Falsy Values", () => {
      it("should not execute when condition variable is empty string", () => {
        const action: ConditionalAction = {
          action: "myAction",
          if: "emptyString",
        };

        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(false);
        expect(result.actionName).toBe("myAction");
      });

      it("should not execute when condition variable is zero", () => {
        const action: ConditionalAction = {
          action: "myAction",
          if: "zero",
        };

        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(false);
        expect(result.actionName).toBe("myAction");
      });

      it("should not execute when condition variable is undefined", () => {
        const action: ConditionalAction = {
          action: "myAction",
          if: "nonExistentVar",
        };

        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(false);
        expect(result.actionName).toBe("myAction");
      });
    });

    describe("Conditional Actions without Condition", () => {
      it("should execute when no condition specified", () => {
        const action: ConditionalAction = {
          action: "alwaysRun",
        };

        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(true);
        expect(result.actionName).toBe("alwaysRun");
      });

      it("should execute when if field is undefined", () => {
        const action: ConditionalAction = {
          action: "myAction",
          if: undefined,
        };

        const result = shouldExecuteAction(action, mockSession);

        expect(result.execute).toBe(true);
        expect(result.actionName).toBe("myAction");
      });
    });
  });

  describe("Action Type Integration", () => {
    describe("Fetch Actions", () => {
      it("should support conditional fetch actions in flow schema", () => {
        const fetchActions = {
          data1: { action: "alwaysRun" },
          data2: { action: "conditionalRun", if: "apiKey" },
        };

        // Test always execute action
        const result1 = shouldExecuteAction(fetchActions.data1, mockSession);
        expect(result1.execute).toBe(true);

        // Test conditional action
        const result2 = shouldExecuteAction(fetchActions.data2, mockSession);
        expect(result2.execute).toBe(true);
      });

      it("should skip fetch action when condition not met", () => {
        const fetchAction = {
          action: "getFromSheets",
          if: "spreadsheetId",
        };

        const result = shouldExecuteAction(fetchAction, mockSession);
        expect(result.execute).toBe(false);
      });
    });

    describe("BeforeRender Actions", () => {
      it("should support conditional beforeRender actions", () => {
        const beforeRenderActions = [
          { action: "alwaysRun" },
          { action: "addMotivation", if: "enabled" },
        ];

        const result1 = shouldExecuteAction(
          beforeRenderActions[0]!,
          mockSession
        );
        expect(result1.execute).toBe(true);

        const result2 = shouldExecuteAction(
          beforeRenderActions[1]!,
          mockSession
        );
        expect(result2.execute).toBe(true);
      });

      it("should skip beforeRender action when condition not met", () => {
        const action = { action: "addBanner", if: "bannerEnabled" };

        const result = shouldExecuteAction(action, mockSession);
        expect(result.execute).toBe(false);
      });
    });

    describe("AfterCapture Actions", () => {
      it("should support conditional afterCapture actions", () => {
        const afterCaptureActions = [
          { action: "logToSheets", if: "apiKey" },
          { action: "sendSlack", if: "slackWebhook" },
        ];

        const result1 = shouldExecuteAction(
          afterCaptureActions[0]!,
          mockSession
        );
        expect(result1.execute).toBe(true); // apiKey exists

        const result2 = shouldExecuteAction(
          afterCaptureActions[1]!,
          mockSession
        );
        expect(result2.execute).toBe(false); // slackWebhook doesn't exist
      });
    });
  });

  describe("Real-World Use Cases", () => {
    it("should handle optional integrations", () => {
      const session: FlowSession = {
        ...mockSession,
        variables: {
          spreadsheetId: "1a2b3c",
          slackWebhook: "", // Not configured
        },
      };

      const actions = [
        { action: "logToSheets", if: "spreadsheetId" },
        { action: "sendSlackNotification", if: "slackWebhook" },
      ];

      const result1 = shouldExecuteAction(actions[0]!, session);
      expect(result1.execute).toBe(true); // Sheets configured

      const result2 = shouldExecuteAction(actions[1]!, session);
      expect(result2.execute).toBe(false); // Slack not configured
    });

    it("should handle feature flags", () => {
      const session: FlowSession = {
        ...mockSession,
        variables: {
          experimentEnabled: "true",
          betaEnabled: "",
        },
      };

      const actions = [
        { action: "runExperiment", if: "experimentEnabled" },
        { action: "showBetaFeature", if: "betaEnabled" },
      ];

      const result1 = shouldExecuteAction(actions[0]!, session);
      expect(result1.execute).toBe(true);

      const result2 = shouldExecuteAction(actions[1]!, session);
      expect(result2.execute).toBe(false);
    });

    it("should handle environment-based configuration", () => {
      const prodSession: FlowSession = {
        ...mockSession,
        variables: {
          production: "true",
          debugMode: "",
        },
      };

      const devSession: FlowSession = {
        ...mockSession,
        variables: {
          production: "",
          debugMode: "true",
        },
      };

      const prodAction = { action: "logToProduction", if: "production" };
      const debugAction = { action: "enableDebugLogs", if: "debugMode" };

      // Production
      expect(shouldExecuteAction(prodAction, prodSession).execute).toBe(true);
      expect(shouldExecuteAction(debugAction, prodSession).execute).toBe(
        false
      );

      // Development
      expect(shouldExecuteAction(prodAction, devSession).execute).toBe(false);
      expect(shouldExecuteAction(debugAction, devSession).execute).toBe(true);
    });

    it("should handle A/B testing", () => {
      const variantASession: FlowSession = {
        ...mockSession,
        variables: {
          variantA: "true",
          variantB: "",
        },
      };

      const variantBSession: FlowSession = {
        ...mockSession,
        variables: {
          variantA: "",
          variantB: "true",
        },
      };

      const variantAAction = { action: "showVariantA", if: "variantA" };
      const variantBAction = { action: "showVariantB", if: "variantB" };

      // Variant A
      expect(shouldExecuteAction(variantAAction, variantASession).execute).toBe(
        true
      );
      expect(shouldExecuteAction(variantBAction, variantASession).execute).toBe(
        false
      );

      // Variant B
      expect(shouldExecuteAction(variantAAction, variantBSession).execute).toBe(
        false
      );
      expect(shouldExecuteAction(variantBAction, variantBSession).execute).toBe(
        true
      );
    });

    it("should support progressive rollout", () => {
      const enabledSession: FlowSession = {
        ...mockSession,
        variables: { rolloutPercentage: 50 }, // Non-zero = enabled
      };

      const disabledSession: FlowSession = {
        ...mockSession,
        variables: { rolloutPercentage: 0 }, // Zero = disabled
      };

      const action = { action: "newFeature", if: "rolloutPercentage" };

      expect(shouldExecuteAction(action, enabledSession).execute).toBe(true);
      expect(shouldExecuteAction(action, disabledSession).execute).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle session with no variables", () => {
      const emptySession: FlowSession = {
        ...mockSession,
        variables: {},
      };

      const action = { action: "myAction", if: "someVar" };
      const result = shouldExecuteAction(action, emptySession);

      expect(result.execute).toBe(false);
    });

    it("should handle action names with special characters", () => {
      const action = { action: "my-special_action.v2", if: "enabled" };
      const result = shouldExecuteAction(action, mockSession);

      expect(result.actionName).toBe("my-special_action.v2");
    });

    it("should handle very long action names", () => {
      const longName = "a".repeat(500);
      const action = { action: longName, if: "enabled" };
      const result = shouldExecuteAction(action, mockSession);

      expect(result.actionName).toBe(longName);
      expect(result.execute).toBe(true);
    });

    it("should handle unicode in variable names", () => {
      const session: FlowSession = {
        ...mockSession,
        variables: {
          "配置": "value",
        },
      };

      const action = { action: "myAction", if: "配置" };
      const result = shouldExecuteAction(action, session);

      expect(result.execute).toBe(true);
    });
  });
});
