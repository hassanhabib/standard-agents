import type { Skill } from "../../models/foundations/skills/Skill.js";
import type { SkillBroker } from "./SkillBroker.js";

// The Custom mode of the skill source (SPEC.md 4.8): a host-supplied function.
export class FunctionSkillBroker implements SkillBroker {
  private readonly select: () => Promise<readonly Skill[]>;

  public constructor(select: () => Promise<readonly Skill[]>) {
    this.select = select;
  }

  public async selectSkills(): Promise<readonly Skill[]> {
    return await this.select();
  }
}
