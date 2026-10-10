# Changelog

All notable changes to `@hassanhabib/standard-agents` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versions follow
the four-part scheme The Standard uses: model, service, fix, build.

## [0.18.0]

Tracks SPEC v1.18, section 4.2 (the Local knowledge mode), as `Standard.Agents` 6.0.0.0 does.

### Added

- **A folder of documents is knowledge, and it is citable out of the box.**
  `knowledge(path, pattern = "*.md", maxResults = 3, minScore = 0)` reads every document the
  pattern names in the folder and beneath it, through the file broker, and seeds the most relevant
  passages into each turn. The ranking is the reference's, constant for constant: documents in
  ordinal path order, overlapping windows of 120 words every 60, terms split on the same
  separators with the same noise words dropped, each query term weighted by how rare it is across
  the folder, divided by the square root of the passage's length. A passage carrying no query
  term is never returned, nor one below `minScore`, and at most `maxResults` reach a turn. Each
  passage is sourced with its document's path relative to the folder, with forward slashes on
  every platform, so `citeKnowledge()` credits it with nothing else configured. A knowledge
  broker, when one is configured, answers instead, whatever order the verbs were called in. The
  pattern matches regardless of case, so `*.md` finds `README.MD` on every platform.
- The conformance runner drives `knowledge`, `knowledgeMaxResults` and `gateVerdict`. Every
  citation vector, 84 through 88, now passes, and so do 08 (gate-refusal-short-circuits) and 22
  (knowledge-retrieves-by-relevance): 24 of 88, up from 18.

## [0.17.0]

Tracks SPEC v1.18, sections 3.2, 3.7, 4.1 and 4.2 (sourced knowledge and citation), as
`Standard.Agents` 6.0.0.0 does.

### Added

- **A knowledge source can say where a passage came from.** `KnowledgeResult` carries the passage,
  its score and its source. `SourcedKnowledgeBroker`, `FunctionSourcedKnowledgeBroker`,
  `useSourcedKnowledge(broker)` and `onSourcedKnowledge(retrieve)` take it. A plain
  `KnowledgeBroker` keeps working unchanged and is lifted to passages with no score and no source.
- **The run knows its sources.** Recall puts each non-empty source of the knowledge it injected on
  the run's context (`groundingSources`), once each, in the order first recalled. The Brain is
  shown exactly the passages it was always shown.
- **A grounded answer cites its sources.** `citeKnowledge(enabled = true, prefix = "Source: ")`
  appends one line per recalled source to a run that answered, after a blank line, skipping a
  source the answer already credits. It is written by the agent, not asked of the model, and
  applied after the Judge, before the Response event and the session write, so the batched door,
  the stream and the session carry the same text. It is off by default. A request's
  `citeKnowledge` asks for it, and what the agent set wins over the request. A run that refused,
  asked, is waiting or failed, an answer held to a response schema, and a passage with no source
  are never cited.
- The conformance runner drives `knowledgePassages`, `citeKnowledge`, `citationPrefix` and
  `request.citeKnowledge`, against the reference pinned at `Standard.Agents` main. Vector 87
  passes. Vectors 84, 85, 86 and 88 use the built-in knowledge folder, which this library does
  not have yet, so they are reported unsupported rather than run.

## [0.16.0]

Tracks SPEC v1.17, sections 4.1 and 4.8 (remote tool servers), as `Standard.Agents` 5.1.0.0 does.

### Added

- **The agent reaches MCP servers by itself.** Until now a remote tool server was reachable only
  through a broker the host wrote. `mcp(endpointUrl, options)` reaches one by URL over the
  protocol's Streamable HTTP transport, and `mcpProcess(command, args, { env, cwd })` starts one as
  a process and speaks to it over its standard streams, which is how most servers people run with
  `npx`, `uvx`, `dotnet` or `python` work. Both are built to the protocol rather than a dialect of
  it, so a server built with any of the official SDKs answers. They were proven live against the
  official C# SDK over HTTP (stateful and stateless) and over stdio.
