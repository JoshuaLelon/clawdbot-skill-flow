/**
 * Interpolation engine for variable templating
 * Supports {{...}} syntax for accessing variables, session data, env vars, and functions
 */

import type { FlowSession } from "../types.js";

export interface InterpolationContext {
  variables: Record<string, string | number | boolean>;
  session: FlowSession;
  env: Record<string, string>;
  timestamp: {
    now: () => string;
    daysAgo: (n: number) => string;
    hoursAgo: (n: number) => string;
    format: (date: Date | string, format: string) => string;
  };
  math: {
    sum: (...values: number[]) => number;
    average: (...values: number[]) => number;
    min: (...values: number[]) => number;
    max: (...values: number[]) => number;
    round: (value: number, decimals?: number) => number;
  };
  string: {
    upper: (s: string) => string;
    lower: (s: string) => string;
    capitalize: (s: string) => string;
    concat: (...parts: string[]) => string;
  };
}

/**
 * Create interpolation context from session and flow data
 */
export function createInterpolationContext(
  session: FlowSession,
  env: Record<string, string> = {}
): InterpolationContext {
  return {
    variables: session.variables,
    session,
    env,
    timestamp: {
      now: () => new Date().toISOString(),
      daysAgo: (n: number) => new Date(Date.now() - n * 86400000).toISOString(),
      hoursAgo: (n: number) => new Date(Date.now() - n * 3600000).toISOString(),
      format: (date: Date | string, format: string) => {
        const d = typeof date === "string" ? new Date(date) : date;
        // Simple format implementation - extend as needed
        return format
          .replace("YYYY", d.getFullYear().toString())
          .replace("MM", String(d.getMonth() + 1).padStart(2, "0"))
          .replace("DD", String(d.getDate()).padStart(2, "0"))
          .replace("HH", String(d.getHours()).padStart(2, "0"))
          .replace("mm", String(d.getMinutes()).padStart(2, "0"))
          .replace("ss", String(d.getSeconds()).padStart(2, "0"));
      },
    },
    math: {
      sum: (...values: number[]) => values.reduce((a, b) => a + b, 0),
      average: (...values: number[]) =>
        values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0,
      min: (...values: number[]) => Math.min(...values),
      max: (...values: number[]) => Math.max(...values),
      round: (value: number, decimals = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(value * factor) / factor;
      },
    },
    string: {
      upper: (s: string) => s.toUpperCase(),
      lower: (s: string) => s.toLowerCase(),
      capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
      concat: (...parts: string[]) => parts.join(""),
    },
  };
}

/**
 * Resolve a dot-notation path in the context
 * e.g., "variables.name" -> context.variables.name
 * For functions with no args, returns the function for later calling
 */
function resolvePath(path: string, context: InterpolationContext): unknown {
  const parts = path.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Evaluate a function call expression
 * e.g., "timestamp.now()" or "math.sum(variables.a, variables.b)"
 */
function evaluateFunctionCall(
  expr: string,
  context: InterpolationContext
): unknown {
  // Match function call pattern: path.to.func(arg1, arg2, ...)
  const match = expr.match(/^([a-zA-Z0-9_.]+)\((.*)\)$/);
  if (!match || !match[1]) {
    return undefined;
  }

  const funcPath = match[1];
  const argsStr = match[2] || "";
  const func = resolvePath(funcPath, context);

  if (typeof func !== "function") {
    return undefined;
  }

  // Parse arguments
  const args: unknown[] = [];
  if (argsStr && argsStr.trim()) {
    // Split by comma, but respect nested function calls
    const argParts = splitArguments(argsStr);
    for (const arg of argParts) {
      args.push(evaluateExpression(arg.trim(), context));
    }
  }

  return func(...args);
}

/**
 * Split function arguments by comma, respecting nested parentheses
 */
function splitArguments(argsStr: string): string[] {
  const args: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of argsStr) {
    if (char === "(") {
      depth++;
      current += char;
    } else if (char === ")") {
      depth--;
      current += char;
    } else if (char === "," && depth === 0) {
      args.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Evaluate a simple arithmetic expression
 * e.g., "variables.a + variables.b" or "10 * 2"
 */
function evaluateArithmetic(expr: string, context: InterpolationContext): unknown {
  // Replace variable references with their values
  const resolved = expr.replace(/[a-zA-Z0-9_.]+/g, (match) => {
    // Check if it's a number literal
    if (!isNaN(Number(match))) {
      return match;
    }
    // Resolve as variable path
    const value = resolvePath(match, context);
    if (typeof value === "number") {
      return String(value);
    }
    return match;
  });

  // Try to safely evaluate simple arithmetic
  try {
    // Only allow safe operations (numbers and basic operators)
    if (/^[\d\s+\-*/.()]+$/.test(resolved)) {
      // Use Function constructor instead of eval for better security
      // Still safe because we've validated the input contains only numbers and operators
      // eslint-disable-next-line no-new-func
      const fn = new Function(`return ${resolved}`);
      return fn();
    }
  } catch {
    // Fall through to return undefined
  }

  return undefined;
}

/**
 * Evaluate an expression (function call, variable reference, or arithmetic)
 */
function evaluateExpression(expr: string, context: InterpolationContext): unknown {
  expr = expr.trim();

  // Check for function call (explicit parentheses)
  if (expr.includes("(") && expr.includes(")")) {
    const result = evaluateFunctionCall(expr, context);
    if (result !== undefined) {
      return result;
    }
  }

  // Check for arithmetic operators
  if (/[+\-*/]/.test(expr) && !expr.includes("(")) {
    const result = evaluateArithmetic(expr, context);
    if (result !== undefined) {
      return result;
    }
  }

  // Simple variable reference - could be a function without parens
  const value = resolvePath(expr, context);

  // If it's a function with no args (like timestamp.now), call it
  if (typeof value === "function") {
    try {
      return value();
    } catch {
      return value;
    }
  }

  return value;
}

/**
 * Interpolate a single string template
 * Replaces {{...}} with evaluated expressions
 */
export function interpolate(template: string, context: InterpolationContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const result = evaluateExpression(expr, context);

    if (result === null || result === undefined) {
      return "";
    }

    if (typeof result === "object") {
      return JSON.stringify(result);
    }

    return String(result);
  });
}

/**
 * Deep interpolate a config object
 * Recursively processes all string values
 */
export function interpolateConfig(
  config: Record<string, unknown>,
  context: InterpolationContext
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      result[key] = interpolate(value, context);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? interpolate(item, context)
          : typeof item === "object" && item !== null
            ? interpolateConfig(item as Record<string, unknown>, context)
            : item
      );
    } else if (typeof value === "object" && value !== null) {
      result[key] = interpolateConfig(value as Record<string, unknown>, context);
    } else {
      result[key] = value;
    }
  }

  return result;
}
