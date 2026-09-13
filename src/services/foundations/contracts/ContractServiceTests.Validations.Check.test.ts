import { describe, expect, it } from "vitest";

import { ContractValidationException } from "../../../models/foundations/contracts/exceptions/ContractValidationException.js";
import { InvalidContractException } from "../../../models/foundations/contracts/exceptions/InvalidContractException.js";
import { createContractServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./ContractServiceTests.js";

describe("ContractService check validations", () => {
  it.each(["", " "])("ShouldThrowValidationExceptionOnCheckIfAnswerIsInvalidAndLogItAsync (%j)", async (invalidAnswer) => {
    // given
    const { contractBrokerMock, loggingBrokerMock, contractService } = createContractServiceTests();

    const invalidContractException = new InvalidContractException(
      "Invalid contract answer. Please correct the error and try again.",
    );

    const expectedContractValidationException = new ContractValidationException(
      "Contract validation error occurred, fix the error and try again.",
      invalidContractException,
    );

    // when
    const checkTask = contractService.check(invalidAnswer, createRandomString());

    // then
    const actualException = await checkTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(ContractValidationException);
    expectSameExceptionAs(actualException, expectedContractValidationException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedContractValidationException);
    verifyNoOtherCalls(contractBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
