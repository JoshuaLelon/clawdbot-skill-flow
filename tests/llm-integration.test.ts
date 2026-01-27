/**
 * Tests for LLM integration (flow generation and adaptive hooks)
 */

import { describe, it, expect } from "vitest";
import { parseJSONResponse } from "../src/llm/runner.js";
import {
  getFlowGenerationSystemPrompt,
  buildFlowGenerationPrompt,
  getStepAdaptationSystemPrompt,
  buildStepAdaptationPrompt,
  validateFlowGenerationResponse,
  validateStepAdaptationResponse,
} from "../src/llm/prompts.js";
import type { FlowMetadata, FlowStep, FlowSession } from "../src/types.js";

describe("parseJSONResponse", () => {
  it("should parse plain JSON", () => {
    const json = '{"name": "test", "value": 123}';
    const result = parseJSONResponse(json);
    expect(result).toEqual({ name: "test", value: 123 });
  });

  it("should parse JSON with markdown code blocks", () => {
    const json = '```json\n{"name": "test", "value": 123}\n```';
    const result = parseJSONResponse(json);
    expect(result).toEqual({ name: "test", value: 123 });
  });

  it("should parse JSON with code block without language", () => {
    const json = '```\n{"name": "test", "value": 123}\n```';
    const result = parseJSONResponse(json);
    expect(result).toEqual({ name: "test", value: 123 });
  });

  it("should throw on invalid JSON", () => {
    expect(() => parseJSONResponse("not json")).toThrow();
  });
});

describe("Flow Generation Prompts", () => {
  it("should create system prompt", () => {
    const prompt = getFlowGenerationSystemPrompt();
    expect(prompt).toContain("conversational workflows");
    expect(prompt).toContain("schema");
    expect(prompt).toContain("JSON");
  });

  it("should build user prompt with request only", () => {
    const prompt = buildFlowGenerationPrompt("Create a mood tracker");
    expect(prompt).toContain("Create a mood tracker");
    expect(prompt).toContain("Generate a complete");
  });

  it("should include examples in prompt", () => {
    const examples: FlowMetadata[] = [
      {
        name: "example",
        description: "Example flow",
        version: "1.0.0",
        steps: [
          {
            id: "step1",
            message: "Test",
          },
        ],
      },
    ];
    const prompt = buildFlowGenerationPrompt("Create a flow", examples);
    expect(prompt).toContain("example");
    expect(prompt).toContain("Example flow");
  });

  it("should include context in prompt", () => {
    const prompt = buildFlowGenerationPrompt(
      "Create a flow",
      [],
      "User has completed 5 workouts"
    );
    expect(prompt).toContain("Context:");
    expect(prompt).toContain("5 workouts");
  });
});

