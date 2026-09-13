# @hassanhabib/standard-agents

A TypeScript implementation of [The Standard for Agents](https://github.com/hassanhabib/The-Standard-Agent-Specs):

```
Agent = Orchestration(Data, Decision, Direction)
```

Data recalls (skills, memory, knowledge). Decision thinks (one brain wrapped in a Gate and a
Judge). Direction acts (internally, externally, or returns). The package keeps the reference
implementation's shape, tier for tier, and certifies itself against the specification's own
JSON conformance vectors.

Zero runtime dependencies. It imports Node's built-ins and nothing else.

## Install

```
npm i @hassanhabib/standard-agents
```

Node 20 or later.

## One expression

```ts
import { StandardAgent } from "@hassanhabib/standard-agents";

const agent = new StandardAgent()
  .brain("https://api.example.com/v1/", apiKey, "a-model")
  .tools([calculator]);

const answer = await agent.processPrompt("what is 19 times 23");
```

The agent is the door. There is no builder to hold, no runtime to start, and no mandatory
build step: composing it is the same sentence as using it.

## What is in it

- The tri-nature loop, one copy, with the reply protocol and tool routing.
- Sessions and resumption, so a run survives the process that started it.
- A run-once perimeter over every act: an effect ledger, claims, replay and reconciliation.
- Tools, skills, MCP servers and remote catalogs.
- Narration as its own channel, screened before it is spoken.
- Redaction, audit records, budgets and a circuit breaker over the generator.

## Conformance

The vectors are the executable half of the specification, and they live in the
specification's own home rather than in a copy here. They arrive as a submodule:

```
git clone --recursive https://github.com/hassanhabib/standard-agents.git
npm ci
npm run conformance
```

| Version | Claimed |
| --- | --- |
| 0.1.0 | Core |

**Core is claimed: 6 of 6.** Critical, Enterprise and Reliable are not claimable yet, and the
reason is the runner rather than the implementation. It does not yet drive the vector fields
those profiles use (`streamed`, `nativeReplies`, `mcpServers`, `redact`, `concurrent` and the
rest), so those vectors do not execute. No vector has been run against this implementation and
failed, which is not the same thing as passing, and the claim says only what was proven.

A claim is per released version and is only ever raised by a green run of the runner.

## The Standard

The source follows The Standard tier for tier: `brokers` are the only code that touches the
outside world, `services` hold every decision, `clients` are the door, and `models` carry data
between them. Tests are written before the code they prove, one failing test and one passing
implementation per commit.

## License

[The Standard Software License 1.1](LICENSE.txt). Copyright Hassan Habib.
