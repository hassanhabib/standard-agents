import type { ApprovalBroker } from "../../../brokers/approvals/ApprovalBroker.js";
import type { ClassifierBroker } from "../../../brokers/classifiers/ClassifierBroker.js";
import type { ContractBroker } from "../../../brokers/contracts/ContractBroker.js";
import type { EffectLedgerBroker } from "../../../brokers/effects/EffectLedgerBroker.js";
import type { GeneratorBroker } from "../../../brokers/generators/GeneratorBroker.js";
import type { GeneratorBrokerV1 } from "../../../brokers/generators/GeneratorBrokerV1.js";
import type { KnowledgeBroker } from "../../../brokers/knowledges/KnowledgeBroker.js";
import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { McpBroker } from "../../../brokers/mcps/McpBroker.js";
import type { MemoryBroker } from "../../../brokers/memorys/MemoryBroker.js";
import type { PolicyBroker } from "../../../brokers/policies/PolicyBroker.js";
import type { SessionBroker } from "../../../brokers/sessions/SessionBroker.js";
import type { SkillBroker } from "../../../brokers/skills/SkillBroker.js";
import type { UsageBroker } from "../../../brokers/usages/UsageBroker.js";
import type { VerifierBroker } from "../../../brokers/verifiers/VerifierBroker.js";
import type { Tool } from "../../../tools/Tool.js";
import type { AgentBudget } from "../../coordinations/agents/AgentBudget.js";
import type { PrincipalResolver } from "../../coordinations/agents/PrincipalResolver.js";
import type { ToolSelector } from "../../coordinations/agents/ToolSelector.js";
import type { PermissionMode } from "../../orchestrations/effects/PermissionMode.js";
import type { RiskLevel } from "../../orchestrations/effects/RiskLevel.js";
import { DEFAULT_MAX_HISTORY_TURNS, DEFAULT_MAX_TURNS } from "../../managements/runs/RunOptions.js";

// What the builder verbs recorded, before anything is composed (SPEC.md 4.8). A null broker
// means the host expressed no opinion and the composition supplies the not-configured one; an
// empty list means the same for what is listed. Mutable on purpose: it is the one record the
// verbs write and the composition reads, and nothing else holds it.
export interface AgentConfiguration {
  generatorBroker: GeneratorBroker | null;
  generatorBrokerV1: GeneratorBrokerV1 | null;
  configuredTemperature: number | null;
  configuredMaxTokens: number | null;
  skillSources: SkillBroker[];
  tools: Tool[];
  classifierBroker: ClassifierBroker | null;
  verifierBroker: VerifierBroker | null;
  contractBroker: ContractBroker | null;
  contractSchema: string;
  memoryBroker: MemoryBroker | null;
  knowledgeBroker: KnowledgeBroker | null;
  sessionBroker: SessionBroker | null;
  maxHistoryTurns: number;
  mcpBroker: McpBroker | null;
  policyBroker: PolicyBroker | null;
  allowedTools: string[] | null;
  approvalBroker: ApprovalBroker | null;
  approvalRequiredTools: string[];
  effectLedgerBroker: EffectLedgerBroker | null;
  effectLeaseMilliseconds: number;
  permissionMode: PermissionMode;
  declaredRisk: Map<string, RiskLevel>;
  principalResolver: PrincipalResolver | null;
  toolSelector: ToolSelector | null;
  enforceSelection: boolean;
  screenToolOutput: boolean;
  maxTurns: number;
  budget: AgentBudget | null;
  usageBroker: UsageBroker | null;
  loggingBroker: LoggingBroker | null;
}

export const DEFAULT_EFFECT_LEASE_MILLISECONDS = 300_000;

export function createAgentConfiguration(): AgentConfiguration {
  return {
    generatorBroker: null,
    generatorBrokerV1: null,
    configuredTemperature: null,
    configuredMaxTokens: null,
    skillSources: [],
    tools: [],
    classifierBroker: null,
    verifierBroker: null,
    contractBroker: null,
    contractSchema: "",
    memoryBroker: null,
    knowledgeBroker: null,
    sessionBroker: null,
    maxHistoryTurns: DEFAULT_MAX_HISTORY_TURNS,
    mcpBroker: null,
    policyBroker: null,
    allowedTools: null,
    approvalBroker: null,
    approvalRequiredTools: [],
    effectLedgerBroker: null,
    effectLeaseMilliseconds: DEFAULT_EFFECT_LEASE_MILLISECONDS,
    permissionMode: "Open",
    declaredRisk: new Map(),
    principalResolver: null,
    toolSelector: null,
    enforceSelection: false,
    screenToolOutput: false,
    maxTurns: DEFAULT_MAX_TURNS,
    budget: null,
    usageBroker: null,
    loggingBroker: null,
  };
}
