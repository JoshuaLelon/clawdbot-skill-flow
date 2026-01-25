import { z } from "zod";

export const SkillFlowConfigSchema = z
  .object({
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
  })
  .strict();

export type SkillFlowConfig = z.infer<typeof SkillFlowConfigSchema>;

/**
 * Parse and validate plugin config with defaults
 */
export function parseSkillFlowConfig(
  raw: unknown
): SkillFlowConfig {
  return SkillFlowConfigSchema.parse(raw ?? {});
}
