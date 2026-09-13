import { describe, expect, it } from "vitest";

import type { McpTool } from "../../../models/brokers/mcps/McpTool.js";
import { createExternalToolServiceTests, createRandomString, verifyNoOtherCalls } from "./ExternalToolServiceTests.js";

describe("ExternalToolService retrieveTools logic", () => {
  it("ShouldRetrieveToolsAsync", async () => {
    // given
    const { mcpBrokerMock, loggingBrokerMock, externalToolService } = createExternalToolServiceTests();

    const expectedTools: McpTool[] = [
      { name: createRandomString(), description: createRandomString(), inputSchemaJson: "{}" },
      { name: createRandomString(), description: createRandomString(), inputSchemaJson: "{}" },
    ];

    mcpBrokerMock.listTools.mockResolvedValue(expectedTools);

    // when
    const actualTools = await externalToolService.retrieveTools();

    // then
    expect(actualTools).toEqual(expectedTools);
    verifyNoOtherCalls(mcpBrokerMock, { listTools: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
