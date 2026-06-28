import { describe, expect, it, vi } from "vitest";
import {
  canApplyPreview,
  countScheduleSlots,
  downloadBlob,
  formatFileMeta,
  getAcceptedMime,
  scheduleReplaceWarning,
  truncateTextPreview,
  TRANSFER_DEFINITION_OF_DONE,
  TRANSFER_KIND_COPY,
} from "@/lib/import-export-ui";

describe("import-export-ui", () => {
  it("exposes definition of done flags", () => {
    expect(TRANSFER_DEFINITION_OF_DONE.previewBeforeApply).toBe(true);
    expect(TRANSFER_DEFINITION_OF_DONE.formatApiError).toBe(true);
  });

  it("returns mime by kind", () => {
    expect(getAcceptedMime("calendar")).toContain("pdf");
    expect(getAcceptedMime("judges")).toContain("spreadsheet");
  });

  it("has copy for all transfer kinds", () => {
    expect(TRANSFER_KIND_COPY.schedule.title).toMatch(/horario/i);
    expect(TRANSFER_KIND_COPY.calendar.title).toMatch(/calendario/i);
  });

  it("formats file sizes", () => {
    expect(formatFileMeta(500)).toBe("500 B");
    expect(formatFileMeta(2048)).toBe("2.0 KB");
  });

  it("canApplyPreview respects counts", () => {
    expect(canApplyPreview({ toCreateCount: 0 })).toBe(false);
    expect(canApplyPreview({ toCreateCount: 3 })).toBe(true);
    expect(canApplyPreview({ sessionCount: 2 })).toBe(true);
    expect(canApplyPreview({ refereeCount: 0 })).toBe(false);
    expect(canApplyPreview({ refereeCount: 12 })).toBe(true);
  });

  it("counts schedule slots across roles and pesaje", () => {
    expect(
      countScheduleSlots([
        {
          roles: [{ slots: 2 }, { slots: 1 }],
          pesajeRoles: [{ slots: 3 }],
        },
        { roles: [{ slots: 1 }], pesajeRoles: [] },
      ]),
    ).toBe(7);
  });

  it("warns when replacing existing template", () => {
    expect(scheduleReplaceWarning(false)).toBeNull();
    expect(scheduleReplaceWarning(true)).toMatch(/reemplazará/i);
  });

  it("truncates text preview", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
    const { preview, truncated, totalLines } = truncateTextPreview(lines.join("\n"), 10);
    expect(truncated).toBe(true);
    expect(totalLines).toBe(50);
    expect(preview.split("\n")).toHaveLength(10);
  });
});

describe("downloadBlob", () => {
  it("triggers download via temporary anchor", () => {
    vi.useFakeTimers();
    let clicked = false;
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0" });
    vi.stubGlobal("document", {
      createElement: () => ({
        href: "",
        download: "",
        rel: "",
        click: () => {
          clicked = true;
        },
        remove: () => {},
      }),
      body: { appendChild: () => {} },
    });

    downloadBlob("hello", "test.txt", "text/plain");

    expect(clicked).toBe(true);
    expect(create).toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:test");
    create.mockRestore();
    revoke.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
