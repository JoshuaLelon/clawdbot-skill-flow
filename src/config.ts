import { z } from "zod";

export const SkillFlowConfigSchema = z
  .object({
    flowsDir: z
      .string()
      .optional()
      .describe("Custom flows directory (default: ~/.clawdbot/flows)"),

    sessionTimeoutMinutes: z
      .number()
      .int()
      .min(1)
      .max(1440)
      .default(30)
      .describe("Session timeout in minutes (default: 30)"),

    sessionCleanupIntervalMinutes: z
      .number()
      .int()
      .min(1)
      .max(60)
      .default(5)
      .describe("How often to clean up expired sessions (default: 5)"),

    enableBuiltinHistory: z
      .boolean()
      .default(true)
      .describe("Save completed flows to JSONL history files (default: true)"),

    maxFlowsPerUser: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe("Max concurrent flows per user (optional limit)"),

    llm: z
      .object({
        defaultProvider: z
          .string()
          .default("anthropic")
          .describe("Default LLM provider (default: anthropic)"),

        defaultModel: z
          .string()
          .default("claude-sonnet-4-5")
          .describe("Default LLM model (default: claude-sonnet-4-5)"),

        flowGenerationTimeout: z
          .number()
          .int()
          .min(1000)
          .max(120000)
          .default(30000)
          .describe("Timeout for flow generation in ms (default: 30000)"),

        adaptationTimeout: z
          .number()
          .int()
          .min(1000)
          .max(30000)
          .default(5000)
          .describe("Timeout for step adaptation in ms (default: 5000)"),

        maxTokens: z
          .number()
          .int()
          .min(100)
          .max(8192)
          .default(4096)
          .describe("Maximum tokens for LLM responses (default: 4096)"),

        temperature: z
          .number()
          .min(0)
          .max(2)
          .default(0.7)
          .describe("LLM temperature for creativity (default: 0.7)"),
      })
      .default({})
      .describe("LLM configuration for flow generation and adaptation"),

    actions: z
      .object({
        fetchFailureStrategy: z
          .enum(["stop", "warn", "silent"])
          .default("warn")
          .describe(
            "How to handle fetch action failures: " +
            "'stop' - stop flow execution, " +
            "'warn' - log warning and continue, " +
            "'silent' - continue without logging (default: warn)"
          ),
      })
      .default({})
      .describe("Configuration for step-level actions behavior"),

    security: z
      .object({
        maxInputLength: z
          .number()
          .int()
          .positive()
          .default(10000)
          .describe("Maximum length for user input in characters (default: 10000)"),

        allowedInputPatterns: z
          .array(z.string())
          .optional()
          .describe(
            "Optional regex patterns for allowed input. If set, input must match at least one pattern."
          ),

        actionTimeout: z
          .number()
          .int()
          .positive()
          .default(5000)
          .describe("Timeout for action execution in ms (default: 5000)"),

        hookTimeout: z
          .number()
          .int()
          .positive()
          .default(10000)
          .describe("Timeout for hook execution in ms (default: 10000)"),
      })
      .default({})
      .describe("Security configuration for input sanitization and timeouts"),
  })
  .strict();

export type SkillFlowConfig = z.infer<typeof SkillFlowConfigSchema>;

// Store parsed config for access by other modules
let pluginConfig: SkillFlowConfig | null = null;

/**
 * Parse and validate plugin config with defaults
 */
export function parseSkillFlowConfig(
  raw: unknown
): SkillFlowConfig {
  pluginConfig = SkillFlowConfigSchema.parse(raw ?? {});
  return pluginConfig;
}

/**
 * Get the current plugin config (must call parseSkillFlowConfig first)
 */
export function getPluginConfig(): SkillFlowConfig {
  if (!pluginConfig) {
    throw new Error("Plugin config not initialized. Call parseSkillFlowConfig first.");
  }
  return pluginConfig;
}
