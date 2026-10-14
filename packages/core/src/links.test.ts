import { describe, expect, it } from "vitest";
import {
  clickUrl,
  openUrl,
  parseClickToken,
  parseOpenToken,
  parseUnsubscribeToken,
  unsubscribeUrl,
} from "./links";

const SECRET = "test-secret";
const API = "https://api.test";

describe("unsubscribe links", () => {
  it("round trips the project and contact", async () => {
    const url = await unsubscribeUrl(API, SECRET, "prj_1", "con_2");
    const token = url.replace(`${API}/u/`, "");
    expect(await parseUnsubscribeToken(token, SECRET)).toEqual({
      projectId: "prj_1",
      contactId: "con_2",
    });
  });

  it("rejects an open token used as an unsubscribe token", async () => {
    const url = await openUrl(API, SECRET, "eml_1");
    const token = url.replace(`${API}/t/o/`, "");
    expect(await parseUnsubscribeToken(token, SECRET)).toBeNull();
  });
});

describe("tracking links", () => {
  it("round trips an open", async () => {
    const url = await openUrl(API, SECRET, "eml_1");
    expect(
      await parseOpenToken(url.replace(`${API}/t/o/`, ""), SECRET),
    ).toEqual({ emailId: "eml_1" });
  });

  it("signs the redirect target so it cannot be swapped", async () => {
    const target = "https://acme.test/pricing?a=1&b=2";
    const url = await clickUrl(API, SECRET, "eml_1", target);
    expect(
      await parseClickToken(url.replace(`${API}/t/c/`, ""), SECRET),
    ).toEqual({ emailId: "eml_1", target });
  });

  it("rejects a token signed with a different secret", async () => {
    const url = await clickUrl(API, "other", "eml_1", "https://acme.test");
    expect(
      await parseClickToken(url.replace(`${API}/t/c/`, ""), SECRET),
    ).toBeNull();
  });
});
