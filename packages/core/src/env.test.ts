import { describe, expect, it } from "vitest";
import { isEmailAllowed, isLocalDeployment, type AppEnv } from "./env";

const env = (overrides: Partial<AppEnv>) => overrides as AppEnv;

describe("isLocalDeployment", () => {
  it("recognises a developer machine", () => {
    for (const url of [
      "http://localhost:3000",
      "http://127.0.0.1:8787",
      "http://[::1]:3000",
      "https://localhost",
    ]) {
      expect(isLocalDeployment(env({ APP_URL: url }))).toBe(true);
    }
  });

  it("treats anything deployed as not local", () => {
    for (const url of [
      "https://mails.haxzie.com",
      "https://localhost.evil.com",
      "https://notlocalhost",
      "",
    ]) {
      expect(isLocalDeployment(env({ APP_URL: url }))).toBe(false);
    }
  });
});

describe("isEmailAllowed", () => {
  it("matches an exact address, case and space insensitively", () => {
    const allowlist = env({ ALLOWED_EMAILS: "you@example.com, other@x.test" });
    expect(isEmailAllowed(allowlist, " You@Example.com ")).toBe(true);
    expect(isEmailAllowed(allowlist, "someone@example.com")).toBe(false);
  });

  it("matches a whole domain when the entry starts with @", () => {
    const allowlist = env({ ALLOWED_EMAILS: "@example.com" });
    expect(isEmailAllowed(allowlist, "anyone@example.com")).toBe(true);
    expect(isEmailAllowed(allowlist, "anyone@notexample.com")).toBe(false);
  });

  it("denies everyone when the allowlist is empty", () => {
    expect(isEmailAllowed(env({ ALLOWED_EMAILS: "" }), "you@example.com")).toBe(
      false,
    );
  });
});
