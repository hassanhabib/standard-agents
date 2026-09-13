import { describe, expect, it } from "vitest";

import { DEFAULT_REDACTION_RULES, RuleRedactionBroker } from "./RuleRedactionBroker.js";

describe("RuleRedactionBroker", () => {
  it("ShouldReplaceAMatchWithAFamilyTokenAndPutItBackAsync", async () => {
    // given
    const broker = new RuleRedactionBroker([{ family: "AWS", pattern: /\bAKIA[0-9A-Z]{16}\b/g }]);
    const prompt = "deploy with AKIA1234567890ABCDEF then stop";

    // when
    const actualRedaction = await broker.redact(prompt);

    // then
    expect(actualRedaction.text).toBe("deploy with {{AWS_1}} then stop");
    expect([...actualRedaction.tokens]).toEqual([["{{AWS_1}}", "AKIA1234567890ABCDEF"]]);
    expect(await broker.rehydrate(actualRedaction.text, actualRedaction.tokens)).toBe(prompt);
  });

  it("ShouldLeaveTextWithNothingToRedactAloneAsync", async () => {
    // given
    const broker = new RuleRedactionBroker([{ family: "AWS", pattern: /\bAKIA[0-9A-Z]{16}\b/g }]);

    // when
    const actualRedaction = await broker.redact("nothing secret here");

    // then
    expect(actualRedaction.text).toBe("nothing secret here");
    expect(actualRedaction.tokens.size).toBe(0);
  });

  it("ShouldGiveOneValueOneTokenHoweverOftenItAppearsAsync", async () => {
    // given
    const broker = new RuleRedactionBroker([{ family: "AWS", pattern: /\bAKIA[0-9A-Z]{16}\b/g }]);

    // when
    const actualRedaction = await broker.redact("AKIA1234567890ABCDEF and AKIA1234567890ABCDEF and AKIAZZZZZZZZZZZZZZZZ");

    // then
    expect(actualRedaction.text).toBe("{{AWS_1}} and {{AWS_1}} and {{AWS_2}}");
    expect(actualRedaction.tokens.size).toBe(2);
  });

  it("ShouldRedactOnlyWhatTheRuleCapturedSoTheNameSurvivesAsync", async () => {
    // given
    const broker = new RuleRedactionBroker([{ family: "SECRET", pattern: /api_key=([^\s]+)/g }]);

    // when
    const actualRedaction = await broker.redact("run with api_key=sk_live_9f2c1a and go");

    // then
    expect(actualRedaction.text).toBe("run with api_key={{SECRET_1}} and go");
    expect([...actualRedaction.tokens.values()]).toEqual(["sk_live_9f2c1a"]);
  });

  it.each([
    ["a private key", "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\n-----END RSA PRIVATE KEY-----", "PEM"],
    ["a bearer token", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N", "JWT"],
    ["a provider key", "sk_live_51H8xKfLkdIwHu7ix", "SECRET"],
    ["a github token", "ghp_16C7e42F292c6912E7710c838347Ae178B4a", "SECRET"],
    ["an access key id", "AKIAIOSFODNN7EXAMPLE", "AWS"],
  ])("ShouldRedactTheDefaultShapesAsync (%s)", async (_name, secret, family) => {
    // given
    const broker = new RuleRedactionBroker();

    // when
    const actualRedaction = await broker.redact(`before ${secret} after`);

    // then
    expect(actualRedaction.text).not.toContain(secret);
    expect(actualRedaction.text).toContain(`{{${family}_1}}`);
    expect(await broker.rehydrate(actualRedaction.text, actualRedaction.tokens)).toBe(`before ${secret} after`);
  });

  it("ShouldRedactAValueTheNameBesideItMakesASecretAsync", async () => {
    // given
    const broker = new RuleRedactionBroker(DEFAULT_REDACTION_RULES);

    // when
    const actualRedaction = await broker.redact('{"password": "hunter2-and-then-some"}');

    // then
    expect(actualRedaction.text).not.toContain("hunter2-and-then-some");
    expect(actualRedaction.text).toContain("password");
  });

});
