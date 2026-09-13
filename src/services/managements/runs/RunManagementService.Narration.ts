import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { AgentStreamEvent } from "../../../models/clients/agents/AgentStreamEvent.js";
import type { ToolNarration } from "../../../models/coordinations/agents/ToolNarration.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import type { DecisionCoordinationService } from "../../coordinations/decision/DecisionCoordinationService.js";

// Narration (SPEC.md 6.0): the agent says what it is doing, in the user's language, on a typed
// channel of its own. Voiced here and nowhere else, so the gate calls and log lines are identical
// between a streamed and a batched run by construction; the batched door discards the event.

type Emit = (event: AgentStreamEvent) => Promise<void>;

// Model-authored narration is model output crossing to the user with no Judge and no Contract
// between them; the Gate is its only guardian, so it screens unconditionally. Withheld silently,
// recorded loudly: echoing the refusal would hand an injected SAY payload a visible oracle. The
// floor: a tool that declared its narration is voiced even when the model said nothing.
export async function voiceNarration(
  decisionCoordinationService: DecisionCoordinationService,
  loggingBroker: LoggingBroker,
  toolNarrations: ReadonlyMap<string, ToolNarration>,
  context: AgentContext,
  emit: Emit,
  modelNarrationVoicedLive = false,
): Promise<void> {
  if (context.narration.trim().length === 0) {
    const declared = toolNarrations.get(context.directionType);

    if (declared !== undefined && declared.starting.trim().length > 0) {
      const prose = declared.starting.replaceAll("{tool}", context.directionType).replaceAll("{payload}", context.payload);
      await loggingBroker.logPayload("Direction", "Narration", prose, true);
      await emit({ type: "Narration", content: prose });
    }

    return;
  }

  // On the streamed door every line was screened and voiced, or screened and withheld, as it
  // arrived. Saying it again here would double what the user reads.
  if (modelNarrationVoicedLive) {
    return;
  }

  const verdict = await decisionCoordinationService.screen(context.narration);

  if (isRefusal(verdict)) {
    await loggingBroker.logProcess("Direction", `Narration -> WITHHELD: ${verdict}`);

    return;
  }

  await loggingBroker.logPayload("Direction", "Narration", context.narration, true);
  await emit({ type: "Narration", content: context.narration });
}

// The observed slot: voiced after the result has been screened, immediately before the Tool
// event that carries the data. Never overridden by model narration; a SAY line speaks for the
// act, not for its outcome.
export async function voiceObservedNarration(
  loggingBroker: LoggingBroker,
  toolNarrations: ReadonlyMap<string, ToolNarration>,
  context: AgentContext,
  emit: Emit,
): Promise<void> {
  const declared = toolNarrations.get(context.directionType);

  if (declared === undefined || declared.observed.trim().length === 0) {
    return;
  }

  const prose = declared.observed.replaceAll("{tool}", context.directionType);
  await loggingBroker.logProcess("Direction", `Narration -> ${prose}`, true);
  await emit({ type: "Narration", content: prose });
}

export function isRefusal(verdict: string): boolean {
  return verdict.trimStart().toLowerCase().startsWith("refuse");
}

// Narration voiced line by line as the model writes it (SPEC.md 6.0, Invariant 5). The guarantee
// is that nothing is voiced before the Gate has seen it, and a stream cannot be screened after
// the fact, so the line is the unit: pieces accumulate until a line is complete, that line is
// screened, and only then does anybody read it.
//
// A line the Gate refuses is withheld silently and recorded loudly, exactly as a whole narration
// is, because echoing the refusal would hand an injected SAY payload a visible oracle. The rest
// of the narration keeps flowing: one refused line is not a reason to silence the agent.
export interface LiveNarrator {
  accept(piece: string): Promise<void>;
  flush(): Promise<void>;
  readonly narrated: boolean;
}

export function createLiveNarrator(
  decisionCoordinationService: DecisionCoordinationService,
  loggingBroker: LoggingBroker,
  emit: Emit,
): LiveNarrator {
  let buffer = "";
  let narrated = false;

  const voiceLine = async (line: string): Promise<void> => {
    if (line.trim().length === 0) {
      return;
    }

    // Recorded as narrated whatever the verdict, because the model did narrate and the batched
    // path must not say it again on its behalf.
    narrated = true;
    const verdict = await decisionCoordinationService.screen(line);

    if (isRefusal(verdict)) {
      await loggingBroker.logProcess("Direction", `Narration -> WITHHELD: ${verdict}`);

      return;
    }

    await loggingBroker.logPayload("Direction", "Narration", line, true);
    await emit({ type: "Narration", content: line });
  };

  return {
    get narrated(): boolean {
      return narrated;
    },

    async accept(piece: string): Promise<void> {
      buffer += piece;

      for (let newline = buffer.indexOf("\n"); newline >= 0; newline = buffer.indexOf("\n")) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        await voiceLine(line);
      }
    },

    // A model that narrates without a trailing newline still said something. The turn ending is
    // the boundary the last line was missing.
    async flush(): Promise<void> {
      const line = buffer;
      buffer = "";
      await voiceLine(line);
    },
  };
}
