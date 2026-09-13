import { describe, expect, it } from "vitest";

import { createRandomSkill, createSkillServiceTests, verifyNoOtherCalls } from "./SkillServiceTests.js";

describe("SkillService retrieveSkills logic", () => {
  it("ShouldRetrieveSkillsAsync", async () => {
    // given
    const { skillBrokerMock, loggingBrokerMock, skillService } = createSkillServiceTests();
    const retrievedSkill = createRandomSkill("00-skill.md");
    const expectedSkills = retrievedSkill.content;
    skillBrokerMock.selectSkills.mockResolvedValue([retrievedSkill]);

    // when
    const actualSkills = await skillService.retrieveSkills();

    // then
    expect(actualSkills).toBe(expectedSkills);
    verifyNoOtherCalls(skillBrokerMock, { selectSkills: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldComposeSkillsInNameOrderAsync", async () => {
    // given
    const { skillBrokerMock, loggingBrokerMock, skillService } = createSkillServiceTests();
    const firstSkill = createRandomSkill("a-first.md");
    const secondSkill = createRandomSkill("b-second.md");
    const expectedSkills = [firstSkill.content, secondSkill.content].join("\n\n");
    skillBrokerMock.selectSkills.mockResolvedValue([secondSkill, firstSkill]);

    // when
    const actualSkills = await skillService.retrieveSkills();

    // then
    expect(actualSkills).toBe(expectedSkills);
    verifyNoOtherCalls(skillBrokerMock, { selectSkills: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldRetrieveOnlyRoutedSkillWhenRouteIsGivenAsync", async () => {
    // given
    const { skillBrokerMock, loggingBrokerMock, skillService } = createSkillServiceTests();
    const identitySkill = createRandomSkill("identity-skill.md");
    const calculatorSkill = createRandomSkill("calculator-skill/SKILL.md");
    skillBrokerMock.selectSkills.mockResolvedValue([identitySkill, calculatorSkill]);

    // when
    const actualSkills = await skillService.retrieveSkills("calculator");

    // then
    expect(actualSkills).toBe(calculatorSkill.content);
    verifyNoOtherCalls(skillBrokerMock, { selectSkills: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

  it("ShouldRetrieveSkillCatalogAsync", async () => {
    // given
    const { skillBrokerMock, loggingBrokerMock, skillService } = createSkillServiceTests();
    const describedSkill = { ...createRandomSkill("b-described.md"), description: "Describes itself." };
    const undescribedSkill = createRandomSkill("a-silent.md");
    const expectedCatalog = `- ${describedSkill.name}: ${describedSkill.description}`;
    skillBrokerMock.selectSkills.mockResolvedValue([describedSkill, undescribedSkill]);

    // when
    const actualCatalog = await skillService.retrieveSkillCatalog();

    // then
    expect(actualCatalog).toBe(expectedCatalog);
    verifyNoOtherCalls(skillBrokerMock, { selectSkills: 1 });
    verifyNoOtherCalls(loggingBrokerMock);
  });

});
