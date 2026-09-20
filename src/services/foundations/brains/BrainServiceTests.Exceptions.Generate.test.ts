import { describe, expect, it } from "vitest";

import { HttpResponseException } from "../../../models/brokers/https/HttpResponseException.js";
import { BrainDependencyException } from "../../../models/foundations/brains/exceptions/BrainDependencyException.js";
import { BrainDependencyValidationException } from "../../../models/foundations/brains/exceptions/BrainDependencyValidationException.js";
import { BrainServiceException } from "../../../models/foundations/brains/exceptions/BrainServiceException.js";
import { FailedBrainDependencyException } from "../../../models/foundations/brains/exceptions/FailedBrainDependencyException.js";
import { FailedBrainServiceException } from "../../../models/foundations/brains/exceptions/FailedBrainServiceException.js";
import { InvalidBrainException } from "../../../models/foundations/brains/exceptions/InvalidBrainException.js";
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

  it.each([401, 403, 404])(
    "ShouldThrowCriticalDependencyExceptionOnGenerateIfCriticalErrorOccursAndLogItAsync (%i)",
    async (status) => {
      // given
      const { generatorBrokerMock, loggingBrokerMock, brainService } = createBrainServiceTests();
      const criticalDependencyException = new HttpResponseException(status, createRandomString());

      const failedBrainDependencyException = new FailedBrainDependencyException(
        "Failed brain dependency error occurred, contact support.",
        criticalDependencyException,
      );

      const expectedBrainDependencyException = new BrainDependencyException(
        "Brain dependency error occurred, contact support.",
        failedBrainDependencyException,
      );

      generatorBrokerMock.generate.mockRejectedValue(criticalDependencyException);

      // when
      const generateTask = brainService.generate(createRandomString(), createRandomString());

      // then
      const actualException = await generateTask.then(() => undefined, (error: unknown) => error);

      expect(actualException).toBeInstanceOf(BrainDependencyException);
      expectSameExceptionAs(actualException, expectedBrainDependencyException);
      expectSameExceptionAs(loggingBrokerMock.logCritical.mock.calls[0]?.[0], expectedBrainDependencyException);
      verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
      verifyNoOtherCalls(loggingBrokerMock, { logCritical: 1 });
    },
  );

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
    verifyNoOtherCalls(generatorBrokerMock, { generate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logCritical: 1 });
  });

  it.each([500, 503, 429])(
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
