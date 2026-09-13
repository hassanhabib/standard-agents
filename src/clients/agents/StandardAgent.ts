import type { ApprovalBroker } from "../../brokers/approvals/ApprovalBroker.js";
import { FunctionApprovalBroker } from "../../brokers/approvals/FunctionApprovalBroker.js";
import type { ClassifierBroker } from "../../brokers/classifiers/ClassifierBroker.js";
import { FunctionClassifierBroker } from "../../brokers/classifiers/FunctionClassifierBroker.js";
import type { ContractBroker } from "../../brokers/contracts/ContractBroker.js";
import type { EffectLedgerBroker } from "../../brokers/effects/EffectLedgerBroker.js";
import { FunctionGeneratorBroker } from "../../brokers/generators/FunctionGeneratorBroker.js";
import type { GeneratorBroker } from "../../brokers/generators/GeneratorBroker.js";
import type { GeneratorBrokerV1 } from "../../brokers/generators/GeneratorBrokerV1.js";
import { HttpGeneratorBrokerV1 } from "../../brokers/generators/HttpGeneratorBrokerV1.js";
import { HttpGeneratorBroker } from "../../brokers/generators/HttpGeneratorBroker.js";
import { FunctionKnowledgeBroker } from "../../brokers/knowledges/FunctionKnowledgeBroker.js";
import type { KnowledgeBroker } from "../../brokers/knowledges/KnowledgeBroker.js";
import type { LoggingBroker } from "../../brokers/loggings/LoggingBroker.js";
import { StreamLoggingBroker } from "../../brokers/loggings/StreamLoggingBroker.js";
import type { McpBroker } from "../../brokers/mcps/McpBroker.js";
import { FunctionMemoryBroker } from "../../brokers/memorys/FunctionMemoryBroker.js";
import type { MemoryBroker } from "../../brokers/memorys/MemoryBroker.js";
import { FunctionPolicyBroker } from "../../brokers/policies/FunctionPolicyBroker.js";
import type { PolicyBroker } from "../../brokers/policies/PolicyBroker.js";
import type { SessionBroker } from "../../brokers/sessions/SessionBroker.js";
import { FileSkillBroker } from "../../brokers/skills/FileSkillBroker.js";
import { FunctionSkillBroker } from "../../brokers/skills/FunctionSkillBroker.js";
import type { SkillBroker } from "../../brokers/skills/SkillBroker.js";
import { RatioUsageBroker } from "../../brokers/usages/RatioUsageBroker.js";
import type { UsageBroker } from "../../brokers/usages/UsageBroker.js";
import { FunctionVerifierBroker } from "../../brokers/verifiers/FunctionVerifierBroker.js";
import type { VerifierBroker } from "../../brokers/verifiers/VerifierBroker.js";
import { createAgentConfiguration, type AgentConfiguration } from "../../models/clients/agents/AgentConfiguration.js";
import type { AgentOutcome } from "../../models/clients/agents/AgentOutcome.js";
import type { AgentStreamEvent } from "../../models/clients/agents/AgentStreamEvent.js";
import { createPromptRequest, type PromptRequest } from "../../models/clients/agents/PromptRequest.js";
import { createAgentBudget, type AgentBudget } from "../../models/coordinations/agents/AgentBudget.js";
import type { PrincipalResolver } from "../../models/coordinations/agents/PrincipalResolver.js";
import type { ToolSelector } from "../../models/coordinations/agents/ToolSelector.js";
import type { Skill } from "../../models/foundations/skills/Skill.js";
import type { TraceVerbosity } from "../../models/loggings/TraceVerbosity.js";
import { DEFAULT_MAX_HISTORY_TURNS } from "../../models/managements/runs/RunOptions.js";
import type { AgentEffect } from "../../models/orchestrations/effects/AgentEffect.js";
import type { ApprovalVerdict } from "../../models/orchestrations/effects/ApprovalVerdict.js";
import type { AuthorizationDecision } from "../../models/orchestrations/effects/AuthorizationDecision.js";
import type { PermissionMode } from "../../models/orchestrations/effects/PermissionMode.js";
import type { RiskLevel } from "../../models/orchestrations/effects/RiskLevel.js";
import type { RunManagementService } from "../../services/managements/runs/RunManagementService.js";
import type { Tool } from "../../tools/Tool.js";
import { compose } from "./StandardAgent.Composition.js";
import { validateApiUrl, validateBudget } from "./StandardAgent.Validations.js";