- `HttpMcpBroker`: JSON or event-stream replies, read past notifications; the `initialize`
  lifecycle once, then the session and the negotiated protocol version on every request; a
  session the server ended renewed and the request retried once; a server without `initialize`
  used without a session; an API key in a header you name, a bearer token, or a token provider
  asked before every request; every exchange bounded by the caller's signal and a timeout.
- `StdioMcpBroker`: one message per line; stray output and notifications skipped; the server's
  own `ping` answered; a line queue, so a reader that gave up never swallows the next answer;
  started with its error stream drained, its pipes released so a finished script exits, and
  stopped with the host. On Windows a bare command resolves through `PATH` and `PATHEXT`, and a
  `.cmd` launcher starts through the shell, so `npx` works. It also runs over streams you hold.
- Both read the whole paged catalog and drop nothing a tool returns: an embedded resource as its
  text, a link as `[resource_link name: uri]`, an image as `[image image/png]`, and
  `structuredContent` when there is no text.
- `CompositeMcpBroker`, exported.
- The conformance runner drives `mcpServers`, `mcpToolSchemas`, `extraSkills`, `selectTools` and
  `enforceSelection`, and asserts `brainNeverSees` and `mcpServerCalls`. Vectors 45, 74, 75 and
  76 pass.

### Fixed

- **A second MCP server adds, never replaces.** `useMcp` replaced the server registered before
  it, which SPEC.md 4.8 forbids. Servers now accumulate, a call routes to the server whose own
  catalog holds the name, the first registered wins a name two claim, and a server down at
  discovery keeps only its own tools away.
- **The package names itself by the version it published.** `STANDARD_AGENTS_VERSION`, the
  version in every model request's `User-Agent`, was still `0.1.0`. A test now holds it to
  `package.json`.

### Upgrading

Code that compiled against 0.15.0 compiles unchanged. A host that registered two servers with
`useMcp` and relied on the second replacing the first now has both; register only the one it
means. `AgentConfiguration` gains `mcpSources`, and a broker assigned to `mcpBroker` directly
still works, counted as the first server.

## [0.15.0]

Tracks SPEC v1.16, section 4.14.1 (spending).

### Added

- **A run says what it is spending while a call is answered.** A `Usage` event arrives when a call
  ends, and a call can take minutes: the first person to watch one saw the count stand still while
  a model wrote a file. The stream now carries `Spending` events between sending a call and its
  `Usage`. Each is the run's settled total plus this call's own estimate: the prompt, counted the
  moment the call is sent, and what has come back so far, whether it is words, narration, a call's
  arguments or the model's reasoning. Always estimated, never what the budget reads, and
  superseded by the call's `Usage`. Said when a call is sent, then each time the count has moved
  by 25 or more, so a file written a few characters at a time is not a thousand events. The native
  streamed door only; a text brain answers whole and has nothing to say in between.
- `GenerationDelta.written`: what the model wrote in a frame that nobody reads (a piece of a call's
  arguments, or of `reasoning_content`), handed up to be counted and never voiced.
- `decideStream` and `thinkStream` take an optional third argument that hears what the call has
  spent so far.

### Upgrading

A consumer that switches on an event's `type` sees a seventh kind, `Spending`. One that reads only
`Usage` reads exactly what it did before.

## [0.14.1]

### Fixed

- **A native call the provider said nothing about is counted, not taken as free.** The global
  network answers a streamed turn with no usage frame, and the native protocol took every such call
  as costing nothing, marked reported: the window showed "0 tokens" a minute into a run that had
  made three calls, and a token budget on that run bounded nothing. SPEC.md 3.4 requires a count
  where there is no report, and the text protocol has made one since 1.1. Both native doors now
  count what they sent (instructions, conversation, calls, observations, prompt and offered tools)
  and what came back (words, narration and calls), marked estimated. A provider's own report still
  wins whenever there is one. `Standard.Agents` has counted this way since it gained the native
  protocol.

## [0.14.0]

Tracks SPEC v1.15, section 4.14.1, as `Standard.Agents` 4.0.0.0 does.

