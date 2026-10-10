import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { McpTool } from "../../../models/brokers/mcps/McpTool.js";
import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import type { KnowledgeResult } from "../../../models/foundations/knowledges/KnowledgeResult.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import type { RecollectionOrchestrationService } from "../../orchestrations/data/recollections/RecollectionOrchestrationService.js";
import type { RetrievalOrchestrationService } from "../../orchestrations/data/retrievals/RetrievalOrchestrationService.js";
import { createTryCatch, type TryCatch } from "./DataCoordinationService.Exceptions.js";
import { validateContext } from "./DataCoordinationService.Validations.js";

// The Data nature (SPEC.md 4.2): two regions, and the composing that belongs to neither of them.
// Retrieval brings authored material selected by relevance; Recollection brings what the agent
// accumulated. Deciding that both land in one system prompt and one observation list is this
// tier's job, because it is the only place that can see both.
export class DataCoordinationService {
  private readonly retrievalOrchestrationService: RetrievalOrchestrationService;
  private readonly recollectionOrchestrationService: RecollectionOrchestrationService;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(
    retrievalOrchestrationService: RetrievalOrchestrationService,
    recollectionOrchestrationService: RecollectionOrchestrationService,
    loggingBroker: LoggingBroker,
  ) {
    this.retrievalOrchestrationService = retrievalOrchestrationService;
    this.recollectionOrchestrationService = recollectionOrchestrationService;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  public recall(context: AgentContext): Promise<AgentContext> {
    return this.tryCatch(async () => {
      validateContext(context);

      // Announced before anything is fetched, so the trace reads in the order things happened.
      await this.loggingBroker.logPayload("Data", "Received prompt", context.prompt, false);

      const instructions = await this.retrievalOrchestrationService.retrieveInstructions(context.route);
      const systemPrompt = withCallerVocabulary(instructions, context);
      const memories = await this.recollectionOrchestrationService.recallMemories();
      const knowledge = await this.retrievalOrchestrationService.retrieveGrounding(context.prompt);

      await this.loggingBroker.logPayload("Data", "System prompt sent to Decision", systemPrompt, true);

      return {
        ...context,
        systemPrompt,
        observations: [...context.observations, ...memories, ...knowledge.map((knowledgeResult) => knowledgeResult.text)],
        groundingSources: withGroundingSources(context.groundingSources, knowledge),
      };
    });
  }

  public remember(memory: string): Promise<void> {
    return this.tryCatch(async () => {
      await this.recollectionOrchestrationService.remember(memory);
    });
  }

  public recallSession(sessionId: string): Promise<AgentSession | null> {
    return this.tryCatch(async () => await this.recollectionOrchestrationService.recallSession(sessionId));
  }

  public recordSession(session: AgentSession): Promise<void> {
    return this.tryCatch(async () => {
      await this.recollectionOrchestrationService.recordSession(session);
    });
  }

  // The remote tools the servers offer: part of what the agent has, so the loop can judge them
  // with the local tools when it decides what a run is offered (SPEC.md 4.15).
  public retrieveRemoteTools(): Promise<readonly McpTool[]> {
    return this.tryCatch(async () => await this.retrievalOrchestrationService.retrieveRemoteTools());
  }
}

// Each source once, in the order first recalled, and never an empty one: a passage whose origin is
// unknown can never be cited (SPEC.md 3.2, 3.7). Recall runs every turn, so what an earlier turn
// recalled is already here and keeps its place.
function withGroundingSources(groundingSources: readonly string[], knowledge: readonly KnowledgeResult[]): string[] {
  const recalledSources = knowledge
    .map((knowledgeResult) => knowledgeResult.source)
    .filter((source) => source.trim().length > 0);

  return [...new Set([...groundingSources, ...recalledSources])];
}

// The caller's vocabulary, appended per run (SPEC.md 6.1), in the same line format the tool
// catalog uses, under a heading that says who executes: the model may name these words, and the
// agent never runs one. A call naming a caller tool is a terminal answer addressed to the caller.
function withCallerVocabulary(systemPrompt: string, context: AgentContext): string {
  const callerTools = context.inference?.callerTools ?? [];

  if (callerTools.length === 0) {
    return systemPrompt;
  }

  const lines = callerTools.map((tool) => `- ${tool.name}: ${tool.description} parameters: ${tool.parametersJson}`);

  return (
    `${systemPrompt}\n\nThe caller also accepts these tool calls. Invoke them exactly like tools; ` +
    `the caller executes them, not you:\n${lines.join("\n")}`
  );
}
