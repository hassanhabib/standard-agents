import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import type { ToolExchange } from "../../../models/orchestrations/agents/ToolExchange.js";
import type { DecisionCoordinationService } from "../../coordinations/decision/DecisionCoordinationService.js";
import { isRefusal } from "./RunManagementService.Narration.js";

// Untrusted inbound (SPEC.md 4.9). A tool result is the classic indirect-injection carrier. What
// may enter the context between turns is the loop's question, and the loop is the only place
// that sees both natures: Direction performs the act, Decision judges the text.
export async function screened(
  decisionCoordinationService: DecisionCoordinationService,
  loggingBroker: LoggingBroker,
  screenToolOutput: boolean,
  acted: AgentContext,
  observedBefore: number,
): Promise<AgentContext> {
  const nothingWasObserved = acted.observations.length <= observedBefore;

  if (!screenToolOutput || nothingWasObserved) {
    return acted;
  }

  const verdict = await decisionCoordinationService.screen(acted.result);

  if (!isRefusal(verdict)) {
    return acted;
  }

  // Refused, not dropped: the agent is told what happened so it can proceed differently.
  // Silently discarding the text would leave the model to conclude the tool returned nothing.
  const refusal = `the result of '${acted.directionType}' was refused by screening and withheld`;

  await loggingBroker.logPayload(
    "Direction",
    `Screening REFUSED the result of '${acted.directionType}'`,
    verdict.replace(/\r?\n/g, " ").trim(),
    false,
  );

  return {
    ...acted,
    result: refusal,
    observations: replacing(acted.observations, `${acted.directionType}: ${refusal}`),
    toolExchanges: answering(acted.toolExchanges, refusal),
  };
}

// Direction appended exactly one observation for the act it just performed, so refusing it means
// replacing that one rather than appending beside it.
function replacing(observations: readonly string[], withheld: string): readonly string[] {
  return [...observations.slice(0, -1), withheld];
}

// A call the model made gets an answer, whatever the answer is; a withheld result is an answer.
function answering(exchanges: readonly ToolExchange[], refusal: string): readonly ToolExchange[] {
  const stranded = exchanges[exchanges.length - 1];

  if (stranded === undefined) {
    return exchanges;
  }

  return [...exchanges.slice(0, -1), { ...stranded, result: refusal }];
}
