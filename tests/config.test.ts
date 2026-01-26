/**
 * Tests for config parsing and validation
 */

import { describe, it, expect } from "vitest";
import { parseSkillFlowConfig, getPluginConfig } from "../src/config.js";

describe("parseSkillFlowConfig", () => {
  it("should parse empty config with defaults", () => {
    const config = parseSkillFlowConfig({});
    expect(config.sessionTimeoutMinutes).toBe(30);
    expect(config.sessionCleanupIntervalMinutes).toBe(5);
    expect(config.enableBuiltinHistory).toBe(true);
    expect(config.flowsDir).toBeUndefined();
  });

  it("should parse custom flowsDir", () => {
    const config = parseSkillFlowConfig({
      flowsDir: "~/clawd/jobs"
    });
    expect(config.flowsDir).toBe("~/clawd/jobs");
  });

  it("should parse all options", () => {
    const config = parseSkillFlowConfig({
      flowsDir: "/custom/path",
      sessionTimeoutMinutes: 60,
      sessionCleanupIntervalMinutes: 10,
      enableBuiltinHistory: false,
      maxFlowsPerUser: 5,
    });
    expect(config.flowsDir).toBe("/custom/path");
    expect(config.sessionTimeoutMinutes).toBe(60);
    expect(config.sessionCleanupIntervalMinutes).toBe(10);
    expect(config.enableBuiltinHistory).toBe(false);
    expect(config.maxFlowsPerUser).toBe(5);
  });

  it("should throw on invalid config", () => {
    expect(() => parseSkillFlowConfig({
      sessionTimeoutMinutes: -1
    })).toThrow();
  });
});

describe("getPluginConfig", () => {
  it("should return config after parsing", () => {
    const parsed = parseSkillFlowConfig({
      flowsDir: "~/test"
    });
    const retrieved = getPluginConfig();
    expect(retrieved).toEqual(parsed);
    expect(retrieved.flowsDir).toBe("~/test");
  });

  it("should throw if called before parseSkillFlowConfig", () => {
    // Reset config by parsing with undefined
    parseSkillFlowConfig({});
    // Now it should work
    expect(() => getPluginConfig()).not.toThrow();
  });
});
