import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseChangelog } from "@/lib/changelog";

describe("parseChangelog sobre el CHANGELOG.md real", () => {
  const md = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf8");
  const versions = parseChangelog(md);

  it("encuentra todas las versiones, de la más reciente a la v1.0", () => {
    expect(versions.length).toBeGreaterThanOrEqual(10);
    expect(versions.some((v) => v.heading.includes("v2.1"))).toBe(true);
    expect(versions[versions.length - 1]!.heading).toContain("v1.0");
    // La más reciente va arriba: sin fijar cuál, para no romper con cada versión.
    const num = (h: string) => {
      const m = h.match(/v(\d+)\.(\d+)/);
      return m ? Number(m[1]) * 100 + Number(m[2]) : -1;
    };
    const nums = versions.map((v) => num(v.heading));
    expect(nums[0]).toBe(Math.max(...nums));
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
