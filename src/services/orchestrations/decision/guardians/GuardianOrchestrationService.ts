import type { LoggingBroker } from "../../../../brokers/loggings/LoggingBroker.js";
import type { ContractVerdict } from "../../../../models/foundations/contracts/ContractVerdict.js";
import type { Judgement } from "../../../../models/foundations/judges/Judgement.js";
import { AgentRun } from "../../../../models/loggings/AgentRun.js";
import type { ContractService } from "../../../foundations/contracts/ContractService.js";
import type { GateService } from "../../../foundations/gates/GateService.js";
import type { JudgeService } from "../../../foundations/judges/JudgeService.js";
import { createTryCatch, type TryCatch } from "./GuardianOrchestrationService.Exceptions.js";

// A conscience, before and after (SPEC.md 4.2, 4.5). The Gate screens what goes in and the
// Judge scores what comes out; the Contract asks whether it is the right shape. They are one
// concept at three moments, which is why they share a region, and Invariant 6 treats them as a
// single class of thing: a guardian is never the Brain.
export class GuardianOrchestrationService {
  private readonly gateService: GateService;
  private readonly judgeService: JudgeService;
  private readonly contractService: ContractService;
  private readonly loggingBroker: LoggingBroker;
  private readonly tryCatch: TryCatch;

  public constructor(
    gateService: GateService,
    judgeService: JudgeService,
    contractService: ContractService,
    loggingBroker: LoggingBroker,
  ) {
    this.gateService = gateService;
    this.judgeService = judgeService;
    this.contractService = contractService;
    this.loggingBroker = loggingBroker;
    this.tryCatch = createTryCatch(this.loggingBroker);
  }

  // The prompt does not change across the turns of one run, only the observations do, so the
  // Gate is asked about it once per run rather than once per turn at full model cost (SPEC.md
  // 4.10). The guarantee holds: the task is screened before the Brain sees it. What changes
  // every turn is untrusted inbound, and that is different text each time, screened each time.
  // The verdict is remembered on the run, not in this service, so the run ending evicts it.
  public screen(prompt: string): Promise<string> {
    return this.tryCatch(async () => {
      const run = AgentRun.current();

      if (run === null) {
        return await this.gateService.screen(prompt);
      }

      const remembered = run.tryGetVerdict(prompt);

      if (remembered !== undefined) {
        return remembered;
      }

      const verdict = await this.gateService.screen(prompt);
      run.rememberVerdict(prompt, verdict);

      return verdict;
    });
  }

  public detectConflict(instructions: string): Promise<string> {
    return this.tryCatch(async () => await this.gateService.detectConflict(instructions));
  }

  // Scores a draft against the task it is meant to answer (SPEC.md 4.2).
  public evaluate(task: string, candidate: string): Promise<Judgement> {
    return this.tryCatch(async () => await this.judgeService.evaluate(task, candidate));
  }

  // The third guardian: the Gate asks whether a task may be attempted, the Judge whether a
  // draft is good enough, and this whether it is the right shape. Satisfied when no contract is
  // configured: an agent given none is not constrained by having become checkable.
  public checkShape(answer: string, schema: string): Promise<ContractVerdict> {
    return this.tryCatch(async () => await this.contractService.check(answer, schema));
  }
}