### Added

- **A run says what it has spent, after every model call.** The loop always counted a run's tokens,
  reported or estimated, because the budget cannot bound what it does not count, and it kept the
  count to itself: somebody watching a run could read a clock and nothing else. The event stream
  now carries a `Usage` event after every call the loop makes for the Brain. Its new `usage` field
  is the run's total so far as an `AgentUsage`, estimated when any call in it was; its `content` is
  that total as a number. It is the count the budget reads, a draft sent back for revision counts,
  and it is never part of the answer. Both `runStream` and `runWithEvents` carry it.
- **The conformance runner drives the streamed door.** A vector marked `streamed` runs through
  `runStream`, and `usageEvents` and `usageEstimated` read the Usage events off the stream. Vector
  83 passes, and fails against a build that reports each call's own figure instead of the total.

### Upgrading

A consumer that switches on an event's `type` sees a sixth kind. One that treats any kind it does
not know as answer text would print the count into the answer; handle `Usage` or ignore it.

## [0.13.2]

### Fixed

- **A streamed turn waits four minutes for the service to answer, not thirty seconds.** Measured on
  a Host on the local network: it sends nothing, not even its headers, until the whole answer is
  ready, so a coding turn with forty messages behind it was cut off at thirty seconds on every
  attempt while the Host was working. A Host that has not answered cannot be told from one that is
  still writing a buffered answer. Four minutes fits a buffered coding turn on somebody's own
  hardware and is said before the platform's own five minutes run out with "nothing answered",
  which would not be true. The person's stop still ends a wait at once.

## [0.13.1]

### Fixed

- **The thirty-second wait ends when the service answers, not at its first word.** A turn can spend
  a long time in frames with no words in them: a tool call's arguments, a model's reasoning, or a
  Host on somebody's own hardware reading a long prompt. None of those frames was handed up, so the
  first-piece clock ran out on a Host that had answered in two seconds and was plainly working.
  Watched on a Host on the local network: "did not start answering within 30 seconds" on every
  coding turn. The stream now hands up an empty piece the moment the service answers; the clock
  stops on it, and it is not voiced.

## [0.13.0]

### When the model service fails

- **Every failure says what happened, as the last word.** A door shows the bottom of an error's
  chain, and a failing status left the raw `HttpResponseException` there, so people read "HTTP 401",
  "HTTP 503", or a JSON parser's complaint about a `<`. Each kind now ends in its own sentence, with
  the native fault kept as the cause and in the data, the way `UnreachableBrainException` already
  did:

  | What happened | Exception | Says |
  |---|---|---|
  | 401, 403 | `RefusedBrainException` | the key was not accepted; check it |
  | 404 | `NotFoundBrainException` | nothing there answers chat, or the model is not installed |
  | 429 | `BusyBrainException` | too many requests; try again in the seconds the service named |
  | 408, 502, 503, 504 | `UnavailableBrainException` | not available right now; the same wait |
  | other 5xx | `FaultedBrainException` | the service failed; try again, and it is the service's to fix if it persists |
  | other 4xx | `RejectedBrainException` | refused, with the service's own reason when it gave one in words |
  | 400 | `InvalidBrainException` | the same, in place of "Invalid brain request" |
  | a reply that is not JSON | `MalformedBrainReplyException` | check that the address is an OpenAI-compatible API |
  | no first piece within 30 seconds | `TimedOutBrainException` | it did not start answering in time |
  | the connection drops mid-answer | `StreamInterruptedException` | it dropped partway; what arrived is above |

  Categories and log severities are unchanged.
