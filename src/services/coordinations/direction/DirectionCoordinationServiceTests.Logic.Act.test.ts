import { describe, expect, it } from "vitest";

import { createResolvedInference } from "../../../models/brokers/generators/ResolvedInference.js";
import { AgentRun } from "../../../models/loggings/AgentRun.js";
import { createAgentEffect, type AgentEffect } from "../../../models/orchestrations/effects/AgentEffect.js";
import { allow, deny } from "../../../models/orchestrations/effects/AuthorizationDecision.js";
import { AgentOrchestrationDependencyException } from "../../../models/orchestrations/agents/exceptions/AgentOrchestrationDependencyException.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import { replayed } from "./DirectionCoordinationService.Effects.js";
import { createDirectionCoordinationServiceTests, createRandomString, proceed, toolContext, verifyNoOtherCalls } from "./DirectionCoordinationServiceTests.js";

describe("DirectionCoordinationService act logic", () => {
  it("ShouldReturnResponseOnActAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const answer = createRandomString();
    const context = toolContext("ReturnResponse", answer);
    executionOrchestrationServiceMock.return.mockResolvedValue(answer);

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext).toEqual({ ...context, result: answer, status: "Responded" });
    expect(executionOrchestrationServiceMock.return).toHaveBeenCalledWith(answer);
    expect(loggingBrokerMock.logPayload).toHaveBeenCalledWith("Direction", "ReturnResponse returned", answer, false);
    verifyNoOtherCalls(executionOrchestrationServiceMock, { return: 1 });
    verifyNoOtherCalls(perimeterOrchestrationServiceMock);
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 1 });
  });

  it.each([
    ["Refuse", "Refused"],
    ["AwaitInput", "AwaitingInput"],
  ])("ShouldEndTerminalDirectionOnActAsync (%s)", async (directionType, expectedStatus) => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const payload = createRandomString();
    const context = toolContext(directionType, payload);
    executionOrchestrationServiceMock.return.mockResolvedValue(payload);

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext).toEqual({ ...context, result: payload, status: expectedStatus });
    verifyNoOtherCalls(executionOrchestrationServiceMock, { return: 1 });
    verifyNoOtherCalls(perimeterOrchestrationServiceMock);
  });

  it("ShouldActOnEffectAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const context = toolContext();
    const output = createRandomString();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(output);

    // when
    const [actualContext, runId, performed] = await AgentRun.begin(null, undefined, async () => {
      const acted = await directionCoordinationService.act(context);

      return [acted, AgentRun.current()?.id ?? "", AgentRun.current()?.performedEffects ?? []];
    });

    // then
    const expectedEffect = createAgentEffect(runId, context.directionType, context.payload, "Safe", false, null, "");

    expect(actualContext).toEqual({
      ...context,
      result: output,
      observations: [...context.observations, `${context.directionType}: ${output}`],
      status: "Working",
    });

    expect(perimeterOrchestrationServiceMock.authorize).toHaveBeenCalledWith(expectedEffect);
    expect(perimeterOrchestrationServiceMock.claim).toHaveBeenCalledWith(expectedEffect);
    expect(executionOrchestrationServiceMock.run).toHaveBeenCalledWith(context.directionType, context.payload, undefined);
    expect(perimeterOrchestrationServiceMock.recordOutcome).toHaveBeenCalledWith(expectedEffect, output);
    expect(performed).toEqual([{ toolName: context.directionType, arguments: context.payload, outcome: output, idempotencyKey: expectedEffect.idempotencyKey }]);
    expect(loggingBrokerMock.logPayload).toHaveBeenNthCalledWith(1, "Direction", `Tool '${context.directionType}' input`, context.payload, true);
    expect(loggingBrokerMock.logPayload).toHaveBeenNthCalledWith(2, "Direction", `Tool '${context.directionType}' output`, output, false);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1, recordOutcome: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock, { run: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logPayload: 2 });
  });

  it("ShouldDenyOnActIfPolicyDeniesAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const context = toolContext();
    const reason = createRandomString();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(deny(reason));

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext).toEqual({
      ...context,
      result: reason,
      observations: [...context.observations, `${context.directionType}: ${reason}`],
      status: "Working",
    });

    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldReleaseTheClaimWhenTheActPerformedNothingAsync", async () => {
    // given
    // A tool that refused. The refusal is the right answer and it comes back to the model as one,
    // but the act did not happen, and the ledger was told it had: it recorded the refusal as the
    // effect's outcome, so every retry of the same call replayed the refusal instead of running.
    //
    // Watched live on 2026-09-12. A model asked to rewrite a file called write_file, was told
    // "this run has not read index.html, call read_file then call write_file again", read the file,
    // called write_file again with the same arguments, and was handed the same refusal back. It
    // read and retried three times. The ledger answered every one of them from its record and the
    // file was never written.
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({
        toolPerformed: new Map([["write_file", (output: string) => !output.startsWith("could not write")]]),
      });

    const context = toolContext("write_file", '{"path":"index.html"}');
    const refusal = "could not write: this run has not read index.html";

    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.releaseClaim.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(refusal);

    // when
    const [actualContext, performed] = await AgentRun.begin(null, undefined, async () => {
      const acted = await directionCoordinationService.act(context);

      return [acted, AgentRun.current()?.performedEffects ?? []] as const;
    });

    // then
    // The model still hears the refusal, because that is what it can act on.
    expect(actualContext.result).toBe(refusal);
    expect(actualContext.status).toBe("Working");

    // The claim is let go rather than filled in, so the same call may run once the model has done
    // what the refusal told it to do. Nothing happened, so nothing is compensable either.
    expect(perimeterOrchestrationServiceMock.releaseClaim).toHaveBeenCalled();
    expect(perimeterOrchestrationServiceMock.recordOutcome).not.toHaveBeenCalled();
    expect(performed).toEqual([]);
  });

  it("ShouldReplayRecordedOutcomeOnActAndSayItIsAReplayAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const context = toolContext();
    const outcome = createRandomString();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue({ verdict: "Replay", outcome, record: null });

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    // The outcome is the recorded one, whole and unaltered, because that is the point of a replay.
    expect(actualContext.result).toContain(outcome);
    expect(actualContext.status).toBe("Working");

    // And it says it is one. Watched live: a run made the same call nine times, was handed the same
    // answer nine times, and had almost no turns left by the time it did anything else. The bytes
    // it was given back were the bytes it was looking at when it decided to ask again, so it
    // decided the same thing again. That it has already done this is the one thing it did not
    // already have.
    expect(actualContext.result).toContain(context.directionType);
    expect(actualContext.result).toContain("already ran");

    // Carried into the observations as it is read, rather than the bare outcome: a note the next
    // turn cannot see is a note nobody wrote.
    expect(actualContext.observations.at(-1)).toContain("already ran");

    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldReplayOnlyTheNoteWhenTheSameActIsAskedForAThirdTimeAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const outcome = createRandomString();
    const context = toolContext();

    // The two calls before this one: the first ran and answered, the second was replayed and said
    // so. The note said "use it and do something else", and this call is the model doing the same
    // thing instead. Watched live: a 990-line file read in three pages, then the first page asked
    // for fourteen more times, each answered with the same sixteen kilobytes and the same note,
    // until the turns ran out with nothing done.
    const twice: AgentContext = {
      ...context,
      observations: [
        ...context.observations,
        `${context.directionType}: ${outcome}`,
        `${context.directionType}: ${replayed(context.directionType, outcome)}`,
      ],
    };

    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue({ verdict: "Replay", outcome, record: null });

    // when
    const actualContext = await directionCoordinationService.act(twice);

    // then
    // The note alone, and not the bytes. The model has had the outcome twice, and a third copy is
    // the thing that was not working: it is the bytes it was looking at when it decided to ask
    // again, and every copy costs the person a turn's worth of context. The run itself goes on,
    // because whether a run that keeps asking should end is the loop's contract to decide, and the
    // contract says the turn cap decides it.
    expect(actualContext.status).toBe("Working");
    expect(actualContext.result).toContain("third time");
    expect(actualContext.result).not.toContain(outcome);
    expect(actualContext.observations.at(-1)).toContain("third time");

    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldReadAgainOnActWhenSomethingWroteToThePlaceSinceAsync", async () => {
    // given
    // A read, then a write to the same file, then the same read again. Watched live: the model
    // edited line 10 and read the file back to see its edit, and the run-once perimeter handed it
    // the file as it was before the edit, then the note saying it already had that. The re-read
    // was the right thing to do; the replay was stale, and it asked again and again.
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({
        toolRisk: new Map([
          ["read_file", "Safe"],
          ["write_file", "Irreversible"],
        ]),
        toolScope: new Map([
          ["read_file", (input: string): string => input],
          ["write_file", (input: string): string => input],
        ]),
      });

    const context: AgentContext = {
      ...toolContext("read_file", "index.html"),
      toolExchanges: [
        { callId: "c1", toolName: "read_file", argumentsJson: "index.html", result: "the file before" },
        { callId: "c2", toolName: "write_file", argumentsJson: "index.html", result: "edited" },
      ],
    };

    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue("the file after");

    // when
    const [actualContext, runId] = await AgentRun.begin(null, undefined, async () => {
      const acted = await directionCoordinationService.act(context);

      return [acted, AgentRun.current()?.id ?? ""];
    });

    // then
    // A new act in the ledger, not the old one asked for again: the ledger remembers what the file
    // said, and the file has changed since. So the key it is claimed under is not the key the same
    // read had before the write, and the read runs.
    const beforeTheWrite = createAgentEffect(runId, "read_file", "index.html", "Safe", false, null, "index.html");
    const claimedWith = perimeterOrchestrationServiceMock.claim.mock.calls[0]?.[0] as AgentEffect;

    expect(claimedWith.idempotencyKey).not.toBe(beforeTheWrite.idempotencyKey);
    expect(actualContext.result).toBe("the file after");
    verifyNoOtherCalls(executionOrchestrationServiceMock, { run: 1 });
  });

  it("ShouldTellInProgressOnActIfAnotherRunHoldsTheClaimAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const context = toolContext();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue({ verdict: "InProgress", outcome: null, record: null });

    const expectedReason =
      `'${context.directionType}' is already in progress in another run; it was not performed again. ` +
      "Wait for that run, or answer with what you know.";

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext).toEqual({
      ...context,
      result: expectedReason,
      observations: [...context.observations, `${context.directionType}: ${expectedReason}`],
      status: "Working",
    });

    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldHoldOnActIfClaimIsUnreconciledAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const context = toolContext();
    const claimedOn = new Date();

    const record = {
      idempotencyKey: createRandomString(),
      toolName: context.directionType,
      state: "Failed" as const,
      owner: createRandomString(),
      claimedOn,
      leaseUntil: claimedOn,
      outcome: null,
      detail: createRandomString(),
      recordedOn: claimedOn,
    };

    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue({ verdict: "Unreconciled", outcome: null, record });
    const expectedEffect = createAgentEffect("", context.directionType, context.payload, "Safe", false, null, "");

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext.status).toBe("AwaitingInput");
    expect(actualContext.pendingEffect).toEqual(expectedEffect);
    expect(actualContext.result).toContain("reconcile the ledger");
    expect(actualContext.result).toContain("state: Failed");
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldRequestApprovalOnActIfToolRequiresItAsync", async () => {
    // given
    const context = toolContext();

    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({ irreversibleTools: [context.directionType] });

    const output = createRandomString();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.requestApproval.mockResolvedValue("Approved");
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(output);
    const expectedEffect = createAgentEffect("", context.directionType, context.payload, "Irreversible", true, null, "");

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext.result).toBe(output);
    expect(perimeterOrchestrationServiceMock.requestApproval).toHaveBeenCalledWith(expectedEffect);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1, requestApproval: 1, recordOutcome: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock, { run: 1 });
  });

  it("ShouldHoldOnActIfApprovalIsPendingAsync", async () => {
    // given
    const context = toolContext();

    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({ irreversibleTools: [context.directionType] });

    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.requestApproval.mockResolvedValue("Pending");
    perimeterOrchestrationServiceMock.releaseClaim.mockResolvedValue(undefined);
    const expectedEffect = createAgentEffect("", context.directionType, context.payload, "Irreversible", true, null, "");

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext).toEqual({
      ...context,
      result: `'${context.directionType}' is waiting for approval before it can run.`,
      pendingEffect: expectedEffect,
      status: "AwaitingApproval",
    });

    expect(perimeterOrchestrationServiceMock.releaseClaim).toHaveBeenCalledWith(expectedEffect);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1, requestApproval: 1, releaseClaim: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldDenyOnActIfApprovalIsDeniedAsync", async () => {
    // given
    const context = toolContext();

    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({ irreversibleTools: [context.directionType] });

    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.requestApproval.mockResolvedValue("Denied");
    perimeterOrchestrationServiceMock.releaseClaim.mockResolvedValue(undefined);
    const expectedReason = `approval denied for '${context.directionType}'`;

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext).toEqual({
      ...context,
      result: expectedReason,
      observations: [...context.observations, `${context.directionType}: ${expectedReason}`],
      status: "Working",
    });

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Approval -> DENIED '${context.directionType}'; the claim was released`);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1, requestApproval: 1, releaseClaim: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldNotAskAgainOnActIfToolAndScopeWereGrantedInTheRunAsync", async () => {
    // given
    const toolName = createRandomString();
    const scope = `/${createRandomString()}`;
    const firstContext = toolContext(toolName, `${scope} first`);
    const secondContext = toolContext(toolName, `${scope} second`);
    const elsewhereContext = toolContext(toolName, `/${createRandomString()} third`);

    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({
        irreversibleTools: [toolName],
        toolScope: new Map([[toolName, (input: string) => input.split(" ")[0] ?? ""]]),
      });

    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.requestApproval.mockResolvedValue("Approved");
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(createRandomString());

    // when
    await AgentRun.begin(null, undefined, async () => {
      await directionCoordinationService.act(firstContext);
      await directionCoordinationService.act(secondContext);
      await directionCoordinationService.act(elsewhereContext);
    });

    // then
    expect(perimeterOrchestrationServiceMock.requestApproval).toHaveBeenCalledTimes(2);
    expect(perimeterOrchestrationServiceMock.requestApproval.mock.calls[0]?.[0]).toMatchObject({ scope });
    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Approval -> already granted '${toolName}' at '${scope}'`);
    verifyNoOtherCalls(executionOrchestrationServiceMock, { run: 3 });
  });

  it("ShouldAskOnActIfModeIsAskAndNothingPermitsTheActAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({ mode: "Ask" });

    const context = toolContext();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.requestApproval.mockResolvedValue("Approved");
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(createRandomString());
    const expectedEffect = createAgentEffect("", context.directionType, context.payload, "Safe", false, null, "");

    // when
    await directionCoordinationService.act(context);

    // then
    expect(perimeterOrchestrationServiceMock.requestApproval).toHaveBeenCalledWith(expectedEffect);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1, requestApproval: 1, recordOutcome: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock, { run: 1 });
  });

  it("ShouldDenyOnActIfModeIsDenyAndNothingPermitsTheActAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({ mode: "Deny" });

    const context = toolContext();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    const expectedReason = `tool '${context.directionType}' is not permitted: nothing explicitly permits it and the permission mode is Deny`;

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext).toEqual({
      ...context,
      result: expectedReason,
      observations: [...context.observations, `${context.directionType}: ${expectedReason}`],
      status: "Working",
    });

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Permissions -> DENIED '${context.directionType}': nothing explicitly permits it`);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldActOnActIfModeIsDenyAndTheAllowListPermitsTheActAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({ mode: "Deny", explicitlyPermits: () => true });

    const context = toolContext();
    const output = createRandomString();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(output);

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext.result).toBe(output);
    verifyNoOtherCalls(executionOrchestrationServiceMock, { run: 1 });
  });

  it("ShouldDenyOnActIfSelectionWithheldTheToolAsync", async () => {
    // given
    const context = toolContext();

    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests({ enforceSelection: true, advertisedTools: [context.directionType] });

    const expectedReason =
      `tool '${context.directionType}' was not offered to this run: selection withheld it. ` +
      "Choose among the offered tools or answer directly.";

    // when
    const actualContext = await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.offeredTools = [];
      }

      return await directionCoordinationService.act(context);
    });

    // then
    expect(actualContext).toEqual({
      ...context,
      result: expectedReason,
      observations: [...context.observations, `${context.directionType}: ${expectedReason}`],
      status: "Working",
    });

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Selection -> DENIED '${context.directionType}': not offered to this run`);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock);
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldAwaitCallerOnActIfToolIsTheCallersAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, loggingBrokerMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const callerTool = { name: createRandomString(), description: createRandomString(), parametersJson: "{}" };

    const context = {
      ...toolContext(callerTool.name.toUpperCase()),
      toolCallId: createRandomString(),
      inference: { ...createResolvedInference(), callerTools: [callerTool] },
    };

    const expectedEffect = { ...createAgentEffect("", context.directionType, context.payload, "Safe", false, null, ""), callId: context.toolCallId };

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext).toEqual({
      ...context,
      result: `'${context.directionType}' is addressed to the caller; awaiting its result.`,
      pendingEffect: expectedEffect,
      status: "AwaitingInput",
    });

    expect(loggingBrokerMock.logProcess).toHaveBeenCalledWith("Direction", `Caller tool '${context.directionType}' -> returned to the caller as a pending effect`);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock);
    verifyNoOtherCalls(executionOrchestrationServiceMock);
  });

  it("ShouldRecordFailureOnActIfToolThrowsAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const context = toolContext();
    const failure = new AgentOrchestrationDependencyException(createRandomString(), new Error(createRandomString()));
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.recordFailure.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockRejectedValue(failure);
    const expectedEffect = createAgentEffect("", context.directionType, context.payload, "Safe", false, null, "");

    // when
    const actTask = directionCoordinationService.act(context);

    // then
    const actualException = await actTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(Error);
    expect(perimeterOrchestrationServiceMock.recordFailure).toHaveBeenCalledWith(expectedEffect, failure.message);
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1, recordFailure: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock, { run: 1 });
  });

  it("ShouldNotRecordOutcomeOnActIfToolThrowsAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.recordFailure.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockRejectedValue(new AgentOrchestrationDependencyException(createRandomString(), new Error(createRandomString())));

    // when
    await directionCoordinationService.act(toolContext()).then(() => undefined, () => undefined);

    // then
    expect(perimeterOrchestrationServiceMock.recordOutcome).not.toHaveBeenCalled();
    verifyNoOtherCalls(perimeterOrchestrationServiceMock, { authorize: 1, claim: 1, recordFailure: 1 });
    verifyNoOtherCalls(executionOrchestrationServiceMock, { run: 1 });
  });

  it("ShouldAnswerTheCallOnActIfContextCarriesACallIdAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const context = { ...toolContext(), toolCallId: createRandomString() };
    const output = createRandomString();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(output);

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext.toolExchanges).toEqual([
      { callId: context.toolCallId, toolName: context.directionType, argumentsJson: context.payload, result: output },
    ]);
  });

  it("ShouldRecordWhatTheModelSaidBesideWhatItDidAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const said = createRandomString();
    const context = { ...toolContext(), toolCallId: createRandomString(), assistantContent: said };
    const output = createRandomString();
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(output);

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext.toolExchanges).toEqual([
      {
        callId: context.toolCallId,
        toolName: context.directionType,
        argumentsJson: context.payload,
        result: output,
        assistantContent: said,
      },
    ]);
  });

  it("ShouldLeaveTheAssistantContentOffAnExchangeTheModelSaidNothingForAsync", async () => {
    // given
    const { perimeterOrchestrationServiceMock, executionOrchestrationServiceMock, directionCoordinationService } =
      createDirectionCoordinationServiceTests();

    const context = { ...toolContext(), toolCallId: createRandomString() };
    perimeterOrchestrationServiceMock.authorize.mockResolvedValue(allow());
    perimeterOrchestrationServiceMock.claim.mockResolvedValue(proceed());
    perimeterOrchestrationServiceMock.recordOutcome.mockResolvedValue(undefined);
    executionOrchestrationServiceMock.run.mockResolvedValue(createRandomString());

    // when
    const actualContext = await directionCoordinationService.act(context);

    // then
    expect(actualContext.toolExchanges[0]).not.toHaveProperty("assistantContent");
  });

});
