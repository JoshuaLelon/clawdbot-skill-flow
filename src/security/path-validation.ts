import path from "node:path";

/**
 * Validate that a resolved path stays within a base directory.
 * Prevents directory traversal attacks like ../../../etc/passwd
 * @throws Error if path escapes base directory
 */
export function validatePathWithinBase(
  resolvedPath: string,
  baseDir: string,
  description: string = "path"
): void {
  const normalized = path.normalize(path.resolve(resolvedPath));
  const normalizedBase = path.normalize(path.resolve(baseDir));

  // Must be inside baseDir or be exactly baseDir
  const insideOrEqual =
    normalized === normalizedBase ||
    normalized.startsWith(normalizedBase + path.sep);

  if (!insideOrEqual) {
    throw new Error(
      `Path traversal detected: ${description} "${resolvedPath}" escapes base directory "${baseDir}"`
    );
  }
}

/**
 * Safely resolve a relative path within a base directory
 * @returns Absolute path if valid; throws if attempts to escape base
 */
export function resolvePathSafely(
  basePath: string,
  relativePath: string,
  description: string = "path"
): string {
  const resolved = path.resolve(basePath, relativePath);
  validatePathWithinBase(resolved, basePath, description);
  return resolved;
}

/**
 * Sanitize a filename for cross-platform compatibility
 * Removes unsafe characters: < > : " / \ | ? * and control chars
 */
export function sanitizeFilename(name: string): string {
  // Remove unsafe chars and control chars (U+0000-U+001F)
  // eslint-disable-next-line no-control-regex
  const unsafe = /[<>:"/\\|?*\x00-\x1f]/g;
  const sanitized = name.trim().replace(unsafe, "_").replace(/\s+/g, "_");
  // Collapse multiple underscores, trim leading/trailing, limit length
  return sanitized.replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
}
