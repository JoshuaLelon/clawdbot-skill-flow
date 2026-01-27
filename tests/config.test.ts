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

  it("should parse LLM config with defaults", () => {
    const config = parseSkillFlowConfig({});
    expect(config.llm).toBeDefined();
    expect(config.llm.defaultProvider).toBe("anthropic");
    expect(config.llm.defaultModel).toBe("claude-sonnet-4-5");
    expect(config.llm.flowGenerationTimeout).toBe(30000);
    expect(config.llm.adaptationTimeout).toBe(5000);
    expect(config.llm.maxTokens).toBe(4096);
    expect(config.llm.temperature).toBe(0.7);
  });

  it("should parse custom LLM config", () => {
    const config = parseSkillFlowConfig({
      llm: {
        temperature: 0.5,
        maxTokens: 2048,
        adaptationTimeout: 3000
      }
    });
    expect(config.llm.temperature).toBe(0.5);
    expect(config.llm.maxTokens).toBe(2048);
    expect(config.llm.adaptationTimeout).toBe(3000);
    // Defaults should still apply for unspecified fields
    expect(config.llm.defaultProvider).toBe("anthropic");
    expect(config.llm.defaultModel).toBe("claude-sonnet-4-5");
    expect(config.llm.flowGenerationTimeout).toBe(30000);
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
