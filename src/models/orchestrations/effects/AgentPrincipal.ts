// On whose behalf an act is proposed (SPEC.md 3.3). Every field beyond id is optional; the
// framework consumes the principal the host resolved and never mints one.
export interface AgentPrincipal {
  readonly id: string;
  readonly tenantId?: string;
  readonly jurisdiction?: string;
  readonly delegatedBy?: string;
}
