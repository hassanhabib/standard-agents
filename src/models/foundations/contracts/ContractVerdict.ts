// Whether an answer satisfies the contract it was asked to honor (SPEC.md 4.13), and why not.
export interface ContractVerdict {
  readonly satisfied: boolean;
  readonly reason: string;
}

export const UNCONSTRAINED: ContractVerdict = { satisfied: true, reason: "" };
