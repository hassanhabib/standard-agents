# Changelog

All notable changes to `@hassanhabib/standard-agents` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions follow
the four-part scheme The Standard uses: model, service, fix, build.

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
