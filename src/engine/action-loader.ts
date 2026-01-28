/**
 * Action loader for managing action registry
 * Loads built-in actions and custom npm packages
 */

import { builtInActions, type ActionDefinition } from "./action-registry.js";

/**
 * Action registry interface
 * Provides access to action definitions
 */
export interface ActionRegistry {
  /**
   * Get action definition by type
   */
  get(actionType: string): ActionDefinition | undefined;

  /**
   * Check if action exists
   */
  has(actionType: string): boolean;

  /**
   * List all available action types
   */
  list(): string[];
}

/**
 * Custom action package interface
 * External packages should export this structure
 */
export interface CustomActionPackage {
  namespace: string;
  actions: Record<string, ActionDefinition>;
}

/**
 * Load action registry with built-in and custom actions
 *
 * @param imports - Array of npm package names to import custom actions from
 * @returns ActionRegistry instance
 *
 * @example
 * ```ts
 * const registry = await loadActionRegistry([
 *   '@mycompany/clawdbot-actions',
 *   'my-custom-actions'
 * ]);
 * ```
 */
export async function loadActionRegistry(
  imports?: string[]
): Promise<ActionRegistry> {
  const actions = new Map<string, ActionDefinition>();

  // Load built-in actions
  for (const [actionType, actionDef] of Object.entries(builtInActions)) {
    actions.set(actionType, actionDef);
  }

  // Load custom action packages
  if (imports && imports.length > 0) {
    for (const packageName of imports) {
      try {
        await loadCustomPackage(packageName, actions);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `Failed to load custom action package "${packageName}": ${errorMessage}`
        );
        // Continue loading other packages
      }
    }
  }

  // Return registry interface
  return {
    get(actionType: string): ActionDefinition | undefined {
      return actions.get(actionType);
    },

    has(actionType: string): boolean {
      return actions.has(actionType);
    },

    list(): string[] {
      return Array.from(actions.keys()).sort();
    },
  };
}

/**
 * Load a custom action package and merge into registry
 */
async function loadCustomPackage(
  packageName: string,
  registry: Map<string, ActionDefinition>
): Promise<void> {
  // Dynamic import of custom package
  const pkg = await import(packageName);

  // Check if package has default export
  if (!pkg.default) {
    throw new Error(
      `Package "${packageName}" must have a default export with namespace and actions`
    );
  }

  const customPkg = pkg.default as CustomActionPackage;

  // Validate package structure
  if (!customPkg.namespace || typeof customPkg.namespace !== "string") {
    throw new Error(
      `Package "${packageName}" must have a namespace string`
    );
  }

  if (!customPkg.actions || typeof customPkg.actions !== "object") {
    throw new Error(
      `Package "${packageName}" must have an actions object`
    );
  }

  // Add custom actions with namespace prefix
  for (const [actionName, actionDef] of Object.entries(customPkg.actions)) {
    const fullActionType = `${customPkg.namespace}.${actionName}`;

    // Check for collisions
    if (registry.has(fullActionType)) {
      console.warn(
        `Action type "${fullActionType}" from package "${packageName}" ` +
        `conflicts with existing action. Skipping.`
      );
      continue;
    }

    // Validate action definition structure
    if (!actionDef.schema || !actionDef.execute) {
      console.warn(
        `Invalid action definition for "${fullActionType}" in package "${packageName}". ` +
        `Must have schema and execute properties. Skipping.`
      );
      continue;
    }

    registry.set(fullActionType, actionDef);
  }

  console.log(
    `Loaded ${Object.keys(customPkg.actions).length} actions from package "${packageName}" ` +
    `(namespace: ${customPkg.namespace})`
  );
}

/**
 * Create an empty action registry (useful for testing)
 */
export function createEmptyRegistry(): ActionRegistry {
  const actions = new Map<string, ActionDefinition>();

  return {
    get(actionType: string): ActionDefinition | undefined {
      return actions.get(actionType);
    },

    has(actionType: string): boolean {
      return actions.has(actionType);
    },

    list(): string[] {
      return Array.from(actions.keys()).sort();
    },
  };
}
