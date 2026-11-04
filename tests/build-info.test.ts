import { describe, expect, test } from "bun:test";
import { formatBuildTimeShanghai } from "../src/lib/build-info";

describe("formatBuildTimeShanghai", () => {
  test("formats ISO to Asia/Shanghai zh-CN", () => {
    // 2026-11-04T16:00:00Z == 2026-11-05 00:00 Asia/Shanghai
    const s = formatBuildTimeShanghai("2026-11-04T16:00:00.000Z");
    expect(s).toContain("2026");
    expect(s).toContain("11");
    expect(s).toContain("05");
    expect(s).toContain("00");
  });

  test("empty / invalid → empty string", () => {
    expect(formatBuildTimeShanghai("")).toBe("");
    expect(formatBuildTimeShanghai("not-a-date")).toBe("");
  });
});
