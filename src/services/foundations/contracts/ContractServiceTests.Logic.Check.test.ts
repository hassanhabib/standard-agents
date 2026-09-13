import { describe, expect, it } from "vitest";


import { createContractServiceTests, createRandomString, verifyNoOtherCalls } from "./ContractServiceTests.js";

describe("ContractService check logic", () => {
  it("ShouldCheckAsync", async () => {
    // given
    const { contractBrokerMock, loggingBrokerMock, contractService } = createContractServiceTests();
    const answer = createRandomString();
    const schema = createRandomString();
    const complaint = createRandomString();
    contractBrokerMock.validate.mockResolvedValue(complaint);

    // when
    const actualVerdict = await contractService.check(answer, schema);

    // then
    expect(actualVerdict).toEqual({ satisfied: false, reason: complaint });
    expect(contractBrokerMock.validate).toHaveBeenCalledWith(answer, schema);
    verifyNoOtherCalls(contractBrokerMock, { validate: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it.each(["", " "])("ShouldReturnUnconstrainedOnCheckIfSchemaIsEmptyAsync (%j)", async (emptySchema) => {
    // given
    const { contractBrokerMock, loggingBrokerMock, contractService } = createContractServiceTests();

    // when
    const actualVerdict = await contractService.check(createRandomString(), emptySchema);

    // then
    expect(actualVerdict).toEqual({ satisfied: true, reason: "" });
    verifyNoOtherCalls(contractBrokerMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
