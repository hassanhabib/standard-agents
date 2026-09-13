import { NotConfiguredApprovalBroker } from "../../brokers/approvals/NotConfiguredApprovalBroker.js";
import { NotConfiguredClassifierBroker } from "../../brokers/classifiers/NotConfiguredClassifierBroker.js";
import { RuleContractBroker } from "../../brokers/contracts/RuleContractBroker.js";
import { InMemoryEffectLedgerBroker } from "../../brokers/effects/InMemoryEffectLedgerBroker.js";
import { NotConfiguredKnowledgeBroker } from "../../brokers/knowledges/NotConfiguredKnowledgeBroker.js";
import type { LoggingBroker } from "../../brokers/loggings/LoggingBroker.js";
import { NotConfiguredLoggingBroker } from "../../brokers/loggings/NotConfiguredLoggingBroker.js";
import { NotConfiguredMcpBroker } from "../../brokers/mcps/NotConfiguredMcpBroker.js";
import { NotConfiguredMemoryBroker } from "../../brokers/memorys/NotConfiguredMemoryBroker.js";
import { AllowListPolicyBroker } from "../../brokers/policies/AllowListPolicyBroker.js";
import { NotConfiguredPolicyBroker } from "../../brokers/policies/NotConfiguredPolicyBroker.js";
import type { PolicyBroker } from "../../brokers/policies/PolicyBroker.js";
import { NotConfiguredSessionBroker } from "../../brokers/sessions/NotConfiguredSessionBroker.js";
import { CompositeSkillBroker } from "../../brokers/skills/CompositeSkillBroker.js";
import { FunctionSkillBroker } from "../../brokers/skills/FunctionSkillBroker.js";
import type { SkillBroker } from "../../brokers/skills/SkillBroker.js";
import { SystemTimeBroker } from "../../brokers/times/SystemTimeBroker.js";
import { RegistryToolBroker } from "../../brokers/tools/RegistryToolBroker.js";
import { RatioUsageBroker } from "../../brokers/usages/RatioUsageBroker.js";
import { NotConfiguredVerifierBroker } from "../../brokers/verifiers/NotConfiguredVerifierBroker.js";
import type { AgentConfiguration } from "../../models/clients/agents/AgentConfiguration.js";
import { createRunOptions } from "../../models/managements/runs/RunOptions.js";
import { DataCoordinationService } from "../../services/coordinations/data/DataCoordinationService.js";
import { DecisionCoordinationService } from "../../services/coordinations/decision/DecisionCoordinationService.js";
import { DirectionCoordinationService } from "../../services/coordinations/direction/DirectionCoordinationService.js";
import { ApprovalService } from "../../services/foundations/approvals/ApprovalService.js";
import { BrainService } from "../../services/foundations/brains/BrainService.js";
import { ContractService } from "../../services/foundations/contracts/ContractService.js";
import { EffectLedgerService } from "../../services/foundations/effects/EffectLedgerService.js";
import { ExternalToolService } from "../../services/foundations/externalTools/ExternalToolService.js";
import { GateService } from "../../services/foundations/gates/GateService.js";
import { InternalToolService } from "../../services/foundations/internalTools/InternalToolService.js";
import { JudgeService } from "../../services/foundations/judges/JudgeService.js";
import { KnowledgeService } from "../../services/foundations/knowledges/KnowledgeService.js";
import { MemoryService } from "../../services/foundations/memorys/MemoryService.js";
import { PolicyService } from "../../services/foundations/policies/PolicyService.js";
import { ReturnService } from "../../services/foundations/returns/ReturnService.js";
import { SessionService } from "../../services/foundations/sessions/SessionService.js";
import { SkillService } from "../../services/foundations/skills/SkillService.js";
import { UsageService } from "../../services/foundations/usages/UsageService.js";
import { RunManagementService } from "../../services/managements/runs/RunManagementService.js";
import { RecollectionOrchestrationService } from "../../services/orchestrations/data/recollections/RecollectionOrchestrationService.js";
import { RetrievalOrchestrationService } from "../../services/orchestrations/data/retrievals/RetrievalOrchestrationService.js";
import { GuardianOrchestrationService } from "../../services/orchestrations/decision/guardians/GuardianOrchestrationService.js";
import { InferenceOrchestrationService } from "../../services/orchestrations/decision/inferences/InferenceOrchestrationService.js";
import { ExecutionOrchestrationService } from "../../services/orchestrations/direction/executions/ExecutionOrchestrationService.js";
import { PerimeterOrchestrationService } from "../../services/orchestrations/direction/perimeters/PerimeterOrchestrationService.js";
import { advertised, renderToolCatalog, renderToolCatalogEntries, renderToolDefinitions, renderToolNarrations, renderToolPerformed, renderToolRisk, renderToolScope } from "./StandardAgent.Catalogs.js";
import { requireBrain } from "./StandardAgent.Validations.js";

