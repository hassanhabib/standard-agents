import type { VerifierBroker } from "./VerifierBroker.js";

// The Custom mode of the Judge (SPEC.md 4.8), and the seam the conformance runner scripts.
export class FunctionVerifierBroker implements VerifierBroker {
  private readonly verifyCandidate: (task: string, candidate: string) => Promise<string>;

  public constructor(verifyCandidate: (task: string, candidate: string) => Promise<string>) {
    this.verifyCandidate = verifyCandidate;
  }

  public async verify(task: string, candidate: string): Promise<string> {
    return await this.verifyCandidate(task, candidate);
  }
}
