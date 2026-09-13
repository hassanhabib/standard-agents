import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { SkillBroker } from "../../../brokers/skills/SkillBroker.js";
import type { Skill } from "../../../models/foundations/skills/Skill.js";
import { createTryCatch, type TryCatch } from "./SkillService.Exceptions.js";

const SKILL_SEPARATOR = "\n\n";

// The Data nature's skill foundation (SPEC.md 4.2): one broker, the skills as the system prompt's
// instructions, with routing by name and the catalog for the {{skills}} marker.
export class SkillService {
  private readonly skillBroker: SkillBroker;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(skillBroker: SkillBroker, loggingBroker: LoggingBroker) {
    this.skillBroker = skillBroker;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public retrieveSkills(route = ""): Promise<string> {
    return this.tryCatch(async () => {
      const skills = await this.skillBroker.selectSkills();
      const selectedSkills = routedSkills(orderedByName(skills), route);

      return selectedSkills.map((skill) => skill.content).join(SKILL_SEPARATOR);
    });
  }

  public retrieveSkillCatalog(): Promise<string> {
    return this.tryCatch(async () => {
      const skills = await this.skillBroker.selectSkills();

      const catalogEntries = orderedByName(skills)
        .filter((skill) => skill.description.trim().length > 0)
        .map((skill) => `- ${skill.name}: ${skill.description}`);

      return catalogEntries.join("\n");
    });
  }
}

function orderedByName(skills: readonly Skill[]): readonly Skill[] {
  return [...skills].sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}

// A route narrows the skills to the ones whose name carries it; a route nothing matches leaves
// the whole set, so a bad route degrades to the default rather than to silence.
function routedSkills(skills: readonly Skill[], route: string): readonly Skill[] {
  if (route.trim().length === 0) {
    return skills;
  }

  const matching = skills.filter((skill) => skill.name.toLowerCase().includes(route.toLowerCase()));

  return matching.length > 0 ? matching : skills;
}
