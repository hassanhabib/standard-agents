import { describe, expect, it } from "vitest";

import { ContractServiceException } from "../../../models/foundations/contracts/exceptions/ContractServiceException.js";
import { FailedContractServiceException } from "../../../models/foundations/contracts/exceptions/FailedContractServiceException.js";
import { createContractServiceTests, createRandomString, expectSameExceptionAs, verifyNoOtherCalls } from "./ContractServiceTests.js";

describe("ContractService check exceptions", () => {
  it("ShouldThrowServiceExceptionOnCheckIfServiceErrorOccursAndLogItAsync", async () => {
    // given
    const { contractBrokerMock, loggingBrokerMock, contractService } = createContractServiceTests();
    const serviceException = new Error(createRandomString());

    const failedContractServiceException = new FailedContractServiceException(
      "Failed contract service error occurred, contact support.",
      serviceException,
    );

    const expectedContractServiceException = new ContractServiceException(
      "Contract service error occurred, contact support.",
      failedContractServiceException,
    );

    contractBrokerMock.validate.mockRejectedValue(serviceException);

    // when
    const checkTask = contractService.check(createRandomString(), createRandomString());

    // then
    const actualException = await checkTask.then(() => undefined, (error: unknown) => error);

    expect(actualException).toBeInstanceOf(ContractServiceException);
    expectSameExceptionAs(actualException, expectedContractServiceException);
    expectSameExceptionAs(loggingBrokerMock.logError.mock.calls[0]?.[0], expectedContractServiceException);
    verifyNoOtherCalls(contractBrokerMock, { validate: 1 });
    verifyNoOtherCalls(loggingBrokerMock, { logError: 1 });
  });

});
