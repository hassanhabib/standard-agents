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

## MCP servers

Tools you did not write arrive over the Model Context Protocol, by URL or as a process the agent
starts. Any server built with one of the protocol's official SDKs answers, and servers
accumulate: a call routes to the server whose own catalog holds the tool.

```ts
const agent = new StandardAgent()
  .nativeBrain("https://api.example.com/v1/", apiKey, "a-model")
  .mcp("https://tools.example.com/", { relativeUrl: "mcp", apiKey: toolsKey })
  .mcpProcess("npx", ["-y", "@modelcontextprotocol/server-everything"]);
```

## Answers that cite their sources

A knowledge source can say where each passage came from and how well it matched, and an agent
can end a grounded answer with those sources. The agent writes the lines, not the model, and only
on a run that answered. Citation is off unless asked for, and what the agent sets wins over what a
request asks.

```ts
const agent = new StandardAgent()
  .nativeBrain("https://api.example.com/v1/", apiKey, "a-model")
  .onSourcedKnowledge(async (query) => [
    { text: "Enterprise customers may request a refund within 90 days.", score: 0.92, source: "refunds.md" },
  ])
  .citeKnowledge();

// "Enterprise customers have 90 days to ask for a refund.\n\nSource: refunds.md"
```

A plain `onKnowledge` source keeps working. Its passages have no known origin, so they are never
cited.

A folder of documents is knowledge too, and it is citable with nothing else configured: each
passage is credited to its document's path relative to the folder.

```ts
const agent = new StandardAgent()
  .nativeBrain("https://api.example.com/v1/", apiKey, "a-model")
  .knowledge("./knowledge", "*.md", 3)
  .citeKnowledge();

// "Enterprise customers have 90 days to ask for a refund.\n\nSource: policies/refunds.md"
```

Every document the pattern names, in the folder and beneath it, is ranked against the task the
way the reference ranks it, and at most `maxResults` passages reach a turn. A knowledge broker,
when one is configured, answers instead.

## What is in it

- The tri-nature loop, one copy, with the reply protocol and tool routing.
- Sessions and resumption, so a run survives the process that started it.
- A run-once perimeter over every act: an effect ledger, claims, replay and reconciliation.
- Tools, skills, MCP servers and remote catalogs.
- Knowledge from a folder or a source of your own, with scores and sources, and answers that cite
  them.
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
reason is the runner rather than the implementation. It does not yet drive every vector field
those profiles use (`nativeReplies`, `redact`, `concurrent`, `configurationJson` and the rest),
so those vectors do not execute. The remote tool server vectors (45, 74, 75, 76) do, and pass,
and so does every citation vector (84 through 88), against real files in a real knowledge
folder. No vector has been run against this implementation and failed, which is not the same
thing as passing, and the claim says only what was proven.

A claim is per released version and is only ever raised by a green run of the runner.

## The Standard

The source follows The Standard tier for tier: `brokers` are the only code that touches the
outside world, `services` hold every decision, `clients` are the door, and `models` carry data
between them. Tests are written before the code they prove, one failing test and one passing
implementation per commit.

## License

[The Standard Software License 1.1](LICENSE.txt). Copyright Hassan Habib.
