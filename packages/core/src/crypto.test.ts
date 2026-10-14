import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  randomCode,
  safeEqual,
  sha256,
  signPayload,
  verifyPayload,
} from "./crypto";

describe("signed payloads", () => {
  it("round trips", async () => {
    const token = await signPayload("u:prj_1:con_2", "secret");
    expect(await verifyPayload(token, "secret")).toBe("u:prj_1:con_2");
  });

  it("rejects a tampered payload", async () => {
    const token = await signPayload("u:prj_1:con_2", "secret");
    const [, signature] = token.split(".");
    const forged = `${btoa("u:prj_1:con_9")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")}.${signature}`;
    expect(await verifyPayload(forged, "secret")).toBeNull();
  });

  it("rejects another instance's secret", async () => {
    const token = await signPayload("x", "secret");
    expect(await verifyPayload(token, "other")).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyPayload("nope", "secret")).toBeNull();
  });
});

describe("secret storage", () => {
  it("encrypts and decrypts SES keys", async () => {
    const encrypted = await encryptSecret("aws-secret", "master");
    expect(encrypted).not.toContain("aws-secret");
    expect(await decryptSecret(encrypted, "master")).toBe("aws-secret");
  });

  it("produces a different ciphertext every time", async () => {
    const a = await encryptSecret("same", "master");
    const b = await encryptSecret("same", "master");
    expect(a).not.toBe(b);
  });

  it("fails with the wrong master key", async () => {
    const encrypted = await encryptSecret("aws-secret", "master");
    await expect(decryptSecret(encrypted, "wrong")).rejects.toThrow();
  });
});

describe("helpers", () => {
  it("compares safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });

  it("hashes stably", async () => {
    expect(await sha256("a")).toBe(await sha256("a"));
    expect(await sha256("a")).toHaveLength(64);
  });

  it("generates fixed length codes", () => {
    expect(randomCode(6)).toMatch(/^\d{6}$/);
  });
});