// The client (SPEC.md 4.8, 8.1): the builder verbs a host composes an agent with, and the doors a
// prompt enters by. The verbs record; the composition partial turns the record into the graph,
// once, and every verb drops that graph so a change made after a prompt still takes effect. One
// instance serves prompts concurrently; nothing here is per prompt.
export class StandardAgent {
  private readonly configuration: AgentConfiguration = createAgentConfiguration();
  private composed: RunManagementService | null = null;

  public constructor();
  public constructor(apiUrl: string, apiKey: string, model: string);
  public constructor(apiUrl?: string, apiKey?: string, model?: string) {
    if (apiUrl !== undefined && apiKey !== undefined && model !== undefined) {
      this.brain(apiUrl, apiKey, model);
    }
  }

  // Decision: the brain, in its three modes (SPEC.md 4.8). External is an OpenAI-compatible
  // endpoint; Custom is the host's own broker or function.
  public brain(apiUrl: string, apiKey: string, model: string, temperature: number | null = null, maxTokens: number | null = null): this {
    validateApiUrl(apiUrl);

    return this.set((configuration) => {
      configuration.generatorBroker = new HttpGeneratorBroker(apiUrl, apiKey, model);
      configuration.configuredTemperature = temperature;
      configuration.configuredMaxTokens = maxTokens;
    });
  }

  public useGenerator(broker: GeneratorBroker): this {
    return this.set((configuration) => {
      configuration.generatorBroker = broker;
    });
  }

  // One endpoint, both doors. The same OpenAI-compatible base answers a native turn and a text
  // turn, so a caller that names an endpoint gets a composition that can hold either conversation
  // rather than one that fails the first time something asks for the other.
  //
  // It carries the same two bounds brain() does, and for the same reason. Naming an endpoint used
  // to mean accepting the framework's thousand-token default whatever the deployment meant: enough
  // for a chat answer, and not enough for a turn whose tool call carries a file, which arrived at
  // the tool ending mid-argument.
  public nativeBrain(
    apiUrl: string,
    apiKey: string,
    model: string,
    temperature: number | null = null,
    maxTokens: number | null = null,
  ): this {
    validateApiUrl(apiUrl);

    return this.set((configuration) => {
      configuration.generatorBroker = new HttpGeneratorBroker(apiUrl, apiKey, model);
      configuration.generatorBrokerV1 = new HttpGeneratorBrokerV1(apiUrl, apiKey, model);
      configuration.configuredTemperature = temperature;
      configuration.configuredMaxTokens = maxTokens;
    });
  }

  // Decision: the native brain (SPEC.md 6.2). A composition that has one holds the conversation as
  // messages and offers its tools as schemas; one that has only the text brain keeps saying
  // ACTION and FINAL. Both doors can be present, and the brain service picks by asking whether
  // there is a native one rather than by guessing from a nullable field.
  public useNativeGenerator(broker: GeneratorBrokerV1): this {
    return this.set((configuration) => {
      configuration.generatorBrokerV1 = broker;
    });
  }

  public onBrain(generate: (systemPrompt: string, userPrompt: string) => Promise<string>): this {
    return this.useGenerator(new FunctionGeneratorBroker(generate));
  }

  // Data: skills, from a folder of Markdown files or from the host (SPEC.md 4.2).
  public skills(path: string): this {
    return this.useSkills(new FileSkillBroker(path));
  }

  public useSkills(broker: SkillBroker): this {
    return this.set((configuration) => {
      configuration.skillSources.push(broker);
    });
  }

  public onSkills(select: () => Promise<readonly Skill[]>): this {
    return this.useSkills(new FunctionSkillBroker(select));
  }