describe("Flow Generation Validation", () => {
  it("should validate valid flow", () => {
    const flow = {
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
    const result = validateFlowGenerationResponse(flow);
    expect(result.valid).toBe(true);
  });

  it("should reject non-object", () => {
    const result = validateFlowGenerationResponse("not an object");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not an object");
  });

  it("should reject flow without name", () => {
    const flow = {
      description: "Test",
      version: "1.0.0",
      steps: [],
    };
    const result = validateFlowGenerationResponse(flow);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("name");
  });

  it("should reject flow without description", () => {
    const flow = {
      name: "test",
      version: "1.0.0",
      steps: [],
    };
    const result = validateFlowGenerationResponse(flow);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("description");
  });

  it("should reject flow without version", () => {
    const flow = {
      name: "test",
      description: "Test",
      steps: [],
    };
    const result = validateFlowGenerationResponse(flow);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("version");
  });

  it("should reject flow without steps", () => {
    const flow = {
      name: "test",
      description: "Test",
      version: "1.0.0",
    };
    const result = validateFlowGenerationResponse(flow);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("steps");
  });

  it("should reject flow with empty steps", () => {
    const flow = {
      name: "test",
      description: "Test",
      version: "1.0.0",
      steps: [],
    };
    const result = validateFlowGenerationResponse(flow);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("steps");
  });

  it("should reject step without id", () => {
    const flow = {
      name: "test",
      description: "Test",
      version: "1.0.0",
      steps: [{ message: "Hello" }],
    };
    const result = validateFlowGenerationResponse(flow);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("id");
  });

  it("should reject step without message", () => {
    const flow = {
      name: "test",
      description: "Test",
      version: "1.0.0",
      steps: [{ id: "step1" }],
    };
    const result = validateFlowGenerationResponse(flow);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("message");
  });
});

describe("Step Adaptation Prompts", () => {
  it("should create system prompt", () => {
    const prompt = getStepAdaptationSystemPrompt();
    expect(prompt).toContain("adapting");
    expect(prompt).toContain("conversational");
    expect(prompt).toContain("JSON");
  });

  it("should build user prompt for step", () => {
    const step: FlowStep = {
      id: "step1",
      message: "How are you?",
    };
    const session: FlowSession = {
      flowName: "test",
      currentStepId: "step1",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    const prompt = buildStepAdaptationPrompt(step, session, {});
    expect(prompt).toContain("step1");
    expect(prompt).toContain("How are you?");
  });

  it("should include buttons in prompt", () => {
    const step: FlowStep = {
      id: "step1",
      message: "Choose",
      buttons: ["Yes", "No"],
    };
    const session: FlowSession = {
      flowName: "test",
      currentStepId: "step1",
      senderId: "user123",
      channel: "telegram",
      variables: {},
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    const prompt = buildStepAdaptationPrompt(step, session, {
      adaptButtons: true,
    });
    expect(prompt).toContain("Buttons");
    expect(prompt).toContain("Yes");
  });

  it("should include variables when requested", () => {
    const step: FlowStep = {
      id: "step2",
      message: "Next question",
    };
    const session: FlowSession = {
      flowName: "test",
      currentStepId: "step2",
      senderId: "user123",
      channel: "telegram",
      variables: { name: "Alice", age: 25 },
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
    };
    const prompt = buildStepAdaptationPrompt(step, session, {
      includeVariables: true,
    });
    expect(prompt).toContain("Variables captured");
    expect(prompt).toContain("Alice");
    expect(prompt).toContain("25");
  });
});

describe("Step Adaptation Validation", () => {
  it("should validate valid adaptation", () => {
    const response = {
      message: "Adapted message",
    };
    const result = validateStepAdaptationResponse(response);
    expect(result.valid).toBe(true);
    expect(result.message).toBe("Adapted message");
  });

  it("should validate adaptation with buttons", () => {
    const response = {
      message: "Adapted message",
      buttons: ["Label 1", "Label 2"],
    };
    const result = validateStepAdaptationResponse(response);
    expect(result.valid).toBe(true);
    expect(result.message).toBe("Adapted message");
    expect(result.buttons).toEqual(["Label 1", "Label 2"]);
  });

  it("should reject non-object", () => {
    const result = validateStepAdaptationResponse("not an object");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not an object");
  });

  it("should reject response without message", () => {
    const response = {
      buttons: ["Yes", "No"],
    };
    const result = validateStepAdaptationResponse(response);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("message");
  });

  it("should reject response with non-array buttons", () => {
    const response = {
      message: "Test",
      buttons: "not an array",
    };
    const result = validateStepAdaptationResponse(response);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("array");
  });

  it("should reject response with non-string button labels", () => {
    const response = {
      message: "Test",
      buttons: ["Yes", 123, "No"],
    };
    const result = validateStepAdaptationResponse(response);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("strings");
  });
});

describe("LLM Adapter Hook", () => {
  // Note: Full integration tests with mocked runEmbeddedPiAgent would go here
  // These would require more complex mocking of the ClawdbotPluginApi
  // For now, we test the validation and prompt generation logic above

  it("should be tested with mocked LLM calls", () => {
    // Placeholder for integration tests
    // Would mock api.runtime.system.resolveMainPath and runEmbeddedPiAgent
    expect(true).toBe(true);
  });
});
