/**
 * Condition evaluator for enhanced conditional logic
 * Supports comparison operators and logical combinators (and, or, not)
 */

import type { FlowSession } from "../types.js";

export type ComparisonOperator =
  | "equals"
  | "eq"
  | "notEquals"
  | "ne"
  | "greaterThan"
  | "gt"
  | "greaterThanOrEqual"
  | "gte"
  | "lessThan"
  | "lt"
  | "lessThanOrEqual"
  | "lte"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "matches"
  | "in"
  | "exists";

export interface ConditionalExpression {
  // Simple condition
  variable?: string;
  operator?: ComparisonOperator;
  value?: string | number | boolean;

  // Logical combinators
  and?: ConditionalExpression[];
  or?: ConditionalExpression[];
  not?: ConditionalExpression;
}

/**
 * Get variable value from session
 */
function getVariable(
  variableName: string,
  session: FlowSession
): string | number | boolean | undefined {
  return session.variables[variableName];
}

/**
 * Compare two values using the specified operator
 */
function compareValues(
  actual: string | number | boolean | undefined,
  operator: ComparisonOperator,
  expected: string | number | boolean
): boolean {
  // Handle undefined/null values
  if (actual === undefined || actual === null) {
    return false;
  }

  // Handle exists operator specially
  if (operator === "exists") {
    return true;
  }

  // Normalize operator aliases
  const normalizedOp = normalizeOperator(operator);

  switch (normalizedOp) {
    case "equals":
      return actual === expected;

    case "notEquals":
      return actual !== expected;

    case "greaterThan":
      if (typeof actual === "number" && typeof expected === "number") {
        return actual > expected;
      }
      return false;

    case "greaterThanOrEqual":
      if (typeof actual === "number" && typeof expected === "number") {
        return actual >= expected;
      }
      return false;

    case "lessThan":
      if (typeof actual === "number" && typeof expected === "number") {
        return actual < expected;
      }
      return false;

    case "lessThanOrEqual":
      if (typeof actual === "number" && typeof expected === "number") {
        return actual <= expected;
      }
      return false;

    case "contains":
      return String(actual).includes(String(expected));

    case "startsWith":
      return String(actual).startsWith(String(expected));

    case "endsWith":
      return String(actual).endsWith(String(expected));

    case "matches":
      try {
        const regex = new RegExp(String(expected));
        return regex.test(String(actual));
      } catch {
        return false;
      }

    case "in":
      // Check if actual is in expected array
      if (Array.isArray(expected)) {
        return expected.includes(actual);
      }
      return false;

    default:
      return false;
  }
}

/**
 * Normalize operator aliases to canonical form
 */
function normalizeOperator(operator: ComparisonOperator): ComparisonOperator {
  switch (operator) {
    case "eq":
      return "equals";
    case "ne":
      return "notEquals";
    case "gt":
      return "greaterThan";
    case "gte":
      return "greaterThanOrEqual";
    case "lt":
      return "lessThan";
    case "lte":
      return "lessThanOrEqual";
    default:
      return operator;
  }
}

/**
 * Evaluate a conditional expression
 * Returns true if condition is met, false otherwise
 */
export function evaluateCondition(
  condition: ConditionalExpression,
  session: FlowSession
): boolean {
  // Handle logical combinators
  if (condition.and) {
    return condition.and.every((subCondition) =>
      evaluateCondition(subCondition, session)
    );
  }

  if (condition.or) {
    return condition.or.some((subCondition) =>
      evaluateCondition(subCondition, session)
    );
  }

  if (condition.not) {
    return !evaluateCondition(condition.not, session);
  }

  // Handle simple comparison
  if (condition.variable && condition.operator) {
    const actualValue = getVariable(condition.variable, session);

    // Special case: exists operator doesn't need a value
    if (condition.operator === "exists") {
      return actualValue !== undefined && actualValue !== null;
    }

    // For other operators, we need an expected value
    if (condition.value === undefined) {
      return false;
    }

    return compareValues(actualValue, condition.operator, condition.value);
  }

  // Invalid condition structure
  return false;
}

/**
 * Validate condition structure
 * Returns true if condition is well-formed, false otherwise
 */
export function validateCondition(condition: unknown): condition is ConditionalExpression {
  if (typeof condition !== "object" || condition === null) {
    return false;
  }

  const cond = condition as Record<string, unknown>;

  // Must have either combinators or comparison
  const hasCombinator = "and" in cond || "or" in cond || "not" in cond;
  const hasComparison = "variable" in cond && "operator" in cond;

  if (!hasCombinator && !hasComparison) {
    return false;
  }

  // Validate combinator structures
  if ("and" in cond && !Array.isArray(cond.and)) {
    return false;
  }

  if ("or" in cond && !Array.isArray(cond.or)) {
    return false;
  }

  if ("not" in cond && (typeof cond.not !== "object" || cond.not === null)) {
    return false;
  }

  // Validate comparison structure
  if (hasComparison) {
    if (typeof cond.variable !== "string") {
      return false;
    }

    if (
      typeof cond.operator !== "string" ||
      !isValidOperator(cond.operator)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Check if operator is valid
 */
function isValidOperator(operator: string): operator is ComparisonOperator {
  const validOperators: ComparisonOperator[] = [
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
  ];

  return validOperators.includes(operator as ComparisonOperator);
}