- **A busy service is asked once more.** A 429 or a 503 is retried once, after the `Retry-After`
  the service sent (a number of seconds or a date), capped at thirty seconds, and two seconds when
  it said nothing. A streamed turn says so first on the Narration channel ("The model service is
  busy (503), so I am trying again in 5 seconds."). A status arrives before the first frame, so
  nothing said is ever said twice. `HttpResponseException` carries `retryAfter`, and the brokers
  now pass the header up rather than dropping it.
- **A streamed turn gives up after thirty seconds without a first piece.** Once the answer has
  started it may take as long as it takes.
- **A stop in the middle of a turn is a cancel.** It ended as a failure reading "This operation was
  aborted"; it now ends as cancelled, exactly as a stop between turns does.
- `TimeBroker` gains `delay(milliseconds, signal)`, so a service that waits can be tested without
  waiting. `BrainService` takes the clock as its last constructor argument, defaulting to the
  system's.

## [0.12.0]

### The loop, on every protocol

- **A look after a write sees the write on the text protocol too.** The writes a look is keyed
  against were counted from native exchanges, and the text protocol keeps none, so a run on the text
  protocol that edited a file and read it back was handed the file as it was before the edit. The
  run now counts what it performed (`AgentRun.writesTo`), and `PerformedEffect` carries the scope
  and risk of each act. The exchanges still count for a run resumed with a conversation, and
  whichever saw more writes decides.
- **A text-protocol run going in circles stops.** The repetition bound read only the exchanges'
  `replayed` flag, so on the text protocol it never fired and the turn cap ended the run as if it
  had merely run long. The run now counts the ledger's answers to its latest ask
  (`AgentRun.recordReplay`, `AgentRun.replaysOfLatestAsk`), and an act that ran resets the count.

### Conformance

- The reference is pinned at The Standard Agent v3.0.0 (SPEC v1.14). The runner honors
  `toolRisk`, `toolScopeFirstWord`, `identicalCallLimit`, an empty `request`, and the expectations
  `status`, `failureCode` and `brainSees`. Vectors 80, 81 and 82 pass; 80 and 82 fail against
  0.11.0.
- Citations of SPEC sections that do not exist (10.3, 17.1) now name §6.2.

## [0.11.0]

### The native conversation

- **A replay's answer stays in view.** A replay tells the model its answer is above, and from the
  third ask it sends only that note. The native conversation keeps the last three results whole and
  turns older ones into a marker, so a file read in pages pushed its first page out, and "above"
  was a marker. Watched live: the model was told to use what it could not see and read the same
  977-line file forty more times. A replay in view now keeps the latest call it stands for in view
  as well.
- **How many results stay whole is the composition's to say.** `elisionWindow(calls)` on the
  builder sets how many of the most recent calls a native turn sends whole. The default stays at
  three. A provider that refuses the conversation as too large still climbs down the ladder, so a
  larger window costs a round trip at worst.

## [0.10.0]

### The loop

- **Only the asks the ledger answered count as going in circles.** 0.9.0 counted identical asks,
  and a read after an edit is the same ask and is not a repeat: a run that read a file, edited it,
  read it back, edited it again and read it back was stopped at four with "going in circles", on
  every task, because the asks were identical and the loop never looked at whether they did
  anything. Watched live within the hour.
- A replayed exchange now says so (`ToolExchange.replayed`, absent on a call that ran), and the
  limit counts the replays on top of the one call that ran. A read that ran again because the file
  changed is a call that ran.

## [0.9.0]

### The loop

- **A run that keeps asking for the same act ends.** `identicalCallLimit`, on the run options and
  the builder, is how many times a run may ask for the same act with the same arguments before
  the loop ends it. The run-once perimeter answers the second ask with a replay and a note and the
  third with the note alone, and watched live, twice, a model went on asking eleven more times with
  the note in front of it. A note is not enough for every model, and a turn cap of sixty-four is
  sixty turns of the same question.
- Reported the way a budget stop is, `Failed` with the code `going_in_circles`, because it is one:
  not a refusal and not an answer, and a caller that cannot tell the two apart cannot decide what
  to do next.
- Eight by default, which is above the default turn cap of seven: a deployment on the default never
  meets this and the cap stays the loop's first breaker, so conformance 06 and 17 hold as they are.
  A deployment that gives a run more turns is the one this is for, and it says how many is enough.
- Counted over the run's own exchanges, which the native protocol keeps; the text protocol keeps
  none and stays on the turn cap, as it always has.

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
