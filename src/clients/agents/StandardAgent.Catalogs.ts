import type { ToolDefinition } from "../../models/brokers/generators/v1/ToolDefinition.js";
import type { ToolNarration } from "../../models/coordinations/agents/ToolNarration.js";
import type { RiskLevel } from "../../models/orchestrations/effects/RiskLevel.js";
import type { Tool } from "../../tools/Tool.js";

// What the model may be told about, in one place (SPEC.md 6.1): a description is the opt-in,
// and a tool without one stays callable but unadvertised. Everything the composition derives
// from the tools is derived here, so the catalog, the offering and the perimeter cannot disagree
// about a tool's line.
export function advertised(tools: readonly Tool[]): readonly Tool[] {
  return tools.filter((tool) => (tool.description ?? "").trim().length > 0);
}

// The same tools as the native protocol offers them (SPEC.md 6.2): a name, the description that is
// the advertisement opt-in, and a JSON Schema. Derived from the same `advertised` list as the text
// catalog, because a tool the model is told about in one protocol and not the other is a tool that
// behaves differently depending on which brain answered.
//
// A tool that declares no parameters is offered as the empty object schema rather than omitted: a
// provider reads a missing schema as a tool it cannot call.
export function renderToolDefinitions(tools: readonly Tool[]): readonly ToolDefinition[] {
  return advertised(tools).map((tool) => ({
    name: tool.name,
    description: (tool.description ?? "").trim(),
    parametersJson: (tool.parameters ?? "").trim().length > 0 ? (tool.parameters ?? "") : EMPTY_SCHEMA,
  }));
}

const EMPTY_SCHEMA = JSON.stringify({ type: "object", properties: {} });

// The catalog a "{{tools}}" marker in the agent's Data expands into.
export function renderToolCatalog(tools: readonly Tool[]): string {
  return advertised(tools)
    .map((tool) => renderToolLine(tool))
    .join("\n");
}

// The same catalog, per tool, so a run under selection (SPEC.md 4.15) can be shown only what it
// was offered.
export function renderToolCatalogEntries(tools: readonly Tool[]): ReadonlyMap<string, string> {
  return new Map(advertised(tools).map((tool) => [tool.name, renderToolLine(tool)]));
}

// Narration templates, derived from the tools exactly as risk and scope are: the tool is what
// knows what its act means in the user's language.
export function renderToolNarrations(tools: readonly Tool[]): ReadonlyMap<string, ToolNarration> {
  return new Map(
    tools
      .filter((tool) => (tool.narrationStarting ?? "").trim().length > 0 || (tool.narrationObserved ?? "").trim().length > 0)
      .map((tool) => [tool.name, { starting: tool.narrationStarting ?? "", observed: tool.narrationObserved ?? "" }]),
  );
}

// What each tool declares about itself, read once at composition.
export function renderToolRisk(tools: readonly Tool[]): ReadonlyMap<string, RiskLevel> {
  return new Map(tools.map((tool) => [tool.name, tool.risk ?? "Safe"]));
}

// Each tool's own reading of what an act touches; the framework never parses arguments.
export function renderToolScope(tools: readonly Tool[]): ReadonlyMap<string, (input: string) => string> {
  return new Map(
    tools
      .filter((tool) => tool.scopeOf !== undefined)
      .map((tool) => [tool.name, (input: string) => tool.scopeOf?.(input) ?? ""]),
  );
}

// Each tool's own reading of whether an outcome means the act happened. A tool that says nothing
// is a tool that only answers when it did something.
export function renderToolPerformed(tools: readonly Tool[]): ReadonlyMap<string, (output: string) => boolean> {
  return new Map(
    tools
      .filter((tool) => tool.performed !== undefined)
      .map((tool) => [tool.name, (output: string) => tool.performed?.(output) ?? true]),
  );
}

function renderToolLine(tool: Tool): string {
  return `- ${tool.name}: ${tool.description ?? ""} parameters: ${tool.parameters ?? "{}"}`;
}
