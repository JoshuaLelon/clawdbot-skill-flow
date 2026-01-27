/**
 * LLM Runner - Load and call Clawdbot's embedded PI agent
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";

// Type definitions for runEmbeddedPiAgent (from clawdbot/extensions/llm-task)
interface EmbeddedPiAgentOptions {
  provider?: string;
  model?: string;
  systemPrompt?: string;
  disableTools?: boolean;
  temperature?: number;
  maxTokens?: number;
  messages?: Array<{ role: string; content: string }>;
}

interface EmbeddedPiAgentResult {
  success: boolean;
  response?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

type RunEmbeddedPiAgent = (
  options: EmbeddedPiAgentOptions
) => Promise<EmbeddedPiAgentResult>;

// Cache the loaded function
let cachedRunner: RunEmbeddedPiAgent | null = null;

/**
 * Load runEmbeddedPiAgent from Clawdbot's main process
 */
async function loadRunEmbeddedPiAgent(
  api: ClawdbotPluginApi
): Promise<RunEmbeddedPiAgent> {
  if (cachedRunner) {
    return cachedRunner;
  }

  try {
    // Type assertion needed as runtime API may have more properties than types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runtimeApi = api.runtime as any;
    const runnerPath = await runtimeApi.system.resolveMainPath(
      "src/runners/embedded-pi-agent.ts"
    );
    const runnerModule = await import(runnerPath);
    cachedRunner = runnerModule.runEmbeddedPiAgent as RunEmbeddedPiAgent;
    return cachedRunner;
  } catch (error) {
    api.logger.error("Failed to load runEmbeddedPiAgent:", error);
    throw new Error(
      "Failed to load LLM runner. Ensure Clawdbot supports embedded PI agent."
    );
  }
}

/**
 * Call the LLM with the given options
 */
export async function callLLM(
  api: ClawdbotPluginApi,
  options: {
    systemPrompt: string;
    userPrompt: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  }
): Promise<{ success: boolean; response?: string; error?: string }> {
  const startTime = Date.now();

  try {
    const runner = await loadRunEmbeddedPiAgent(api);

    // Set timeout
    const timeout = options.timeout || 30000;
    const timeoutPromise = new Promise<EmbeddedPiAgentResult>((_, reject) => {
      setTimeout(() => reject(new Error("LLM call timed out")), timeout);
    });

    // Call LLM
    const resultPromise = runner({
      provider: options.provider,
      model: options.model,
      systemPrompt: options.systemPrompt,
      disableTools: true, // We just want text responses
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4096,
      messages: [{ role: "user", content: options.userPrompt }],
    });

    const result = await Promise.race([resultPromise, timeoutPromise]);

    const latency = Date.now() - startTime;

    if (result.success && result.response) {
      api.logger.info("LLM call succeeded", {
        provider: options.provider,
        model: options.model,
        latency,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      });

      return {
        success: true,
        response: result.response,
      };
    } else {
      api.logger.warn("LLM call returned unsuccessful result", {
        error: result.error,
        latency,
      });

      return {
        success: false,
        error: result.error || "LLM returned no response",
      };
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    api.logger.error("LLM call failed", {
      error: error instanceof Error ? error.message : String(error),
      latency,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Parse JSON response from LLM, handling markdown code blocks
 */
export function parseJSONResponse(response: string): unknown {
  // Remove markdown code blocks if present
  const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const jsonStr = jsonMatch && jsonMatch[1] ? jsonMatch[1] : response;

  return JSON.parse(jsonStr.trim());
}
