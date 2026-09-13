import type { AgentPrincipal } from "../../orchestrations/effects/AgentPrincipal.js";

// Who the host says is acting (SPEC.md 4.9), asked per run: what a session records as its owner,
// and what a session another principal opened is refused against (SPEC.md 4.11).
export type PrincipalResolver = () => AgentPrincipal | null;
