# Changelog

All notable changes to `@hassanhabib/standard-agents` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions follow
the four-part scheme The Standard uses: model, service, fix, build.

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
