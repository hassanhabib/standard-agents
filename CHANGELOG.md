# Changelog

All notable changes to `@hassanhabib/standard-agents` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions follow
the four-part scheme The Standard uses: model, service, fix, build.

## [0.8.0]

### Direction

- A read after a write to the same place is a new question, not the old one asked again. The
  ledger remembers what a read said and replays it to the same read for the rest of the run, which
  is right for an act and wrong for a look at something an act has since changed. Watched live: the
  model edited line 10 of a file and read it back to see its edit, was handed the file as it was
  before the edit with a note saying it already had that, and asked again and again, because the
  answer was stale and the note said it was not.
- A Safe act whose scope this run has since written to is claimed under a key that counts the
  writes, which makes it a different act in the ledger: it runs, and a second identical read after
  the same write replays as before. Acts that are not Safe keep their key exactly: a transfer
  proposed twice is one transfer, whatever else happened in between (conformance 17).

## [0.7.0]

### Direction

- From the third identical call on, a replay is the note alone and not the bytes. Watched live: a
  990-line file read in three pages, then the first page asked for fourteen more times, each
  answered with the same sixteen kilobytes and the same "already ran" note, until the turns ran out
  with nothing done. The note was right and was not enough, and every copy cost the person a turn's
  worth of context while buying the model nothing it did not already have.
- The run goes on. Whether a run that keeps asking should end is the loop's contract to decide, and
  the contract says the turn cap decides it: conformance 06 pins the cap and 17 pins that three
  identical proposals may still end in a delivered answer. Ending the run sooner is a contract
  change and is not made here.
- Read from the observations rather than a counter, so both protocols carry it: the native path
  keeps exchanges and the text path does not, and a guard that only fired on one of them would be a
  guard the other door never had.

## [0.6.0]

### Decision

- `UnreachableBrainException` is the last word in the chain rather than a sentence with fetch's own
  `TypeError` hanging off the end of it. A door showing somebody what happened reads the bottom of
  the chain, because every tier above it is a category written for a log, so a native fault left in
  place at the bottom is what they are shown and the sentence above it is one nobody sees. Measured
  at a dead address before and after: "fetch failed", then the sentence.
- The fault itself is kept where the people who need it will look: as the exception's cause, and in
  the data beside it.

## [0.5.0]

### Decision

- A brain that could not be reached raises `UnreachableBrainException` instead of carrying fetch's
  own `TypeError` up the chain. Nothing answering is an ordinary thing to happen: a Host that is
  not running yet, a port that is not the one it serves on, a machine that went to sleep. What
  reached the person waiting was "fetch failed", which names a browser API and nothing they own.
- Localised where the fault is recognised, once, so every tier above it wraps a sentence somebody
  can act on: the address, and whatever is meant to be listening at it, are the two things worth
  looking at.

## [0.4.0]

### Sessions

- `AgentTurn` carries `acted`: whether that turn reached for anything, or answered out of what it
  already had. The loop is the only place that knows: by the time anybody reads the turn back, the
  exchanges are on it and working out what they meant is a question every reader would have to
  answer again, the same way, and one of them would answer it differently.
- Recorded, and nothing more. The framework says what a turn did; it does not tell a model when to
  reach and when to answer, because the words that decide that belong to whoever is writing the
  skill, in their own product's voice. A framework that shipped those words would be putting its
  own sentences in somebody else's agent's mouth.
- Optional, like the three fields beside it, so every turn recorded before it existed still reads
  back.

## [0.3.0]

### Sessions

- `AgentTurn` carries `tookMs`: how long the turn took, from the moment its run began to the moment
  it was written. A turn said when it happened and nothing about how long it took, and the
  difference between an answer that came back in two seconds and one that took four minutes is most
  of what somebody wants to know coming back to a conversation. Only the run can record it: by the
  time anybody reads the turn, both of those moments are gone.
- Measured from the top of the run rather than from the first turn of the loop, because what
  somebody means by how long a turn took is everything between asking and being answered. On the
  clock the run was given, like every other moment the loop records, and read once rather than
  twice: read twice, a turn would say it was written a fraction after it finished.
- Optional, like the two fields beside it, so every turn recorded before it existed still reads
  back.

## [0.2.0]

### Sessions

- `AgentTurn` carries `runId`: which run produced that turn. The session already
  carried the run it last was, which is one run for a conversation with twenty
  turns in it, so anything keeping what a run did could be offered for the most
  recent turn and for no other. Optional, for the reason `recordedOn` is
  optional: every turn recorded before this field existed is still in somebody's
  store and still has to read back.

## [0.1.0]

The first release as a library of its own. The implementation was written and
proven inside a consuming application and moves here unchanged in behaviour,
with nothing product-specific left in it: the framework imports Node's built-ins
and nothing else.

### The agent

- The tri-nature loop, one copy: `Agent = Orchestration(Data, Decision, Direction)`.
- `StandardAgent` as the single door, composed by one expression.
- Sessions, resumption and a run that survives the process that started it.
- A run-once perimeter over every act, with an effect ledger, claims and replay.
- Tools, skills, MCP servers and remote catalogs.
- Narration as its own channel, screened before it is spoken.
- Redaction, audit records, budgets and a circuit breaker over the generator.

### Conformance

- The language-neutral vector suite, carried as a submodule of
  [The-Standard-Agent](https://github.com/hassanhabib/The-Standard-Agent) so the
  vectors always come from the specification's own home rather than a copy.
- `npm run conformance` self-certifies against it. **Core is claimed.** The other
  three profiles are not claimable yet, and the reason is the runner rather than
  the implementation: it does not yet drive the vector fields those profiles use.
  No vector has been run against this implementation and failed.