// The composition partial: the one place the recorded verbs become the graph of brokers and
// services (SPEC.md 3.1, 4.8). Nothing here is a verb; nothing in the client composes. Every
// broker the host did not configure is the not-configured one, so the graph has one shape
// whatever was configured, and a tier never grows a nullable dependency.
export function compose(configuration: AgentConfiguration): RunManagementService {
  const generator = requireBrain(configuration);
  const logging: LoggingBroker = configuration.loggingBroker ?? new NotConfiguredLoggingBroker();
  const time = new SystemTimeBroker();
  const tools = configuration.tools;

  // One foundation over the remote tools, shared by the two natures that need it: Data
  // advertises what the servers offer, Direction performs what the Brain chose.
  const externalToolService = new ExternalToolService(configuration.mcpBroker ?? new NotConfiguredMcpBroker(), logging);

  // The Data nature: what was authored, selected by relevance, and what the agent accumulated.
  const dataCoordinationService = new DataCoordinationService(
    new RetrievalOrchestrationService(
      new SkillService(skillBrokerOf(configuration.skillSources), logging),
      new KnowledgeService(configuration.knowledgeBroker ?? new NotConfiguredKnowledgeBroker(), logging),
      externalToolService,
      logging,
      renderToolCatalog(tools),
      renderToolCatalogEntries(tools),
    ),
    new RecollectionOrchestrationService(
      new MemoryService(configuration.memoryBroker ?? new NotConfiguredMemoryBroker(), logging),
      new SessionService(configuration.sessionBroker ?? new NotConfiguredSessionBroker(), logging),
      logging,
    ),
    logging,
  );

  // The Decision nature: Inference asks the model and reads its answer; Guardian screens what
  // goes in and scores what comes out.
  const decisionCoordinationService = new DecisionCoordinationService(
    new InferenceOrchestrationService(
      new BrainService(generator, logging, configuration.generatorBrokerV1),
      new UsageService(configuration.usageBroker ?? new RatioUsageBroker(), logging),
      logging,
      renderToolDefinitions(tools),
    ),
    new GuardianOrchestrationService(
      new GateService(configuration.classifierBroker ?? new NotConfiguredClassifierBroker(), logging),
      new JudgeService(configuration.verifierBroker ?? new NotConfiguredVerifierBroker(), logging),
      new ContractService(configuration.contractBroker ?? new RuleContractBroker(), logging),
      logging,
    ),
    logging,
    configuration.contractSchema,
  );

  // The allow-list is expressed as a policy, so the simple answer and an external policy engine
  // travel one seam and a denial carries a reason either way (SPEC.md 4.9).
  const policy: PolicyBroker =
    configuration.policyBroker ??
    (configuration.allowedTools === null ? new NotConfiguredPolicyBroker() : new AllowListPolicyBroker(configuration.allowedTools));

  // The Direction nature: Perimeter answers whether an act may happen; Execution performs it.
  const directionCoordinationService = new DirectionCoordinationService(
    new PerimeterOrchestrationService(
      new PolicyService(policy, logging),
      new ApprovalService(configuration.approvalBroker ?? new NotConfiguredApprovalBroker(), logging),
      new EffectLedgerService(configuration.effectLedgerBroker ?? new InMemoryEffectLedgerBroker(), time, logging),
      time,
      logging,
      configuration.effectLeaseMilliseconds,
    ),
    new ExecutionOrchestrationService(
      new InternalToolService(new RegistryToolBroker(tools), logging),
      externalToolService,
      new ReturnService(logging),
      logging,
    ),
    logging,
    {
      mode: configuration.permissionMode,
      irreversibleTools: configuration.approvalRequiredTools,
      declaredRisk: configuration.declaredRisk,
      toolRisk: renderToolRisk(tools),
      toolScope: renderToolScope(tools),
      toolPerformed: renderToolPerformed(tools),
      explicitlyPermits: policy instanceof AllowListPolicyBroker ? (effect) => policy.mentions(effect) : null,
      identityResolver: configuration.principalResolver,
      enforceSelection: configuration.enforceSelection,
      advertisedTools: advertised(tools).map((tool) => tool.name),
    },
  );

  return new RunManagementService(
    dataCoordinationService,
    decisionCoordinationService,
    directionCoordinationService,
    time,
    logging,
    createRunOptions({
      maxTurns: configuration.maxTurns,
      maxHistoryTurns: configuration.maxHistoryTurns,
      budget: configuration.budget,
      screenToolOutput: configuration.screenToolOutput,
      contractSchema: configuration.contractSchema,
      configuredTemperature: configuration.configuredTemperature,
      configuredMaxTokens: configuration.configuredMaxTokens,
      configuredToolNames: tools.map((tool) => tool.name),
      describedToolNames: advertised(tools).map((tool) => tool.name),
      toolNarrations: renderToolNarrations(tools),
      toolSelector: configuration.toolSelector,
      principalResolver: configuration.principalResolver,
    }),
  );
}

// One source composes as itself; several compose behind the same seam the service already
// speaks; none composes as no skills at all.
function skillBrokerOf(sources: readonly SkillBroker[]): SkillBroker {
  const first = sources[0];

  if (first === undefined) {
    return new FunctionSkillBroker(async () => []);
  }

  return sources.length === 1 ? first : new CompositeSkillBroker(sources);
}
