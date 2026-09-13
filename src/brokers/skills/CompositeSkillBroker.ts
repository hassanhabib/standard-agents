import type { Skill } from "../../models/foundations/skills/Skill.js";
import type { SkillBroker } from "./SkillBroker.js";

// Many skill sources, one stream (SPEC.md 4.8): a broker holding brokers only because it
// implements the interface it takes.
export class CompositeSkillBroker implements SkillBroker {
  private readonly brokers: readonly SkillBroker[];

  public constructor(brokers: readonly SkillBroker[]) {
    this.brokers = brokers;
  }

  public async selectSkills(): Promise<readonly Skill[]> {
    const selections = await Promise.all(this.brokers.map((broker) => broker.selectSkills()));

    return selections.flat();
  }
}
