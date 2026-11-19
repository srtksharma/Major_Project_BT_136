import { describe, expect, it } from "vitest";

import { isProbablyTextContent, parseBatch } from "@/lib/batch-parse";
import { safeCsvCell } from "@/lib/csv";
import { defangUrl } from "@/lib/defang";
import { parseScanHistory, parseScanResult } from "@/lib/schemas";
import {
  MAX_URL_LENGTH,
  isValidHttpUrl,
  normalizeUrl,
  scanFormSchema,
} from "@/lib/url";

describe("normalizeUrl / isValidHttpUrl", () => {
  it("prepends https:// when the protocol is missing", () => {
    expect(normalizeUrl("example.com/login")).toBe("https://example.com/login");
  });
  it("preserves an explicit protocol exactly", () => {
    expect(normalizeUrl("http://a.example.com")).toBe("http://a.example.com");
    expect(normalizeUrl("https://192.168.1.10/login")).toBe(
      "https://192.168.1.10/login",
    );
  });
  it("accepts dotted hosts, IPs and localhost; rejects junk", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
    expect(isValidHttpUrl("https://192.168.1.10/login")).toBe(true);
    expect(isValidHttpUrl("http://localhost:3000")).toBe(true);
    expect(isValidHttpUrl("not a url")).toBe(false);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("https://nodot")).toBe(false);
  });
  it("scan form schema rejects URLs over the length cap", () => {
    const long = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}`;
    expect(scanFormSchema.safeParse({ url: long }).success).toBe(false);
    expect(
      scanFormSchema.safeParse({ url: "example.com/login" }).success,
    ).toBe(true);
  });
});

describe("defangUrl", () => {
  it("defangs the scheme and every dot", () => {
    expect(defangUrl("http://evil.com/login")).toBe("hxxp://evil[.]com/login");
    expect(defangUrl("https://192.168.1.10/login")).toBe(
      "hxxps://192[.]168[.]1[.]10/login",
    );
  });
});

describe("safeCsvCell (formula injection)", () => {
  it.each(["=2+5", "+cmd", "-2+3", "@SUM(A1)", "\t=1", "\r=1"])(
    "prefixes a cell starting with %j",
    (value) => {
      expect(safeCsvCell(value)).toBe(`"'${value}"`);
    },
  );
  it("leaves normal cells untouched apart from quoting", () => {
    expect(safeCsvCell("safe")).toBe('"safe"');
    expect(safeCsvCell('a"b')).toBe('"a""b"');
  });
});

describe("parseBatch limits and content checks", () => {
  it("marks over-length URLs invalid instead of scanning them", () => {
    const long = `https://example.com/${"a".repeat(MAX_URL_LENGTH)}`;
    const parsed = parseBatch(long, false);
    expect(parsed.validCount).toBe(0);
    expect(parsed.rows[0]?.reason).toMatch(/longer than/);
  });
  it("detects binary content", () => {
    expect(isProbablyTextContent("url\nhttps://example.com\n")).toBe(true);
    expect(isProbablyTextContent("PK\u0000\u0000binary")).toBe(false);
  });
});

const VALID_RESULT = {
  id: "scan_1",
  url: "https://example.com/login",
  verdict: "safe",
  confidence: 98,
  scannedAt: "2026-11-13T10:00:00.000Z",
  features: [
    { name: "HTTPS", value: "present", impact: -0.3, description: "Uses HTTPS." },
  ],
};

describe("Zod validators for untrusted data", () => {
  it("accepts a contract-shaped result", () => {
    expect(parseScanResult(VALID_RESULT)?.verdict).toBe("safe");
  });
  it.each([
    ["bad verdict", { ...VALID_RESULT, verdict: "malware" }],
    ["confidence out of range", { ...VALID_RESULT, confidence: 150 }],
    ["impact out of range", { ...VALID_RESULT, features: [{ name: "X", value: 1, impact: 2, description: "d" }] }],
    ["unparseable date", { ...VALID_RESULT, scannedAt: "not-a-date" }],
    ["not an object", "https://example.com"],
  ])("rejects %s", (_label, payload) => {
    expect(parseScanResult(payload)).toBeNull();
  });
  it("history parsing drops tampered entries and keeps valid ones", () => {
    const history = parseScanHistory([
      VALID_RESULT,
      { ...VALID_RESULT, id: "x", verdict: "evil" },
      null,
      42,
    ]);
    expect(history).toHaveLength(1);
    expect(parseScanHistory("nope")).toEqual([]);
    expect(parseScanHistory(null)).toEqual([]);
  });
});
