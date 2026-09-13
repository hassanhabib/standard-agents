// What a policy answered about an act (SPEC.md 4.9): permitted, or not and why.
export interface AuthorizationDecision {
  readonly permitted: boolean;
  readonly reason: string;
}

export function allow(): AuthorizationDecision {
  return { permitted: true, reason: "" };
}

export function deny(reason: string): AuthorizationDecision {
  return { permitted: false, reason };
}
