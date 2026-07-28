import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseChangelog } from "@/lib/changelog";

describe("parseChangelog sobre el CHANGELOG.md real", () => {
  const md = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
  const versions = parseChangelog(md);

  it("encuentra todas las versiones, de la v2.1 a la v1.0", () => {
    expect(versions.length).toBeGreaterThanOrEqual(10);
    expect(versions[0]!.heading).toContain("v2.1");
    expect(versions[versions.length - 1]!.heading).toContain("v1.0");
  });

  it("cada versión tiene contenido y no cuela separadores ni vacíos", () => {
    for (const version of versions) {
      expect(version.blocks.length).toBeGreaterThan(0);
      for (const block of version.blocks) {
        expect(block.text).not.toBe("---");
        expect(block.text.trim()).not.toBe("");
      }
    }
  });

  it("distingue viñetas de párrafos", () => {
    const latest = versions[0]!;
    expect(latest.blocks.some((b) => b.type === "li")).toBe(true);
    expect(latest.blocks.some((b) => b.type === "p")).toBe(true);
  });
});
