import type { AgentEffect } from "../../models/orchestrations/effects/AgentEffect.js";
import { allow, deny, type AuthorizationDecision } from "../../models/orchestrations/effects/AuthorizationDecision.js";
import type { PolicyBroker } from "./PolicyBroker.js";

// The least-privilege allow-list (SPEC.md 4.6, 4.9): entries are a tool name, or a tool name and a
// scope prefix separated by a colon. Case-insensitive prefix match, no globs.
export class AllowListPolicyBroker implements PolicyBroker {
  private readonly allowedScopesByTool = new Map<string, string[]>();

  public constructor(allowedEntries: readonly string[]) {
    for (const entry of allowedEntries) {
      const separator = entry.indexOf(":");
      const toolName = (separator < 0 ? entry : entry.slice(0, separator)).toLowerCase();
      const scope = separator < 0 ? "" : entry.slice(separator + 1);
      const scopes = this.allowedScopesByTool.get(toolName) ?? [];
      scopes.push(scope);
      this.allowedScopesByTool.set(toolName, scopes);
    }
  }

  public async authorize(effect: AgentEffect): Promise<AuthorizationDecision> {
    const allowedScopes = this.allowedScopesByTool.get(effect.toolName.toLowerCase());

    if (allowedScopes === undefined) {
      return deny(`tool '${effect.toolName}' is not permitted`);
    }

    const permitted = allowedScopes.some(
      (allowed) => allowed.length === 0 || effect.scope.toLowerCase().startsWith(allowed.toLowerCase()),
    );

    return permitted ? allow() : deny(`tool '${effect.toolName}' is not permitted at '${effect.scope}'`);
  }

  public mentions(effect: AgentEffect): boolean {
    return this.allowedScopesByTool.has(effect.toolName.toLowerCase());
  }
}
