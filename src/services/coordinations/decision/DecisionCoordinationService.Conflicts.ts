import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";

// A direct contradiction across the active skills (SPEC.md 4.5), settled before the Brain is
// asked: a remembered preference follows it, a choice in the prompt learns it, and anything else
// asks the user rather than guessing.

const CONFLICT_PREFIX = "CONFLICT:";
const CONFLICT_OPTION_SEPARATOR = "||";
const CONFLICT_LABEL_SEPARATOR = "|";
const PREFERENCE_PREFIX = "SKILL_PREFERENCE::";
const RESPOND_INTENT = "Respond";
const RETURN_RESPONSE_DIRECTION = "ReturnResponse";
const AWAIT_INPUT_DIRECTION = "AwaitInput";

interface SkillDirective {
  readonly skill: string;
  readonly instruction: string;
}

export interface ConflictResolution {
  readonly context: AgentContext;
  readonly isTerminal: boolean;
}

export async function resolveSkillConflict(
  context: AgentContext,
  detectConflict: (instructions: string) => Promise<string>,
): Promise<ConflictResolution> {
  if (context.systemPrompt.trim().length === 0) {
    return { context, isTerminal: false };
  }

  const verdict = await detectConflict(context.systemPrompt);
  const options = parseConflict(verdict);

  if (options === null) {
    return { context, isTerminal: false };
  }

  const key = conflictKey(options);
  const preferred = findPreference(context.observations, key);

  if (preferred !== null) {
    return {
      context: {
        ...context,
        observations: [
          ...context.observations,
          `The user resolved a skill conflict in favor of '${preferred}'; follow it and ignore the conflicting instruction.`,
        ],
      },
      isTerminal: false,
    };
  }

  const chosen = options.find((option) => context.prompt.toLowerCase().includes(option.skill.toLowerCase()));

  if (chosen !== undefined) {
    return {
      context: {
        ...context,
        intent: RESPOND_INTENT,
        directionType: RETURN_RESPONSE_DIRECTION,
        payload: `Understood, I'll follow '${chosen.skill}' for that from now on.`,
        remember: `${PREFERENCE_PREFIX}${key}::${chosen.skill}`,
        rawReply: verdict,
      },
      isTerminal: true,
    };
  }

  return {
    context: {
      ...context,
      intent: AWAIT_INPUT_DIRECTION,
      directionType: AWAIT_INPUT_DIRECTION,
      payload: `Your skills give conflicting instructions. Should I follow: ${options.map((option) => option.skill).join(" or ")}?`,
      rawReply: verdict,
    },
    isTerminal: true,
  };
}

function parseConflict(verdict: string): readonly SkillDirective[] | null {
  const trimmed = verdict.trim();

  if (trimmed.slice(0, CONFLICT_PREFIX.length).toUpperCase() !== CONFLICT_PREFIX) {
    return null;
  }

  const options = trimmed
    .slice(CONFLICT_PREFIX.length)
    .split(CONFLICT_OPTION_SEPARATOR)
    .map((option) => option.trim())
    .filter((option) => option.length > 0)
    .map(toDirective);

  return options.length >= 2 ? options : null;
}

function toDirective(option: string): SkillDirective {
  const separator = option.indexOf(CONFLICT_LABEL_SEPARATOR);

  return separator < 0
    ? { skill: option, instruction: option }
    : { skill: option.slice(0, separator).trim(), instruction: option.slice(separator + 1).trim() };
}

function conflictKey(options: readonly SkillDirective[]): string {
  return options
    .map((option) => option.skill.trim().toLowerCase())
    .sort()
    .join("|");
}

function findPreference(observations: readonly string[], key: string): string | null {
  const prefix = `${PREFERENCE_PREFIX}${key}::`;
  const record = [...observations].reverse().find((observation) => observation.toLowerCase().startsWith(prefix.toLowerCase()));

  return record === undefined ? null : record.slice(prefix.length);
}
