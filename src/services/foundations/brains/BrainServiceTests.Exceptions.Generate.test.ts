import { describe, expect, it } from "vitest";

import { HttpResponseException } from "../../../models/brokers/https/HttpResponseException.js";
import { BusyBrainException } from "../../../models/foundations/brains/exceptions/BusyBrainException.js";
import { BrainDependencyException } from "../../../models/foundations/brains/exceptions/BrainDependencyException.js";
import { BrainDependencyValidationException } from "../../../models/foundations/brains/exceptions/BrainDependencyValidationException.js";
import { BrainServiceException } from "../../../models/foundations/brains/exceptions/BrainServiceException.js";
import { FailedBrainDependencyException } from "../../../models/foundations/brains/exceptions/FailedBrainDependencyException.js";
import { FailedBrainServiceException } from "../../../models/foundations/brains/exceptions/FailedBrainServiceException.js";
import { InvalidBrainException } from "../../../models/foundations/brains/exceptions/InvalidBrainException.js";
import { NotFoundBrainException } from "../../../models/foundations/brains/exceptions/NotFoundBrainException.js";
import { RefusedBrainException } from "../../../models/foundations/brains/exceptions/RefusedBrainException.js";
import { UnavailableBrainException } from "../../../models/foundations/brains/exceptions/UnavailableBrainException.js";
import { UnreachableBrainException } from "../../../models/foundations/brains/exceptions/UnreachableBrainException.js";
import { createBrainServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./BrainServiceTests.js";

describe("BrainService generate exceptions", () => {
  it("ShouldThrowDependencyValidationExceptionOnGenerateIfBadRequestErrorOccursAndLogItAsync", async () => {
    // given
    const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
    const responseBody = createRandomString();
    const badRequestException = new HttpResponseException(400, responseBody);

    const invalidBrainException = new InvalidBrainException(
      "Invalid brain request. Please correct the error and try again.",
    );

    invalidBrainException.upsertDataList("status", "400");
    invalidBrainException.upsertDataList("body", responseBody);

    const expectedBrainDependencyValidationException = new BrainDependencyValidationException(
      "Brain dependency validation error occurred, fix the error and try again.",
      invalidBrainException,
    );

    generatorBrokerMock.generate.mockRejectedValue(badRequestException);

    // when
    const generateTask = brainService.generate(createRandomString(), createRandomString());

    // then
    const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(BrainDependencyValidationException);
    expectSameExceptionAs(actualException, expectedBrainDependencyValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainDependencyValidationException);
    verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

  it.each([401, 403])(
    "ShouldThrowCriticalDependencyExceptionOnGenerateIfTheKeyIsRefusedAndSayItLastAsync (%i)",
    async (status) => {
      // given
      // Watched in both doors: the window said "HTTP 401" and the terminal said "contact support",
      // for a key the service would not take. The key is the thing to go and look at, and neither
      // sentence named it.
      const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
      const refusedException = new HttpResponseException(status, createRandomString());

      const refusedBrainException = new RefusedBrainException(
        `the model service did not accept this connection's key (${String(status)}). Check the key, and that it belongs to this service.`,
        refusedException,
      );

      const expectedBrainDependencyException = new BrainDependencyException(
        "Brain dependency error occurred, contact support.",
        new FailedBrainDependencyException("Failed brain dependency error occurred, contact support.", refusedBrainException),
      );

      generatorBrokerMock.generate.mockRejectedValue(refusedException);

      // when
      const generateTask = brainService.generate(createRandomString(), createRandomString());

      // then
      const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(BrainDependencyException);
      expectSameExceptionAs(actualException, expectedBrainDependencyException);
      expectSameExceptionAs(loggingBrokerMock.logCritical.mock.calls[0]?.[0], expectedBrainDependencyException);
      expect(innermostMessageOf(actualException)).toBe(refusedBrainException.message);
      verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
      verifyNoOtherCalls(loggingBrokerMock, { logCritical: 1 });
    },
  );

  it("ShouldThrowCriticalDependencyExceptionOnGenerateIfNothingThereAnswersChatAndSayItLastAsync", async () => {
    // given
    // A 404 from a chat route is an address that is not a chat endpoint, or a model that is not
    // installed where it was asked for. "HTTP 404" names neither.
    const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
    const notFoundException = new HttpResponseException(404, createRandomString());

    const notFoundBrainException = new NotFoundBrainException(
      "nothing at that address answers chat requests (404). Check the address, and that the model it names is installed there.",
      notFoundException,
    );

    const expectedBrainDependencyException = new BrainDependencyException(
      "Brain dependency error occurred, contact support.",
      new FailedBrainDependencyException("Failed brain dependency error occurred, contact support.", notFoundBrainException),
    );

    generatorBrokerMock.generate.mockRejectedValue(notFoundException);

    // when
    const generateTask = brainService.generate(createRandomString(), createRandomString());

    // then
    const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(BrainDependencyException);
    expectSameExceptionAs(actualException, expectedBrainDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logCritical.mock.calls[0]?.[0], expectedBrainDependencyException);
    expect(innermostMessageOf(actualException)).toBe(notFoundBrainException.message);
    verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logCritical: 1 });
  });

  // Localised rather than carried. What fetch says when it could not get a response at all is
  // "fetch failed", and that sentence rises through every tier above this one to whoever is
  // waiting, who is told the name of a browser API and nothing they can act on. The library knows
  // what it means and says it here, once, where the fault is recognised.
  it("ShouldThrowCriticalDependencyExceptionOnGenerateIfHttpRequestErrorOccursAndLogItAsync", async () => {
    // given
    const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
    const httpRequestException = new TypeError("fetch failed");

    const unreachableBrainException = new UnreachableBrainException(
      "nothing answered at that address. Check that it is right and that the service is running.",
      httpRequestException,
    );

    const failedBrainDependencyException = new FailedBrainDependencyException(
      "Failed brain dependency error occurred, contact support.",
      unreachableBrainException,
    );

    const expectedBrainDependencyException = new BrainDependencyException(
      "Brain dependency error occurred, contact support.",
      failedBrainDependencyException,
    );

    generatorBrokerMock.generate.mockRejectedValue(httpRequestException);

    // when
    const generateTask = brainService.generate(createRandomString(), createRandomString());

    // then
    const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(BrainDependencyException);
    expectSameExceptionAs(actualException, expectedBrainDependencyException);
    expectSameExceptionAs(loggingBrokerMock.logCritical.mock.calls[0]?.[0], expectedBrainDependencyException);

    // The last word, because that is the one a door reads. Every tier above this wraps a category
    // written for a log, so whoever is waiting is shown the bottom of the chain: if the native
    // fault is still hanging off the end of it, the sentence above is a sentence nobody sees.
    expect(innermostMessageOf(actualException)).toBe(
      "nothing answered at that address. Check that it is right and that the service is running.",
    );

    verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logCritical: 1 });
  });

  it.each([
    ["7", "Try again in 7 seconds."],
    [null, "Try again in a moment."],
  ])(
    "ShouldThrowDependencyExceptionOnGenerateIfTheServiceIsBusyAndSayHowLongToWaitAsync (%s)",
    async (retryAfter, wait) => {
      // given
      // A 429 is the service saying "not now", and usually saying for how long. Both doors showed
      // "HTTP 429", or "contact support", and the wait the service named was thrown away.
      const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
      const busyException = new HttpResponseException(429, createRandomString(), retryAfter);

      const busyBrainException = new BusyBrainException(
        `the model service is taking too many requests right now (429). ${wait}`,
        busyException,
      );

      const expectedBrainDependencyException = new BrainDependencyException(
        "Brain dependency error occurred, contact support.",
        new FailedBrainDependencyException("Failed brain dependency error occurred, contact support.", busyBrainException),
      );

      generatorBrokerMock.generate.mockRejectedValue(busyException);

      // when
      const generateTask = brainService.generate(createRandomString(), createRandomString());

      // then
      const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(BrainDependencyException);
      expectSameExceptionAs(actualException, expectedBrainDependencyException);
      expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainDependencyException);
      expect(innermostMessageOf(actualException)).toBe(busyBrainException.message);
      verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
    },
  );

  it.each([
    [503, "12", "Try again in 12 seconds."],
    [502, null, "Try again in a moment."],
    [504, null, "Try again in a moment."],
    [408, null, "Try again in a moment."],
  ])(
    "ShouldThrowDependencyExceptionOnGenerateIfTheServiceIsUnavailableAndSayItLastAsync (%i)",
    async (status, retryAfter, wait) => {
      // given
      // The service, or the gateway in front of it, cannot answer right now. Watched on a Host
      // restarting: the window said "HTTP 503", which is true and says nothing about waiting.
      const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
      const unavailableException = new HttpResponseException(status, createRandomString(), retryAfter);

      const unavailableBrainException = new UnavailableBrainException(
        `the model service is not available right now (${String(status)}). ${wait}`,
        unavailableException,
      );

      const expectedBrainDependencyException = new BrainDependencyException(
        "Brain dependency error occurred, contact support.",
        new FailedBrainDependencyException("Failed brain dependency error occurred, contact support.", unavailableBrainException),
      );

      generatorBrokerMock.generate.mockRejectedValue(unavailableException);

      // when
      const generateTask = brainService.generate(createRandomString(), createRandomString());

      // then
      const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(BrainDependencyException);
      expectSameExceptionAs(actualException, expectedBrainDependencyException);
      expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainDependencyException);
      expect(innermostMessageOf(actualException)).toBe(unavailableBrainException.message);
      verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
    },
  );

  it.each([500])(
    "ShouldThrowDependencyExceptionOnGenerateIfDependencyErrorOccursAndLogItAsync (%i)",
    async (status) => {
      // given
      const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
      const dependencyException = new HttpResponseException(status, createRandomString());

      const failedBrainDependencyException = new FailedBrainDependencyException(
        "Failed brain dependency error occurred, contact support.",
        dependencyException,
      );

      const expectedBrainDependencyException = new BrainDependencyException(
        "Brain dependency error occurred, contact support.",
        failedBrainDependencyException,
      );

      generatorBrokerMock.generate.mockRejectedValue(dependencyException);

      // when
      const generateTask = brainService.generate(createRandomString(), createRandomString());

      // then
      const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(BrainDependencyException);
      expectSameExceptionAs(actualException, expectedBrainDependencyException);
      expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainDependencyException);
      verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
      verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
    },
  );

  it("ShouldThrowServiceExceptionOnGenerateIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
    const serviceException = new Error(createRandomString());

    const failedBrainServiceException = new FailedBrainServiceException(
      "Failed brain service error occurred, contact support.",
      serviceException,
    );

    const expectedBrainServiceException = new BrainServiceException(
      "Brain service error occurred, contact support.",
      failedBrainServiceException,
    );

    generatorBrokerMock.generate.mockRejectedValue(serviceException);

    // when
    const generateTask = brainService.generate(createRandomString(), createRandomString());

    // then
    const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(BrainServiceException);
    expectSameExceptionAs(actualException, expectedBrainServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedBrainServiceException);
    verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});

// The same walk a door does: every tier wraps the one below it, and what a person is shown is the
// bottom of the chain, because the tiers above it are categories written for a log.
function innermostMessageOf(error: unknown): string {
  let said = "";

  for (let at = error as { message?: string; innerError?: unknown } | null | undefined; at !== null && at !== undefined; ) {
    said = (at.message ?? "").trim() || said;
    at = at.innerError as { message?: string; innerError?: unknown } | null | undefined;
  }

  return said;
}
