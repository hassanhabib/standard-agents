import type { Skill } from "../../models/foundations/skills/Skill.js";

// The Data nature's skill source (SPEC.md 4.1, 8.1).
export interface SkillBroker {
  selectSkills(): Promise<readonly Skill[]>;
}
