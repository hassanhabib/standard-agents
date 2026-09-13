import type { LoggingBroker } from "../../../brokers/loggings/LoggingBroker.js";
import type { TimeBroker } from "../../../brokers/times/TimeBroker.js";
import type { AgentSession } from "../../../models/brokers/sessions/AgentSession.js";
import { StaleSessionException } from "../../../models/foundations/sessions/exceptions/StaleSessionException.js";
import { AgentRun } from "../../../models/loggings/AgentRun.js";
import type { AgentContext } from "../../../models/orchestrations/agents/AgentContext.js";
import type { AgentStatus } from "../../../models/orchestrations/agents/AgentStatus.js";
import type { DataCoordinationService } from "../../coordinations/data/DataCoordinationService.js";
import { validateSessionOwner } from "./RunManagementService.Validations.js";

// Conversation and resumption (SPEC.md 4.11). Invariant 4 still holds: the instance is stateless
// across prompts. What persists is the session, and it lives in a broker outside the agent, which
// is what lets a pause be resumed by a different process.

// Bounded, because a store that refuses every write is an outage, not contention.
const MAX_SESSION_WRITE_ATTEMPTS = 16;

// Read before the run begins, because a resumed run must keep the identity the interrupted one
// had. A session another principal opened is refused here, before a line of it is read.
export async function peekSession(
  dataCoordinationService: DataCoordinationService,
  sessionId: string,
  principal: string,
): Promise<AgentSession | null> {
  if (sessionId.length === 0) {
    return null;
  }

  const session = await dataCoordinationService.recallSession(sessionId);
  validateSessionOwner(session, principal);

  return session;
}

// A session that never delivered an answer was interrupted: killed, cancelled, out of turns, or
// waiting on an authority. The next prompt in that session continues that run rather than
// starting a fresh one, so the effects it already performed keep their keys and are replayed
// rather than performed twice (SPEC.md 4.9, 4.11).
export function resumedRunId(session: AgentSession | null): string | null {
  return session !== null && session.runId.length > 0 && !isDelivered(session.status) ? session.runId : null;
}

// Delivered means the caller got a conclusion: an answer, or a refusal that is itself an answer.
function isDelivered(status: AgentStatus): boolean {
  return status === "Responded" || status === "Refused";
}

// The start-of-run checkpoint, written before any work, because a crash means nothing at the end
// runs at all. It records who is working the session, not what was said: this prompt has no
// answer yet.
export async function beginSession(
  dataCoordinationService: DataCoordinationService,
  loggingBroker: LoggingBroker,
  sessionId: string,
  principal: string,
): Promise<void> {
  if (sessionId.length === 0) {
    return;
  }

  await recordSessionWithRetry(dataCoordinationService, loggingBroker, sessionId, principal, (existing) => ({
    id: sessionId,
    history: existing?.history ?? [],
    status: "Working",
    pendingQuestion: existing?.pendingQuestion ?? "",
    pendingEffect: null,
    runId: AgentRun.current()?.id ?? "",
    owner: "",
    version: 0,
  }));
}

// Bounded, oldest first. An unbounded history makes every prompt in a long conversation cost
// more than the last, without limit.
export async function loadSession(
  loggingBroker: LoggingBroker,
  context: AgentContext,
  session: AgentSession | null,
  maxHistoryTurns: number,
): Promise<AgentContext> {
  if (session === null) {
    return context;
  }

  const history = session.history.length > maxHistoryTurns ? session.history.slice(session.history.length - maxHistoryTurns) : session.history;
  await loggingBroker.logProcess("Data", `Recalled ${history.length} conversation turn(s)`);

  return { ...context, history };
}

// Only a completed prompt is recorded. What the turn did travels with what it said: recording the
// answer alone loses the calls that produced it (SPEC.md 4.11, 6).
export async function saveSession(
  dataCoordinationService: DataCoordinationService,
  loggingBroker: LoggingBroker,
  timeBroker: TimeBroker,
  context: AgentContext,
  principal: string,
): Promise<void> {
  if (context.sessionId.length === 0) {
    return;
  }

  const isWaiting = context.status === "AwaitingInput" || context.status === "AwaitingApproval";

  await recordSessionWithRetry(dataCoordinationService, loggingBroker, context.sessionId, principal, (existing) => ({
    id: context.sessionId,
    history: [
      ...(existing?.history ?? []),

      // Stamped from the clock the run was given rather than read off the wall, which is what lets
      // a test place a turn at a particular moment. A turn that does not know when it happened is
      // a turn a person cannot find their way back to: the store orders conversations by the day
      // in their name, and nothing inside one is ordered at all.
      {
        prompt: context.prompt,
        answer: context.result,
        exchanges: context.toolExchanges,
        recordedOn: timeBroker.getCurrentDateTime().toISOString(),
      },
    ],
    status: context.status,
    pendingQuestion: isWaiting ? context.result : "",
    pendingEffect: context.pendingEffect,
    runId: AgentRun.current()?.id ?? "",
    owner: "",
    version: 0,
  }));
}

// Every write is based on a fresh read and says so: the version it was read at plus one, and the
// owner the record already had or the principal writing it now. A store that honors versions
// refuses a write based on a read that is no longer current, and the loop reads again and tries
// again, so no completed turn is erased by a slower writer (SPEC.md 4.11).
async function recordSessionWithRetry(
  dataCoordinationService: DataCoordinationService,
  loggingBroker: LoggingBroker,
  sessionId: string,
  principal: string,
  compose: (existing: AgentSession | null) => AgentSession,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    const existing = await dataCoordinationService.recallSession(sessionId);

    const session: AgentSession = {
      ...compose(existing),
      owner: existing !== null && existing.owner.length > 0 ? existing.owner : principal,
      version: (existing?.version ?? 0) + 1,
    };

    try {
      await dataCoordinationService.recordSession(session);

      return;
    } catch (error: unknown) {
      if (!isStaleSessionWrite(error) || attempt >= MAX_SESSION_WRITE_ATTEMPTS) {
        throw error;
      }

      await loggingBroker.logProcess(
        "Run",
        `Session '${sessionId}' moved on since it was read; reading it again (attempt ${attempt})`,
        true,
      );
    }
  }
}

// The refusal arrives wrapped by every tier it crossed; what it is sits at the bottom.
function isStaleSessionWrite(error: unknown): boolean {
  let current: unknown = error;

  while (current instanceof Error) {
    if (current instanceof StaleSessionException) {
      return true;
    }

    current = "innerError" in current ? (current as { innerError: unknown }).innerError : current.cause;
  }

  return false;
}
