import { describe, expect, it } from "vitest";

import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import { ExternalToolDependencyException } from "../../../../models/foundations/externalTools/exceptions/ExternalToolDependencyException.js";
import { catalogLine, createRandomString, createRandomTool, createRetrievalOrchestrationServiceTests, verifyNoOtherCalls } from "./RetrievalOrchestrationServiceTests.js";

describe("RetrievalOrchestrationService retrieveInstructions logic", () => {
  it("ShouldRetrieveInstructionsAsync", async () => {
    // given
    const { skillServiceMock, knowledgeServiceMock, externalToolServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests();

    const route = createRandomString();
    const expectedInstructions = createRandomString();
    skillServiceMock.retrieveSkills.mockResolvedValue(expectedInstructions);

    // when
    const actualInstructions = await retrievalOrchestrationService.retrieveInstructions(route);

    // then
    expect(actualInstructions).toBe(expectedInstructions);
    expect(skillServiceMock.retrieveSkills).toHaveBeenCalledWith(route);
    verifyNoOtherCalls(skillServiceMock, { retrieveSkills: 1 });
    verifyNoOtherCalls(knowledgeServiceMock);
    verifyNoOtherCalls(externalToolServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldExpandToolsMarkerOnRetrieveInstructionsAsync", async () => {
    // given
    const localCatalog = `- ${createRandomString()}: ${createRandomString()} parameters: {}`;

    const { skillServiceMock, knowledgeServiceMock, externalToolServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests(localCatalog);

    const describedTool = createRandomTool();
    const undescribedTool = createRandomTool("");
    const skills = `Use the tools below.\n{{tools}}\nThat is all.`;
    const expectedInstructions = `Use the tools below.\n${localCatalog}\n${catalogLine(describedTool)}\nThat is all.`;
    skillServiceMock.retrieveSkills.mockResolvedValue(skills);
    externalToolServiceMock.retrieveTools.mockResolvedValue([describedTool, undescribedTool]);

    // when
    const actualInstructions = await retrievalOrchestrationService.retrieveInstructions("");

    // then
    expect(actualInstructions).toBe(expectedInstructions);
    verifyNoOtherCalls(skillServiceMock, { retrieveSkills: 1 });
    verifyNoOtherCalls(externalToolServiceMock, { retrieveTools: 1 });
    verifyNoOtherCalls(knowledgeServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldRenderOnlyOfferedToolsOnRetrieveInstructionsIfRunHasSelectionAsync", async () => {
    // given
    const offeredLocalName = createRandomString();
    const withheldLocalName = createRandomString();
    const offeredLocalLine = `- ${offeredLocalName}: offered parameters: {}`;
    const withheldLocalLine = `- ${withheldLocalName}: withheld parameters: {}`;
    const wholeCatalog = `${offeredLocalLine}\n${withheldLocalLine}`;

    const entries = new Map<string, string>([
      [offeredLocalName, offeredLocalLine],
      [withheldLocalName, withheldLocalLine],
    ]);

    const { skillServiceMock, externalToolServiceMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests(wholeCatalog, entries);

    const offeredRemote = createRandomTool();
    const withheldRemote = createRandomTool();
    skillServiceMock.retrieveSkills.mockResolvedValue("{{tools}}");
    externalToolServiceMock.retrieveTools.mockResolvedValue([offeredRemote, withheldRemote]);
    const expectedInstructions = `${offeredLocalLine}\n${catalogLine(offeredRemote)}`;

    // when
    const actualInstructions = await AgentRun.begin(null, undefined, async () => {
      const run = AgentRun.current();

      if (run !== null) {
        run.offeredTools = [offeredLocalName.toUpperCase(), offeredRemote.name];
      }

      return await retrievalOrchestrationService.retrieveInstructions("");
    });

    // then
    expect(actualInstructions).toBe(expectedInstructions);
    verifyNoOtherCalls(skillServiceMock, { retrieveSkills: 1 });
    verifyNoOtherCalls(externalToolServiceMock, { retrieveTools: 1 });
  });

  it("ShouldDegradeToLocalCatalogOnRetrieveInstructionsIfDiscoveryFailsAsync", async () => {
    // given
    const localCatalog = `- ${createRandomString()}: ${createRandomString()} parameters: {}`;

    const { skillServiceMock, externalToolServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests(localCatalog);

    const discoveryFailure = new ExternalToolDependencyException(createRandomString(), new Error(createRandomString()));
    skillServiceMock.retrieveSkills.mockResolvedValue("{{tools}}");
    externalToolServiceMock.retrieveTools.mockRejectedValue(discoveryFailure);

    // when
    const firstInstructions = await retrievalOrchestrationService.retrieveInstructions("");
    const secondInstructions = await retrievalOrchestrationService.retrieveInstructions("");

    // then
    expect(firstInstructions).toBe(localCatalog);
    expect(secondInstructions).toBe(localCatalog);
    verifyNoOtherCalls(skillServiceMock, { retrieveSkills: 2 });
    verifyNoOtherCalls(externalToolServiceMock, { retrieveTools: 2 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldExpandSkillsMarkerOnRetrieveInstructionsAsync", async () => {
    // given
    const { skillServiceMock, externalToolServiceMock, loggingBrokerMock, retrievalOrchestrationService } =
      createRetrievalOrchestrationServiceTests();

    const skillCatalog = `- ${createRandomString()}: ${createRandomString()}`;
    skillServiceMock.retrieveSkills.mockResolvedValue("Skills:\n{{skills}}");
    skillServiceMock.retrieveSkillCatalog.mockResolvedValue(skillCatalog);

    // when
    const actualInstructions = await retrievalOrchestrationService.retrieveInstructions("");

    // then
    expect(actualInstructions).toBe(`Skills:\n${skillCatalog}`);
    verifyNoOtherCalls(skillServiceMock, { retrieveSkills: 1, retrieveSkillCatalog: 1 });
    verifyNoOtherCalls(externalToolServiceMock);
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
