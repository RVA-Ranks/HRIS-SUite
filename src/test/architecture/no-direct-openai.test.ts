import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "../..");
const GATEWAY_ROOT = path.join(SRC_ROOT, "ai/gateway");

const OPENAI_IMPORT_PATTERN = /from\s+['"]openai['"]/;

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (/\.(ts|tsx|mts|js|jsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("architecture: no direct openai imports", () => {
  it("allows openai imports only under src/ai/gateway", () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
      if (file.startsWith(GATEWAY_ROOT)) {
        continue;
      }

      const contents = readFileSync(file, "utf8");
      if (OPENAI_IMPORT_PATTERN.test(contents)) {
        offenders.push(path.relative(SRC_ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
