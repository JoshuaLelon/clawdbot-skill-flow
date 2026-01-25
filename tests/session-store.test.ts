/**
 * Session store tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getSessionKey,
  clearAllSessions,
} from "../src/state/session-store";

describe("session-store", () => {
  beforeEach(() => {
    clearAllSessions();
  });

  afterEach(() => {
    clearAllSessions();
  });

  describe("getSessionKey", () => {
    it("should generate correct session key", () => {
      const key = getSessionKey("user123", "test-flow");
      expect(key).toBe("user123-test-flow");
    });
  });

  describe("createSession", () => {
    it("should create a new session", () => {
      const session = createSession({
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user123",
        channel: "telegram",
      });

      expect(session.flowName).toBe("test-flow");
      expect(session.currentStepId).toBe("step1");
      expect(session.senderId).toBe("user123");
      expect(session.channel).toBe("telegram");
      expect(session.variables).toEqual({});
      expect(session.startedAt).toBeGreaterThan(0);
      expect(session.lastActivityAt).toBeGreaterThan(0);
    });
  });

  describe("getSession", () => {
    it("should retrieve existing session", () => {
      createSession({
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user123",
        channel: "telegram",
      });

      const key = getSessionKey("user123", "test-flow");
      const session = getSession(key);

      expect(session).not.toBeNull();
      expect(session?.flowName).toBe("test-flow");
    });

    it("should return null for non-existent session", () => {
      const session = getSession("nonexistent-key");
      expect(session).toBeNull();
    });

    it("should return null for expired session", () => {
      // Create session with very old timestamp
      createSession({
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user123",
        channel: "telegram",
      });

      const key = getSessionKey("user123", "test-flow");
      const session = getSession(key);

      if (session) {
        // Manually set old timestamp
        session.lastActivityAt = Date.now() - 31 * 60 * 1000; // 31 minutes ago

        // Try to get again - should be expired
        const expiredSession = getSession(key);
        expect(expiredSession).toBeNull();
      }
    });
  });

  describe("updateSession", () => {
    it("should update session", () => {
      createSession({
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user123",
        channel: "telegram",
      });

      const key = getSessionKey("user123", "test-flow");

      const updated = updateSession(key, {
        currentStepId: "step2",
        variables: { name: "John" },
      });

      expect(updated).not.toBeNull();
      expect(updated?.currentStepId).toBe("step2");
      expect(updated?.variables.name).toBe("John");
    });

    it("should merge variables", () => {
      createSession({
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user123",
        channel: "telegram",
      });

      const key = getSessionKey("user123", "test-flow");

      updateSession(key, { variables: { name: "John" } });
      const updated = updateSession(key, { variables: { age: 25 } });

      expect(updated?.variables).toEqual({ name: "John", age: 25 });
    });

    it("should return null for non-existent session", () => {
      const updated = updateSession("nonexistent", {
        currentStepId: "step2",
      });
      expect(updated).toBeNull();
    });
  });

  describe("deleteSession", () => {
    it("should delete session", () => {
      createSession({
        flowName: "test-flow",
        currentStepId: "step1",
        senderId: "user123",
        channel: "telegram",
      });

      const key = getSessionKey("user123", "test-flow");

      deleteSession(key);

      const session = getSession(key);
      expect(session).toBeNull();
    });
  });
});
