import { describe, it, expect } from "vitest";
import {
  validatePathWithinBase,
  resolvePathSafely,
  sanitizeFilename,
} from "../src/security/path-validation";
import path from "node:path";

describe("Path validation", () => {
  describe("validatePathWithinBase", () => {
    it("should allow paths within base directory", () => {
      const base = "/home/user/.clawdbot/flows";
      const valid = "/home/user/.clawdbot/flows/myflow/hooks.js";

      expect(() =>
        validatePathWithinBase(valid, base, "test")
      ).not.toThrow();
    });

    it("should reject paths that escape base directory", () => {
      const base = "/home/user/.clawdbot/flows";
      const escaped = "/etc/passwd";

      expect(() =>
        validatePathWithinBase(escaped, base, "test")
      ).toThrow(/Path traversal detected/);
    });

    it("should reject relative traversal attempts", () => {
      const base = "/home/user/.clawdbot/flows";
      const escaped = path.resolve(base, "../../../etc/passwd");

      expect(() =>
        validatePathWithinBase(escaped, base, "test")
      ).toThrow(/Path traversal detected/);
    });

    it("should allow base directory itself", () => {
      const base = "/home/user/.clawdbot/flows";

      expect(() =>
        validatePathWithinBase(base, base, "test")
      ).not.toThrow();
    });
  });

  describe("resolvePathSafely", () => {
    it("should resolve safe paths", () => {
      const base = "/home/user/.clawdbot/flows/myflow";
      const result = resolvePathSafely(base, "./hooks.js", "test");

      expect(result).toBe(path.join(base, "hooks.js"));
    });

    it("should throw on directory traversal", () => {
      const base = "/home/user/.clawdbot/flows/myflow";

      expect(() =>
        resolvePathSafely(base, "../../../etc/passwd", "test")
      ).toThrow(/Path traversal detected/);
    });
  });

  describe("sanitizeFilename", () => {
    it("should remove unsafe characters and collapse underscores", () => {
      // Multiple consecutive unsafe chars get replaced by underscores, then collapsed to one
      expect(sanitizeFilename('test<>:"/\\|?*.txt')).toBe("test_.txt");
    });

    it("should collapse multiple underscores", () => {
      expect(sanitizeFilename("test___file.txt")).toBe("test_file.txt");
    });

    it("should limit length to 60 chars", () => {
      const long = "a".repeat(100);
      expect(sanitizeFilename(long).length).toBe(60);
    });

    it("should remove control characters and collapse underscores", () => {
      // Control chars get replaced then collapsed
      expect(sanitizeFilename("test\x00\x1ffile.txt")).toBe("test_file.txt");
    });
  });
});
