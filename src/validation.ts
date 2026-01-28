/**
 * Zod validation schemas for flow definitions
 */

import { z } from "zod";
import type { Button } from "./types.js";

// Validation type enum
const ValidationTypeSchema = z.enum(["number", "email", "phone"]);

// Button schema - can be string, number, or full object
const ButtonValueSchema = z.union([
  z.string(),
  z.number(),
  z.object({
    text: z.string(),
    value: z.union([z.string(), z.number()]),
    next: z.string().optional(),
  }),
]);

// Conditional branching schema
const ConditionSchema = z.object({
  variable: z.string(),
  equals: z.union([z.string(), z.number()]).optional(),
  greaterThan: z.number().optional(),
  lessThan: z.number().optional(),
  contains: z.string().optional(),
  next: z.string(),
});

// Comparison operator enum
const ComparisonOperatorSchema = z.enum([
  "equals",
  "eq",
  "notEquals",
  "ne",
  "greaterThan",
  "gt",
  "greaterThanOrEqual",
  "gte",
  "lessThan",
  "lt",
  "lessThanOrEqual",
  "lte",
  "contains",
  "startsWith",
  "endsWith",
  "matches",
  "in",
  "exists",
]);

// Conditional expression schema (recursive for logical combinators)
const ConditionalExpressionSchema: z.ZodSchema = z.lazy(() =>
  z.object({
    // Simple condition
    variable: z.string().optional(),
    operator: ComparisonOperatorSchema.optional(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    // Logical combinators
    and: z.array(ConditionalExpressionSchema).optional(),
    or: z.array(ConditionalExpressionSchema).optional(),
    not: ConditionalExpressionSchema.optional(),
  })
);

// Declarative action schema
const DeclarativeActionSchema = z.object({
  type: z.string().describe("Action type (e.g., sheets.append)"),
  config: z.record(z.unknown()).describe("Action configuration"),
  if: ConditionalExpressionSchema.optional(),
});

// Step actions schema
const StepActionsSchema = z.object({
  fetch: z.record(DeclarativeActionSchema).optional(),
  beforeRender: z.array(DeclarativeActionSchema).optional(),
  afterCapture: z.array(DeclarativeActionSchema).optional(),
}).optional();

// Flow step schema
const FlowStepSchema = z.object({
  id: z.string(),
  message: z.string(),
  buttons: z.array(ButtonValueSchema).optional(),
  next: z.string().optional(),
  capture: z.string().optional(),
  validate: ValidationTypeSchema.optional(),
  condition: ConditionSchema.optional(),
  actions: StepActionsSchema,
});

// Trigger schema
const TriggerSchema = z
  .object({
    manual: z.boolean().optional(),
    cron: z.string().optional(),
    event: z.string().optional(),
  })
  .optional();

// Storage backend schema
const StorageSchema = z
  .object({
    backend: z.string().optional(),
    builtin: z.boolean().optional(),
  })
  .optional();

// Complete flow metadata schema
// Use .passthrough() to allow extra fields (e.g., job config)
export const FlowMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string().optional(),
  steps: z.array(FlowStepSchema).min(1),
  triggers: TriggerSchema,
  hooks: z.string().optional().describe("DEPRECATED: Path to hooks file (use declarative actions instead)"),
  env: z
    .record(z.string(), z.string())
    .optional()
    .describe("Environment variables to inject into session"),
  actions: z
    .object({
      imports: z.array(z.string()).optional().describe("Custom action packages to import"),
    })
    .optional(),
  storage: StorageSchema,
}).passthrough();

/**
 * Normalize button input to Button object
 */
export function normalizeButton(
  btn: string | number | Button,
  _index: number
): Button {
  if (typeof btn === "string") {
    return {
      text: btn,
      value: btn,
    };
  }
  if (typeof btn === "number") {
    return {
      text: String(btn),
      value: btn,
    };
  }
  return btn;
}

/**
 * Validate input based on validation type
 */
export function validateInput(
  input: string,
  validationType: "number" | "email" | "phone"
): { valid: boolean; error?: string } {
  switch (validationType) {
    case "number": {
      const num = Number(input);
      if (isNaN(num)) {
        return { valid: false, error: "Please enter a valid number" };
      }
      return { valid: true };
    }
    case "email": {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input)) {
        return { valid: false, error: "Please enter a valid email address" };
      }
      return { valid: true };
    }
    case "phone": {
      const phoneRegex = /^\+?[\d\s()-]{10,}$/;
      if (!phoneRegex.test(input)) {
        return {
          valid: false,
          error: "Please enter a valid phone number",
        };
      }
      return { valid: true };
    }
    default:
      return { valid: true };
  }
}
