import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { McpTool } from "../../../../models/brokers/mcps/McpTool.js";
import { ExternalToolDependencyException } from "../../../../models/foundations/externalTools/exceptions/ExternalToolDependencyException.js";
import { ExternalToolDependencyValidationException } from "../../../../models/foundations/externalTools/exceptions/ExternalToolDependencyValidationException.js";
import { ExternalToolServiceException } from "../../../../models/foundations/externalTools/exceptions/ExternalToolServiceException.js";
import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import type { ExternalToolService } from "../../../foundations/externalTools/ExternalToolService.js";
import type { KnowledgeService } from "../../../foundations/knowledges/KnowledgeService.js";
import type { SkillService } from "../../../foundations/skills/SkillService.js";
import { createTryCatch, type TryCatch } from "./RetrievalOrchestrationService.Exceptions.js";

const TOOLS_MARKER = "{{tools}}";
const SKILLS_MARKER = "{{skills}}";

// Authored material, selected by relevance (SPEC.md 4.2). Skills and knowledge share a region
// because they share a concept: both are written by someone, both are stored, and both are
// chosen for this prompt by how well they match it. Remote tools join under the same opt-in the
// local catalog lives by.
export class RetrievalOrchestrationService {
  private readonly skillService: SkillService;
  private readonly knowledgeService: KnowledgeService;
  private readonly externalToolService: ExternalToolService;
  private readonly loggingBroker: LoggingBroker;
  private readonly toolCatalog: string;
  private readonly toolCatalogEntries: ReadonlyMap<string, string> | null;
  private readonly tryCatch: TryCatch;

  // The remote tools, kept after the first successful discovery so a healthy server is asked
  // once per composition rather than once per prompt.
  private remoteTools: readonly McpTool[] | null = null;

  public constructor(
    skillService: SkillService,
    knowledgeService: KnowledgeService,
    externalToolService: ExternalToolService,
    loggingBroker: LoggingBroker,
    toolCatalog = "",
    toolCatalogEntries: ReadonlyMap<string, string> | null = null,
  ) {
    this.skillService = skillService;
    this.knowledgeService = knowledgeService;
    this.externalToolService = externalToolService;
    this.loggingBroker = loggingBroker;
    this.toolCatalog = toolCatalog;
    this.toolCatalogEntries = toolCatalogEntries;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  // The catalogs are expanded here rather than in a skill file, because which tools a Brain may
  // reach for is a safety boundary and the marker is the developer's opt-in (SPEC.md 6.1).
  public retrieveInstructions(route: string): Promise<string> {
    return this.tryCatch(async () => {
      const skills = await this.skillService.retrieveSkills(route);
      let instructions = skills.replaceAll(TOOLS_MARKER, await this.renderToolCatalog(skills));

      if (instructions.includes(SKILLS_MARKER)) {
        instructions = instructions.replaceAll(SKILLS_MARKER, await this.skillService.retrieveSkillCatalog());
      }

      return instructions;
    });
  }

  public retrieveGrounding(query: string): Promise<readonly string[]> {
    return this.tryCatch(async () => {
      // A run that carries an answer to an act it already proposed asks for nothing new, so there
      // is no question here to look anything up for. The foundation is right to refuse an empty
      // query, and this is the tier that should not be handing it one.
      if (query.trim().length === 0) {
        return [];
      }

      const knowledge = await this.knowledgeService.retrieve(query);
      await this.loggingBroker.logProcess("Data", `Retrieved ${knowledge.length} knowledge matches`);

      return knowledge;
    });
  }

  // Every tool the servers declared, described or not, so the callers apply the opt-in
  // themselves: selection judges described names, and the perimeter binds described names.
  public retrieveRemoteTools(): Promise<readonly McpTool[]> {
    return this.tryCatch(async () => await this.discoverRemoteTools());
  }

  // Remote tools join the catalog under the same opt-in as local ones, and only when the marker
  // is present, so an agent that never advertises never pays a discovery call.
  private async renderToolCatalog(skills: string): Promise<string> {
    if (!skills.includes(TOOLS_MARKER)) {
      return this.selectedToolCatalog();
    }

    const localCatalog = this.selectedToolCatalog();
    const remoteCatalog = renderRemoteToolCatalog(await this.discoverRemoteTools());

    if (remoteCatalog.length === 0) {
      return localCatalog;
    }

    return localCatalog.length === 0 ? remoteCatalog : `${localCatalog}\n${remoteCatalog}`;
  }

  // Selection (SPEC.md 4.15): a run under selection is shown only the offered tools' lines. Read
  // off the ambient run, two tiers below the loop, so no renderer gains a parameter for it.
  // Absent a selection, or absent the per-tool entries, the whole catalog renders unchanged.
  private selectedToolCatalog(): string {
    const offered = AgentRun.current()?.offeredTools ?? null;

    if (offered === null || this.toolCatalogEntries === null) {
      return this.toolCatalog;
    }

    return [...this.toolCatalogEntries.entries()]
      .filter(([name]) => isOffered(offered, name))
      .map(([, line]) => line)
      .join("\n");
  }

  // Best effort and cached on success: a server down at discovery hides only its own tools this
  // turn and is asked again on the next. The foundation has already localised and logged its
  // failure, so this tier degrades to no remote tools rather than failing the run.
  private async discoverRemoteTools(): Promise<readonly McpTool[]> {
    if (this.remoteTools !== null) {
      return this.remoteTools;
    }

    try {
      this.remoteTools = await this.externalToolService.retrieveTools();

      return this.remoteTools;
    } catch (error: unknown) {
      if (isLocalisedDiscoveryFailure(error)) {
        return [];
      }

      throw error;
    }
  }
}

function isLocalisedDiscoveryFailure(error: unknown): boolean {
  return (
    error instanceof ExternalToolDependencyException ||
    error instanceof ExternalToolDependencyValidationException ||
    error instanceof ExternalToolServiceException
  );
}

// A description is the opt-in (SPEC.md 6.1): an undescribed remote tool stays callable but
// unlisted; a run under selection is shown only what it was offered; and what the tool takes
// rides the line as a local tool's parameters do.
function renderRemoteToolCatalog(remoteTools: readonly McpTool[]): string {
  const offered = AgentRun.current()?.offeredTools ?? null;

  return remoteTools
    .filter((tool) => tool.description.trim().length > 0)
    .filter((tool) => offered === null || isOffered(offered, tool.name))
    .map((tool) => `- ${tool.name}: ${tool.description} parameters: ${tool.inputSchemaJson}`)
    .join("\n");
}

function isOffered(offered: readonly string[], name: string): boolean {
  return offered.some((candidate) => candidate.toLowerCase() === name.toLowerCase());
}