  // Direction: the tools the agent may run (SPEC.md 6.1). A description is the advertisement
  // opt-in; a tool without one stays callable but is never listed to the Brain.
  public tool(tool: Tool): this {
    return this.set((configuration) => {
      configuration.tools.push(tool);
    });
  }

  public tools(tools: readonly Tool[]): this {
    return this.set((configuration) => {
      configuration.tools.push(...tools);
    });
  }

  // Decision: the guardians (SPEC.md 4.5). A Gate verdict beginning with "refuse" refuses the
  // prompt; a Judge verdict is a score, the reason after it.
  public useGate(broker: ClassifierBroker): this {
    return this.set((configuration) => {
      configuration.classifierBroker = broker;
    });
  }

  public onGate(screen: (input: string) => Promise<string>): this {
    return this.useGate(new FunctionClassifierBroker(screen));
  }

  public useJudge(broker: VerifierBroker): this {
    return this.set((configuration) => {
      configuration.verifierBroker = broker;
    });
  }

  public onJudge(evaluate: (task: string, candidate: string) => Promise<string>): this {
    return this.useJudge(new FunctionVerifierBroker(evaluate));
  }

  // Decision: the Contract (SPEC.md 4.13). The configured schema is hard configuration: a
  // request's schema never displaces it.
  public contract(jsonSchema: string): this {
    return this.set((configuration) => {
      configuration.contractSchema = jsonSchema;
    });
  }

  public useContract(broker: ContractBroker): this {
    return this.set((configuration) => {
      configuration.contractBroker = broker;
    });
  }

  // Data: memory, knowledge, sessions and remote tools (SPEC.md 4.2, 4.8, 4.11).
  public useMemory(broker: MemoryBroker): this {
    return this.set((configuration) => {
      configuration.memoryBroker = broker;
    });
  }

  public onMemory(select: () => Promise<readonly string[]>, insert: (memory: string) => Promise<void>): this {
    return this.useMemory(new FunctionMemoryBroker(select, insert));
  }

  public useKnowledge(broker: KnowledgeBroker): this {
    return this.set((configuration) => {
      configuration.knowledgeBroker = broker;
    });
  }

  public onKnowledge(retrieve: (query: string) => Promise<readonly string[]>): this {
    return this.useKnowledge(new FunctionKnowledgeBroker(retrieve));
  }

  public useSessions(broker: SessionBroker, maxHistoryTurns = DEFAULT_MAX_HISTORY_TURNS): this {
    return this.set((configuration) => {
      configuration.sessionBroker = broker;
      configuration.maxHistoryTurns = maxHistoryTurns;
    });
  }

  public useMcp(broker: McpBroker): this {
    return this.set((configuration) => {
      configuration.mcpBroker = broker;
    });
  }

  // Direction: the perimeter (SPEC.md 4.9). An allow-list entry is a tool name, or a tool name
  // and a scope prefix separated by a colon.
  public allowTools(...toolNames: readonly string[]): this {
    return this.set((configuration) => {
      configuration.allowedTools = [...toolNames];
    });
  }

  public usePolicy(broker: PolicyBroker): this {
    return this.set((configuration) => {
      configuration.policyBroker = broker;
    });
  }

  public onPolicy(authorize: (effect: AgentEffect) => Promise<AuthorizationDecision>): this {
    return this.usePolicy(new FunctionPolicyBroker(authorize));
  }

  public requireApproval(...toolNames: readonly string[]): this {
    return this.set((configuration) => {
      configuration.approvalRequiredTools = [...toolNames];
    });
  }

  public useApprovals(broker: ApprovalBroker): this {
    return this.set((configuration) => {
      configuration.approvalBroker = broker;
    });
  }

  public onApproval(request: (effect: AgentEffect) => Promise<ApprovalVerdict>): this {
    return this.useApprovals(new FunctionApprovalBroker(request));
  }

  public useEffectLedger(broker: EffectLedgerBroker): this {
    return this.set((configuration) => {
      configuration.effectLedgerBroker = broker;
    });
  }

  public effectLease(milliseconds: number): this {
    return this.set((configuration) => {
      configuration.effectLeaseMilliseconds = milliseconds;
    });
  }

  public permissions(mode: PermissionMode): this {
    return this.set((configuration) => {
      configuration.permissionMode = mode;
    });
  }

  public risk(level: RiskLevel, ...toolNames: readonly string[]): this {
    return this.set((configuration) => {
      for (const toolName of toolNames) {
        configuration.declaredRisk.set(toolName, level);
      }
    });
  }

  public principal(resolver: PrincipalResolver): this {
    return this.set((configuration) => {
      configuration.principalResolver = resolver;
    });
  }

  // Selection (SPEC.md 4.15): what a run is offered, and whether the offering binds.
  public onSelectTools(selector: ToolSelector): this {
    return this.set((configuration) => {
      configuration.toolSelector = selector;
    });
  }

  public enforceSelection(): this {
    return this.set((configuration) => {
      configuration.enforceSelection = true;
    });
  }

  public screenToolOutput(): this {
    return this.set((configuration) => {
      configuration.screenToolOutput = true;
    });
  }

  // The loop's bounds (SPEC.md 4.10).
  public maxTurns(turns: number): this {
    return this.set((configuration) => {
      configuration.maxTurns = turns;
    });
  }

  public budget(budget: Partial<AgentBudget>): this {
    const agentBudget = createAgentBudget(budget);
    validateBudget(agentBudget);

    return this.set((configuration) => {
      configuration.budget = agentBudget;
    });
  }

  public usage(charactersPerToken = 4): this {
    return this.useUsage(new RatioUsageBroker(charactersPerToken));
  }

  public useUsage(broker: UsageBroker): this {
    return this.set((configuration) => {
      configuration.usageBroker = broker;
    });
  }

  // The trace (SPEC.md 4.1): the host's own logging broker, or the reference's trace shape over
  // a line writer.
  public useLogging(broker: LoggingBroker): this {
    return this.set((configuration) => {
      configuration.loggingBroker = broker;
    });
  }

  public trace(write: (line: string) => void, verbosity: TraceVerbosity = "Full"): this {
    return this.useLogging(new StreamLoggingBroker(write, verbosity));
  }

  // The doors. processPrompt is the answer alone; runAsync reports how the run ended as well,
  // which a caller nesting this agent cannot do without; runWithEvents delivers the events as
  // they happen. All three are one loop (SPEC.md 7.6).
  public async processPrompt(prompt: string, sessionId = "", signal?: AbortSignal): Promise<string> {
    return await this.resolve().processPrompt(prompt, sessionId, signal);
  }

  public async runAsync(request: PromptRequest | string, signal?: AbortSignal): Promise<AgentOutcome> {
    return await this.resolve().run(typeof request === "string" ? createPromptRequest(request) : request, signal);
  }

  public async runWithEvents(
    request: PromptRequest | string,
    emit: (event: AgentStreamEvent) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<AgentOutcome> {
    return await this.resolve().runWithEvents(typeof request === "string" ? createPromptRequest(request) : request, emit, signal);
  }

  // The streamed door: the same loop and the same events, with the decision watched as it is
  // made, so narration reaches the reader while the model is still writing. Each line is screened
  // by the Gate before it is voiced, which is why the unit is a line and not a token.
  public async runStream(
    request: PromptRequest | string,
    emit: (event: AgentStreamEvent) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<AgentOutcome> {
    return await this.resolve().runStreamed(typeof request === "string" ? createPromptRequest(request) : request, emit, signal);
  }

  // Composed once and reused, because one instance serves prompts concurrently and a graph per
  // prompt would be two brokers over one ledger. A verb drops the graph, so the next prompt
  // composes afresh with nothing configured lost.
  private resolve(): RunManagementService {
    this.composed ??= compose(this.configuration);

    return this.composed;
  }

  private set(configure: (configuration: AgentConfiguration) => void): this {
    configure(this.configuration);
    this.composed = null;

    return this;
  }
}
